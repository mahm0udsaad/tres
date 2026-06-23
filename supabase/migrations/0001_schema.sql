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
