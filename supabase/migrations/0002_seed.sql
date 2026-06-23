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
