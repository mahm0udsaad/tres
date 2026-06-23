-- Homepage curated sections ("today's picks" + "best sellers"), owner-editable
-- from the control panel: each has kicker/title/description text + an ordered
-- list of item ids. Stored as one jsonb blob on the settings singleton.
alter table public.settings
  add column if not exists home jsonb not null default '{}'::jsonb;

-- Seed from the original hardcoded homepage (resolve slugs → current item ids).
update public.settings set home = jsonb_build_object(
  'today', jsonb_build_object(
    'kicker', '01 — TODAY',
    'title',  'خيارات تريس اليوم',
    'desc',   'مختارات اليوم من المنيو — توقيعنا، حليبنا، وماتشانا. كل الأسعار بالريال السعودي.',
    'items',  coalesce((
      select jsonb_agg(id order by ord) from (
        select id, array_position(array['hot-tres','spanish-latte-iced','matcha','triple-chocolate'], slug) as ord
        from public.items where slug in ('hot-tres','spanish-latte-iced','matcha','triple-chocolate')
      ) t), '[]'::jsonb)
  ),
  'best', jsonb_build_object(
    'kicker', '02 — BEST SELLERS',
    'title',  'الأكثر مبيعاً',
    'desc',   'الأصناف اللي ما تخيب — اختيارات ضيوفنا الأكثر طلبًا. كل الأسعار بالريال السعودي.',
    'items',  coalesce((
      select jsonb_agg(id order by ord) from (
        select id, array_position(array['cappuccino','spanish-latte-hot','matcha-foam','raffaello-tres'], slug) as ord
        from public.items where slug in ('cappuccino','spanish-latte-hot','matcha-foam','raffaello-tres')
      ) t), '[]'::jsonb)
  )
) where id = 1;
