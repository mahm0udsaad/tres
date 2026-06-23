-- TRES control panel — core schema
-- Single-store model (one coffee shop). The public site reads categories/items/
-- settings; the /admin panel writes them with the service-role key (bypasses RLS).

create extension if not exists "pgcrypto";

-- ── categories ──────────────────────────────────────────────────────────────
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  number      text,                       -- display number e.g. "01"
  name_ar     text not null,
  name_en     text,
  tagline     text,
  glyph       text,                        -- emoji shown on the tile
  image_url   text,
  note        text,                        -- allergen / footnote
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── items ───────────────────────────────────────────────────────────────────
create table if not exists public.items (
  id           uuid primary key default gen_random_uuid(),
  category_id  uuid not null references public.categories(id) on delete cascade,
  slug         text,
  name_ar      text not null,
  name_en      text,
  price        numeric(10,2),
  badge        text,
  cal          text,
  description  text,
  image_url    text,
  emblem_url   text,
  emblem_fit   text check (emblem_fit in ('cover','contain')),
  notes        text[] not null default '{}',   -- tasting notes
  variety      text,
  altitude     text,
  process      text,
  is_available boolean not null default true,
  is_featured  boolean not null default false, -- shown in "today's picks"
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists items_category_idx on public.items(category_id);

-- ── feedback (replaces complaints.ndjson) ────────────────────────────────────
create table if not exists public.feedback (
  id          uuid primary key default gen_random_uuid(),
  name        text,
  contact     text,
  type        text not null default 'other',   -- service|product|place|other
  message     text not null,
  status      text not null default 'new' check (status in ('new','read','resolved')),
  created_at  timestamptz not null default now()
);
create index if not exists feedback_status_idx on public.feedback(status, created_at desc);

-- ── settings (single row) ────────────────────────────────────────────────────
create table if not exists public.settings (
  id                   integer primary key default 1 check (id = 1),
  hours                jsonb not null default '[]'::jsonb,  -- [{day, open, close, closed}]
  announcement         text,
  announcement_active  boolean not null default false,
  phone                text,
  address              text,
  instagram            text,
  tiktok               text,
  snapchat             text,
  updated_at           timestamptz not null default now()
);

-- keep updated_at fresh
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists categories_touch on public.categories;
create trigger categories_touch before update on public.categories
  for each row execute function public.touch_updated_at();
drop trigger if exists items_touch on public.items;
create trigger items_touch before update on public.items
  for each row execute function public.touch_updated_at();
drop trigger if exists settings_touch on public.settings;
create trigger settings_touch before update on public.settings
  for each row execute function public.touch_updated_at();

-- ── Row Level Security ───────────────────────────────────────────────────────
-- Public site uses the anon/publishable key: can READ the menu and SUBMIT
-- feedback, nothing else. The admin panel uses the service-role key on the
-- server, which bypasses RLS entirely.
alter table public.categories enable row level security;
alter table public.items      enable row level security;
alter table public.settings   enable row level security;
alter table public.feedback   enable row level security;

drop policy if exists categories_read on public.categories;
create policy categories_read on public.categories for select using (true);

drop policy if exists items_read on public.items;
create policy items_read on public.items for select using (true);

drop policy if exists settings_read on public.settings;
create policy settings_read on public.settings for select using (true);

-- anon may insert feedback but never read it
drop policy if exists feedback_insert on public.feedback;
create policy feedback_insert on public.feedback for insert with check (true);

-- ensure the settings singleton exists
insert into public.settings (id) values (1) on conflict (id) do nothing;
-- Seed from the official TRES printed menu (mirrors app/lib/menu.ts at migration time).
-- Idempotent: categories/items keyed by slug. Safe to re-run.

insert into public.categories (slug, number, name_ar, name_en, tagline, glyph, image_url, note, sort_order)
values
  ('specialty','01','قهوة مختصة','SPECIALTY COFFEE','ثلاثة محاصيل بطابع تريس','🫘','/assets/menu/specialty.webp', null, 1),
  ('coffee','02','مشاريب الحليب','MILK DRINKS','إسبريسو، لاتيه، وخياراتك اليومية','☕','/assets/menu/coffee.webp', null, 2),
  ('drinks','03','ماتشا','MATCHA','ماتشا، كركديه، وخيارات منعشة','🍵','/assets/menu/drinks.webp', null, 3),
  ('dessert','04','الحلا','DESSERTS','حلا يكمّل قهوتك','🍰','/assets/menu/dessert.webp',
    'قد تحتوي هذه المنتجات على مسببات الحساسية (المكسرات ومنتجات الألبان والبيض).', 4)
on conflict (slug) do update set
  number=excluded.number, name_ar=excluded.name_ar, name_en=excluded.name_en,
  tagline=excluded.tagline, glyph=excluded.glyph, image_url=excluded.image_url,
  note=excluded.note, sort_order=excluded.sort_order;

-- specialty
insert into public.items (category_id, slug, name_ar, name_en, price, badge, emblem_url, emblem_fit, notes, variety, altitude, process, sort_order)
select c.id, v.slug, v.name_ar, v.name_en, v.price, v.badge, v.emblem_url, v.emblem_fit, v.notes, v.variety, v.altitude, v.process, v.ord
from public.categories c
join (values
  ('tres-roastery','محصول تريس','Tres Roastery',20,'حار / بارد','/assets/logo/tres-mark-white.png','contain', array['فواكه استوائية','مانجو','عسل','شوكولاتة'],'تيبيكا، ريد بوربون','1400–1600 م','مجففة',1),
  ('ethiopian','إثيوبي','Ethiopian',17,'حار / بارد','/assets/flags/ethiopia.svg','cover', array['توت أزرق مجفف','كراميل','ليمون','مسحوق الكاكاو'],'هيريليوم','2000 م','مجففة',2),
  ('colombian','كولومبي','Colombian',17,'حار / بارد','/assets/flags/colombia.svg','cover', array['تفاح','فواكه'],'كاتورا','1950 م','مجففة',3)
) as v(slug,name_ar,name_en,price,badge,emblem_url,emblem_fit,notes,variety,altitude,process,ord)
on true
where c.slug='specialty'
on conflict do nothing;

-- coffee / milk drinks
insert into public.items (category_id, slug, name_ar, name_en, price, badge, image_url, notes, variety, altitude, process, sort_order)
select c.id, v.slug, v.name_ar, v.name_en, v.price, v.badge, v.image_url, coalesce(v.notes, '{}'), v.variety, v.altitude, v.process, v.ord
from public.categories c
join (values
  ('alfrido','ألفريدو','Alfrido',13,null,null,null::text[],null,null,null,1),
  ('americano','أمريكانو','Americano',14,'حار / بارد',null,null::text[],null,null,null,2),
  ('espresso','إسبرسو','Espresso',12,null,null,array['شوكولاتة','فواكه','بندق'],'مزيج خاص','—','مجففة - مغسولة',3),
  ('cappuccino','كابتشينو','Cappuccino',16,null,'/assets/items/cappuccino.webp',null::text[],null,null,null,4),
  ('latte','لاتيه','Latte',16,null,null,null::text[],null,null,null,5),
  ('flat-white','فلات وايت','Flat White',16,null,null,null::text[],null,null,null,6),
  ('cortado','كورتادو','Cortado',15,null,null,null::text[],null,null,null,7),
  ('macchiato','ميكاتو','Macchiato',12,null,null,null::text[],null,null,null,8),
  ('spanish-latte-hot','سبانش لاتيه','Spanish Latte',18,'حار',null,null::text[],null,null,null,9),
  ('spanish-latte-iced','سبانش لاتيه','Spanish Latte',19,'بارد',null,null::text[],null,null,null,10),
  ('hot-tres','هوت تريس','Hot Tres',19,'توقيع · حار',null,null::text[],null,null,null,11)
) as v(slug,name_ar,name_en,price,badge,image_url,notes,variety,altitude,process,ord)
on true
where c.slug='coffee'
on conflict do nothing;

-- matcha
insert into public.items (category_id, slug, name_ar, name_en, price, badge, sort_order)
select c.id, v.slug, v.name_ar, v.name_en, v.price, v.badge, v.ord
from public.categories c
join (values
  ('hibiscus','كركديه','Hibiscus',15,null,1),
  ('matcha','ماتشا','Matcha',18,'حار / بارد',2),
  ('matcha-foam','ماتشا فوم','Matcha Foam',20,null,3)
) as v(slug,name_ar,name_en,price,badge,ord)
on true
where c.slug='drinks'
on conflict do nothing;

-- desserts
insert into public.items (category_id, slug, name_ar, name_en, price, cal, description, sort_order)
select c.id, v.slug, v.name_ar, v.name_en, v.price, v.cal, v.description, v.ord
from public.categories c
join (values
  ('triple-chocolate','تربل شوكلت','Triple Chocolate',25,'540','كيكة شوكولاتة محشوة جاناش، مع صوص شوكولاتة كراميل وشوكولاتة بلجيكية.',1),
  ('pecan-cake','كيك البيكان','Pecan Cake',25,'410','طبقات من كيك البيكان الغني بالمكسرات وصوص التوفي.',2),
  ('london-cake','كيكة لندن','London Cake',28,'540','طبقات من كيك فادج الشوكولاتة وجاناش الشوكولاتة مع كريمة الكراميل.',3),
  ('tres-cookies','كوكيز تريس','Tres Cookies',12,'350','كوكيز تريس المخبوزة بعناية.',4),
  ('raffaello-tres','رافيلو تريس','Raffaello Tres',25,'350','مزيج كريمي غني بجوز الهند، بطعم فاخر وخفيف يذوب في الفم.',5),
  ('lemon-blueberry-cake','ليمون بلو بيري كيك','Lemon Blueberry Cake',25,'410','كيك مع طبقة من كريمة الليمون وكريمة التوت وحبات بلوبيري.',6)
) as v(slug,name_ar,name_en,price,cal,description,ord)
on true
where c.slug='dessert'
on conflict do nothing;

-- store settings seeded from app/lib/site.ts
update public.settings set
  phone     = coalesce(phone, null),
  address   = coalesce(address, 'الطائف'),
  instagram = coalesce(instagram, 'https://www.instagram.com/tres_saudi'),
  tiktok    = coalesce(tiktok, 'https://www.tiktok.com/@tres.ksa'),
  snapchat  = coalesce(snapchat, 'https://snapchat.com/t/U1ejkI2G')
where id = 1;
-- Public storage bucket for menu/category images uploaded from the control panel.
-- Uploads happen server-side with the service-role key (bypasses RLS); the
-- bucket is public so images are served via plain public URLs.
insert into storage.buckets (id, name, public)
values ('menu', 'menu', true)
on conflict (id) do update set public = true;

-- Allow anyone to read objects in the public bucket.
drop policy if exists "menu public read" on storage.objects;
create policy "menu public read" on storage.objects
  for select using (bucket_id = 'menu');
