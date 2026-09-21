-- Saudi National Day skin ("عزّنا بطبعنا"). Widens the theme check so the
-- control panel can select it; the public layout applies it via
-- <html data-theme="national">. The active theme is left untouched — the admin
-- flips to it from the panel when the campaign starts.
alter table public.settings
  drop constraint if exists settings_theme_check;
alter table public.settings
  add constraint settings_theme_check check (theme in ('classic', 'summer', 'national'));
