-- Backfill image_url for seeded items that ship with a static photo under
-- /public/assets/items/<slug>.webp. The public site already shows these via a
-- filename convention, but the admin panel reads image_url directly — so without
-- this, most items showed a placeholder in the control panel. Specialty origins
-- (colombian/ethiopian/tres-roastery) use flag/logo emblems and have no photo.
update public.items
set image_url = '/assets/items/' || slug || '.webp'
where slug in (
  'alfrido','americano','cappuccino','cortado','espresso','flat-white','hibiscus',
  'hot-tres','latte','lemon-blueberry-cake','london-cake','macchiato','matcha-foam',
  'matcha','pecan-cake','raffaello-tres','spanish-latte-hot','spanish-latte-iced',
  'tres-cookies','triple-chocolate'
);
