-- Winter skin ("شتاؤنا دافي"). Widens the theme check so the control panel can
-- select it; the public layout applies it via <html data-theme="winter"> and
-- mounts the snowfall overlay. The active theme is left untouched — the owner
-- flips to it from the panel when the season starts.
alter table public.settings
  drop constraint if exists settings_theme_check;
alter table public.settings
  add constraint settings_theme_check check (theme in ('classic', 'summer', 'national', 'winter'));
