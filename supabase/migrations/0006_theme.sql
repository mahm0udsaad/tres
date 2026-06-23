-- Site theme switcher. The control panel writes the active visual identity to
-- the settings singleton; the public layout applies it via <html data-theme>.
-- Supported values: 'classic' (original wine/blush) | 'summer' (wine + powder
-- blue + sand). Kept as text with a check so new skins are easy to add later.
alter table public.settings
  add column if not exists theme text not null default 'classic';

alter table public.settings
  drop constraint if exists settings_theme_check;
alter table public.settings
  add constraint settings_theme_check check (theme in ('classic', 'summer'));

-- Activate the summer skin now (admin can flip back from the panel).
update public.settings set theme = 'summer' where id = 1;
