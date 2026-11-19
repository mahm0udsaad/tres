-- Catering: the owner's own price list (TRES EVENTS poster, 2026-11-19).
--
-- Four cup-count packages replace the starter packages seeded in
-- 20261118090000. The owner's note: coffee only — no sweets.
-- Every package includes delivery, setting up the hospitality corner, and a
-- server; the drinks to choose from and the extras (extra cup, a custom tag
-- with the couple's name) are shown on /catering itself.
--
-- Safe to re-run: the starter rows are removed only while they still carry
-- the seed names, and the new rows go in only if none of them exist yet — so
-- packages the owner has edited in the control panel are left alone.

delete from public.catering_packages
where name_ar in ('ركن القهوة', 'جلسة الضيافة', 'صندوق تريس');

insert into public.catering_packages
  (name_ar, name_en, price, unit, serves, description, includes, badge, sort_order)
select * from (values
  ('الباقة الأولى', 'Package 1', 1450::numeric, 'للباقة', '١٠٠ كوب',
   'قهوة فقط — بدون حلا.',
   array['التوصيل','تجهيز وتركيب ركن الضيافة','موظف متخصص للتقديم'], null::text, 1),
  ('الباقة الثانية', 'Package 2', 1850::numeric, 'للباقة', '١٥٠ كوب',
   'قهوة فقط — بدون حلا.',
   array['التوصيل','تجهيز وتركيب ركن الضيافة','موظف متخصص للتقديم'], null::text, 2),
  ('الباقة الثالثة', 'Package 3', 2350::numeric, 'للباقة', '٢٠٠ كوب',
   'قهوة فقط — بدون حلا.',
   array['التوصيل','تجهيز وتركيب ركن الضيافة','موظف متخصص للتقديم'], null::text, 3),
  ('الباقة الرابعة', 'Package 4', 3150::numeric, 'للباقة', '٣٠٠ كوب',
   'قهوة فقط — بدون حلا.',
   array['التوصيل','تجهيز وتركيب ركن الضيافة','موظف متخصص للتقديم'], null::text, 4)
) as poster
where not exists (
  select 1 from public.catering_packages
  where name_ar in ('الباقة الأولى','الباقة الثانية','الباقة الثالثة','الباقة الرابعة')
);
