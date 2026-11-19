-- Owner's November brief, data side:
--   · 2 — catering packages, priced, with a WhatsApp booking CTA
--   · 4 — feedback gets a tracking code and a written reply
--   · 5 — WhatsApp number and Google Maps link in settings
--   · 7 — per-item "sold out" flag, separate from "hidden"
-- The menu redesign (8) and the homepage loyalty block (3) need no new data.

-- ── 7. sold out ──────────────────────────────────────────────────────────────
-- is_available already means "hide this item"; running out of stock is a
-- different state — the item stays on the menu, marked, so guests stop asking.
alter table public.items
  add column if not exists is_sold_out boolean not null default false;

-- ── 5. contact channels ──────────────────────────────────────────────────────
alter table public.settings add column if not exists whatsapp text;
alter table public.settings add column if not exists maps_url text;

-- ── 4. feedback: tracking code + reply ───────────────────────────────────────
alter table public.feedback add column if not exists ticket     text;
alter table public.feedback add column if not exists reply      text;
alter table public.feedback add column if not exists replied_at timestamptz;

-- Six characters from an unambiguous alphabet (no 0/O/1/I), so it can be read
-- out over the phone: TRS-4K7QX9.
create or replace function public.gen_feedback_ticket()
returns text language plpgsql as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  candidate text;
  i integer;
begin
  loop
    candidate := '';
    for i in 1..6 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.feedback where ticket = candidate);
  end loop;
  return candidate;
end $$;

create or replace function public.feedback_set_ticket()
returns trigger language plpgsql as $$
begin
  if new.ticket is null or new.ticket = '' then
    new.ticket := public.gen_feedback_ticket();
  end if;
  return new;
end $$;

drop trigger if exists feedback_ticket on public.feedback;
create trigger feedback_ticket before insert on public.feedback
  for each row execute function public.feedback_set_ticket();

-- backfill anything submitted before this migration
update public.feedback set ticket = public.gen_feedback_ticket()
  where ticket is null or ticket = '';

create unique index if not exists feedback_ticket_key on public.feedback(ticket);

-- Guests look their complaint up by code. anon still cannot read the table —
-- this function is the only way in, and it returns the status and our reply,
-- never the name, contact or the original message.
create or replace function public.feedback_track(p_ticket text)
returns table (
  ticket text,
  status text,
  type text,
  created_at timestamptz,
  reply text,
  replied_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select f.ticket, f.status, f.type, f.created_at, f.reply, f.replied_at
  from public.feedback f
  where f.ticket = upper(btrim(p_ticket))
  limit 1;
$$;

revoke all on function public.feedback_track(text) from public;
grant execute on function public.feedback_track(text) to anon, authenticated;

-- ── 2. catering ──────────────────────────────────────────────────────────────
create table if not exists public.catering_packages (
  id          uuid primary key default gen_random_uuid(),
  name_ar     text not null,
  name_en     text,
  price       numeric(10,2),
  unit        text,                            -- "للشخص" / "للجلسة" …
  serves      text,                            -- "١٠–١٥ ضيف"
  description text,
  includes    text[] not null default '{}',    -- what the package covers
  image_url   text,
  badge       text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists catering_touch on public.catering_packages;
create trigger catering_touch before update on public.catering_packages
  for each row execute function public.touch_updated_at();

alter table public.catering_packages enable row level security;
drop policy if exists catering_read on public.catering_packages;
create policy catering_read on public.catering_packages for select using (true);

-- Starter packages so the page is never empty; the owner edits prices and
-- contents from the control panel.
insert into public.catering_packages (name_ar, name_en, price, unit, serves, description, includes, sort_order)
select * from (values
  ('ركن القهوة', 'Coffee Corner', 35::numeric, 'للشخص', '٢٠ ضيف فأكثر',
   'باريستا تريس عندك، مع ركن تحضير كامل: إسبريسو، مشروبات حليب، وقهوة مقطّرة.',
   array['باريستا من تريس','إسبريسو ومشروبات الحليب','قهوة مقطّرة','أكواب وتجهيزات التقديم'], 1),
  ('جلسة الضيافة', 'Hospitality Setup', 55::numeric, 'للشخص', '٣٠ ضيف فأكثر',
   'ضيافة كاملة للمناسبات: القهوة، الحلا، والتقديم من فريقنا.',
   array['ركن القهوة كامل','تشكيلة حلا تريس','مشروبات باردة','فريق تقديم'], 2),
  ('صندوق تريس', 'TRES Box', 180::numeric, 'للصندوق', '٨–١٠ ضيوف',
   'صندوق جاهز يوصلك: قهوة اليوم، حلا مختار، وأكواب تريس.',
   array['ترمس قهوة اليوم','تشكيلة حلا','أكواب وتجهيزات'], 3)
) as seed
where not exists (select 1 from public.catering_packages);
