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
