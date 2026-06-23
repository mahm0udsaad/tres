"use client";

import { useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Plus, Pencil, X, Trash2, ImagePlus, FolderPlus } from "lucide-react";
import {
  saveItem, deleteItem, toggleAvailable, saveCategory, deleteCategory,
} from "../actions";

export type Template = "simple" | "coffee" | "dessert";
export type Cat = {
  id: string; slug: string; number: string | null; name_ar: string; name_en: string | null;
  tagline: string | null; glyph: string | null; image_url: string | null; note: string | null;
  template: Template; sort_order: number; is_active: boolean;
};
export type Itm = {
  id: string; category_id: string; slug: string | null; name_ar: string; name_en: string | null;
  price: number | null; badge: string | null; cal: string | null; description: string | null;
  image_url: string | null; emblem_url: string | null; emblem_fit: "cover" | "contain" | null;
  notes: string[] | null; variety: string | null; altitude: string | null; process: string | null;
  is_available: boolean; is_featured: boolean; sort_order: number;
};

function callAction(fn: (fd: FormData) => Promise<unknown>, fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fn(fd);
}

function SaveBtn({ label = "حفظ" }: { label?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="a-btn a-btn--primary" disabled={pending}>
      {pending ? "جارٍ الحفظ…" : label}
    </button>
  );
}

/* ── one item row: thumb, name, price, featured star, availability switch, edit ── */
function ItemRow({ item, onEdit }: { item: Itm; onEdit: () => void }) {
  const [available, setAvailable] = useState(item.is_available);
  const [, start] = useTransition();

  return (
    <div className="a-row" data-off={!available}>
      <span className="a-row-thumb">
        {item.image_url ? <img src={item.image_url} alt="" /> : (item.emblem_url ? <img src={item.emblem_url} alt="" /> : "☕")}
      </span>
      <div className="a-row-main">
        <div className="a-row-name">
          {item.name_ar}
          {parseBadges(item.badge).map((b, i) => <span key={i} className="a-pill a-pill--badge">{b}</span>)}
        </div>
        <div className="a-row-sub">
          {item.price != null && <span className="a-row-price">{item.price} ر.س</span>}
          {item.name_en && <span dir="ltr">{item.name_en}</span>}
        </div>
      </div>
      <div className="a-row-actions">
        <label className="a-switch" aria-label="متوفر">
          <input
            type="checkbox" checked={available}
            onChange={(e) => { const v = e.target.checked; setAvailable(v); start(() => { callAction(toggleAvailable, { id: item.id, value: v ? "1" : "" }); }); }}
          />
          <span className="track" /><span className="thumb" />
        </label>
        <button type="button" className="a-iconbtn" onClick={onEdit} aria-label="تعديل"><Pencil strokeWidth={2} /></button>
      </div>
    </div>
  );
}

/* ── image picker with live preview (reused for item photo & origin emblem) ── */
function ImagePicker({
  current, fileName = "image", urlName = "image_url", label = "اختر صورة", hint = "JPG أو PNG — يفضّل مربعة.",
}: { current: string | null; fileName?: string; urlName?: string; label?: string; hint?: string }) {
  const [preview, setPreview] = useState<string | null>(current);
  return (
    <div className="a-imgpick">
      <span className="preview">{preview ? <img src={preview} alt="" /> : <ImagePlus strokeWidth={1.8} />}</span>
      <div style={{ flex: 1 }}>
        <input type="hidden" name={urlName} defaultValue={current ?? ""} />
        <label className="a-btn a-btn--ghost a-btn--sm" style={{ cursor: "pointer" }}>
          <ImagePlus strokeWidth={2} /> {label}
          <input
            type="file" name={fileName} accept="image/*" hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) setPreview(URL.createObjectURL(f)); }}
          />
        </label>
        <p className="a-hint">{hint}</p>
      </div>
    </div>
  );
}

const TEMPLATE_HINT: Record<Template, string> = {
  simple: "مشروب — الاسم والسعر وصورة.",
  coffee: "قهوة مختصة — إيحاءات وبيانات المحصول.",
  dessert: "حلا — وصف وسعرات حرارية.",
};

const BADGE_PRESETS = ["حار / بارد", "حار", "بارد", "توقيع · حار", "جديدنا"];

function parseBadges(raw: string | null): string[] {
  return (raw ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

/* ── item add/edit sheet — fields adapt to the chosen category's template ── */
function ItemSheet({ cats, defaultCat, item, onClose }: { cats: Cat[]; defaultCat: string; item: Itm | null; onClose: () => void }) {
  const [, start] = useTransition();
  const [catId, setCatId] = useState(item?.category_id ?? defaultCat);
  const [badges, setBadges] = useState<string[]>(() => parseBadges(item?.badge ?? null));
  const cat = cats.find((c) => c.id === catId) ?? cats[0];
  const template: Template = cat?.template ?? "simple";

  function togglePreset(p: string) {
    setBadges((prev) => prev.includes(p) ? prev.filter((b) => b !== p) : [...prev, p]);
  }

  return (
    <div className="a-sheet-overlay" onClick={onClose}>
      <div className="a-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="a-sheet-grip" />
        <div className="a-sheet-head">
          <h2>{item ? "تعديل صنف" : "صنف جديد"}</h2>
          <button type="button" className="a-iconbtn" onClick={onClose} aria-label="إغلاق"><X strokeWidth={2} /></button>
        </div>
        <form action={async (fd) => { await saveItem(fd); onClose(); }}>
          {item && <input type="hidden" name="id" value={item.id} />}

          <div className="a-field">
            <label>القسم</label>
            <select name="category_id" className="a-select" value={catId} onChange={(e) => setCatId(e.target.value)}>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name_ar}</option>)}
            </select>
            <p className="a-hint">{TEMPLATE_HINT[template]}</p>
          </div>

          {/* essentials — every template */}
          <div className="a-row-2">
            <div className="a-field"><label>الاسم (عربي)</label><input name="name_ar" className="a-input" defaultValue={item?.name_ar ?? ""} required autoFocus /></div>
            <div className="a-field"><label>الاسم (إنجليزي)</label><input name="name_en" className="a-input" dir="ltr" defaultValue={item?.name_en ?? ""} /></div>
          </div>
          <div className="a-row-2">
            <div className="a-field"><label>السعر (ر.س)</label><input name="price" className="a-input" inputMode="decimal" defaultValue={item?.price ?? ""} /></div>
            <div className="a-field">
                <label>الشارات <span style={{ color: "var(--faint)", fontWeight: 400 }}>(اختياري — يمكن اختيار أكثر من واحدة)</span></label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                  {BADGE_PRESETS.map((p) => (
                    <button
                      key={p} type="button"
                      className={"a-pill a-pill--badge" + (badges.includes(p) ? " a-pill--active" : "")}
                      onClick={() => togglePreset(p)}
                    >{p}</button>
                  ))}
                </div>
                <input
                  name="badge" className="a-input"
                  placeholder="أو اكتب شارة مخصصة (افصل بفاصلة)…"
                  value={badges.join(",")}
                  onChange={(e) => setBadges(parseBadges(e.target.value))}
                />
                {badges.length > 0 && (
                  <p className="a-hint" style={{ marginTop: 4 }}>
                    {badges.map((b, i) => <span key={i} className="a-pill a-pill--badge" style={{ marginInlineEnd: 4 }}>{b}</span>)}
                  </p>
                )}
              </div>
          </div>

          {/* dessert-only */}
          {template === "dessert" && (
            <>
              <div className="a-field"><label>الوصف</label><textarea name="description" className="a-textarea" placeholder="مكونات الحلا…" defaultValue={item?.description ?? ""} /></div>
              <div className="a-field"><label>السعرات الحرارية</label><input name="cal" className="a-input" inputMode="numeric" placeholder="540" defaultValue={item?.cal ?? ""} /></div>
            </>
          )}

          {/* coffee-only: tasting notes + origin spec sheet + emblem */}
          {template === "coffee" && (
            <>
              <div className="a-field"><label>الإيحاءات <span style={{ color: "var(--faint)", fontWeight: 400 }}>(افصل بفاصلة)</span></label><input name="notes" className="a-input" placeholder="شوكولاتة، كراميل، فواكه" defaultValue={item?.notes?.join("، ") ?? ""} /></div>
              <div className="a-row-2">
                <div className="a-field"><label>السلالة</label><input name="variety" className="a-input" placeholder="تيبيكا" defaultValue={item?.variety ?? ""} /></div>
                <div className="a-field"><label>الارتفاع</label><input name="altitude" className="a-input" placeholder="2000 م" defaultValue={item?.altitude ?? ""} /></div>
              </div>
              <div className="a-field"><label>المعالجة</label><input name="process" className="a-input" placeholder="مجففة" defaultValue={item?.process ?? ""} /></div>
              <div className="a-field">
                <label>الشعار / علم المنشأ</label>
                <ImagePicker current={item?.emblem_url ?? null} fileName="emblem" urlName="emblem_url" label="ارفع علماً/شعاراً" hint="يظهر كميدالية على بطاقة القهوة." />
                <input type="hidden" name="emblem_fit" value={item?.emblem_fit ?? "cover"} />
              </div>
            </>
          )}

          {/* photo — every template (coffee origins usually use the emblem instead) */}
          <div className="a-field">
            <label>الصورة {template === "coffee" && <span style={{ color: "var(--faint)", fontWeight: 400 }}>(اختياري)</span>}</label>
            <ImagePicker current={item?.image_url ?? null} />
          </div>

          {/* visibility toggles */}
          <div className="a-check">
            <span className="lbl">متوفر <small>يظهر للزبائن في المنيو</small></span>
            <label className="a-switch"><input type="checkbox" name="is_available" defaultChecked={item ? item.is_available : true} /><span className="track" /><span className="thumb" /></label>
          </div>

          <details style={{ marginTop: 14 }}>
            <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 13.5, color: "var(--muted)", padding: "6px 0" }}>خيارات متقدمة</summary>
            <div className="a-field" style={{ marginTop: 10 }}><label>الترتيب داخل القسم</label><input name="sort_order" className="a-input" inputMode="numeric" defaultValue={item?.sort_order ?? 0} /></div>
          </details>

          <div className="a-sheet-foot">
            {item && (
              <button type="button" className="a-btn a-btn--danger"
                onClick={() => { if (confirm("حذف هذا الصنف؟")) start(() => { callAction(deleteItem, { id: item.id }); onClose(); }); }}>
                <Trash2 strokeWidth={2} />
              </button>
            )}
            <SaveBtn />
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── category add/edit sheet ── */
function CategorySheet({ cat, onClose }: { cat: Cat | null; onClose: () => void }) {
  const [, start] = useTransition();
  return (
    <div className="a-sheet-overlay" onClick={onClose}>
      <div className="a-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="a-sheet-grip" />
        <div className="a-sheet-head">
          <h2>{cat ? "تعديل قسم" : "قسم جديد"}</h2>
          <button type="button" className="a-iconbtn" onClick={onClose} aria-label="إغلاق"><X strokeWidth={2} /></button>
        </div>
        <form action={async (fd) => { await saveCategory(fd); onClose(); }}>
          {cat && <input type="hidden" name="id" value={cat.id} />}
          {cat && <input type="hidden" name="slug" value={cat.slug} />}
          <div className="a-row-2">
            <div className="a-field"><label>الاسم (عربي)</label><input name="name_ar" className="a-input" defaultValue={cat?.name_ar ?? ""} required /></div>
            <div className="a-field"><label>الاسم (إنجليزي)</label><input name="name_en" className="a-input" dir="ltr" defaultValue={cat?.name_en ?? ""} /></div>
          </div>
          <div className="a-row-2">
            <div className="a-field"><label>الرقم</label><input name="number" className="a-input" placeholder="01" defaultValue={cat?.number ?? ""} /></div>
            <div className="a-field"><label>الرمز (إيموجي)</label><input name="glyph" className="a-input" placeholder="☕" defaultValue={cat?.glyph ?? ""} /></div>
          </div>
          <div className="a-field">
            <label>نوع الأصناف</label>
            <select name="template" className="a-select" defaultValue={cat?.template ?? "simple"}>
              <option value="simple">مشروبات (اسم + سعر)</option>
              <option value="coffee">قهوة مختصة (إيحاءات + محصول)</option>
              <option value="dessert">حلا (وصف + سعرات)</option>
            </select>
            <p className="a-hint">يحدّد الحقول الظاهرة عند إضافة صنف في هذا القسم.</p>
          </div>
          <div className="a-field"><label>الوصف القصير</label><input name="tagline" className="a-input" defaultValue={cat?.tagline ?? ""} /></div>
          <div className="a-field"><label>ملاحظة (مثل تنبيه الحساسية)</label><input name="note" className="a-input" defaultValue={cat?.note ?? ""} /></div>
          <div className="a-row-2">
            <div className="a-field"><label>الترتيب</label><input name="sort_order" className="a-input" inputMode="numeric" defaultValue={cat?.sort_order ?? 0} /></div>
          </div>
          <div className="a-field"><label>صورة القسم</label><ImagePicker current={cat?.image_url ?? null} /></div>
          <div className="a-check">
            <span className="lbl">ظاهر <small>يظهر القسم في المنيو</small></span>
            <label className="a-switch"><input type="checkbox" name="is_active" defaultChecked={cat ? cat.is_active : true} /><span className="track" /><span className="thumb" /></label>
          </div>
          <div className="a-sheet-foot">
            {cat && (
              <button type="button" className="a-btn a-btn--danger"
                onClick={() => { if (confirm("حذف القسم وكل أصنافه؟")) start(() => { callAction(deleteCategory, { id: cat.id }); onClose(); }); }}>
                <Trash2 strokeWidth={2} />
              </button>
            )}
            <SaveBtn />
          </div>
        </form>
      </div>
    </div>
  );
}

export default function MenuManager({ menu }: { menu: { category: Cat; items: Itm[] }[] }) {
  const cats = menu.map((m) => m.category);
  const [itemSheet, setItemSheet] = useState<{ cat: string; item: Itm | null } | null>(null);
  const [catSheet, setCatSheet] = useState<{ cat: Cat | null } | null>(null);

  return (
    <>
      <div className="admin-page-head" style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1>المنيو</h1>
          <p>عدّل الأسعار، أوقف صنفاً نفد، أو أضف جديداً.</p>
        </div>
        <button className="a-iconbtn" onClick={() => setCatSheet({ cat: null })} aria-label="قسم جديد"><FolderPlus strokeWidth={2} /></button>
      </div>

      {menu.length === 0 && (
        <div className="a-empty">
          <span className="ico"><FolderPlus strokeWidth={1.6} /></span>
          <h3>لا توجد أقسام بعد</h3>
          <p>ابدأ بإضافة قسم ثم أصناف بداخله.</p>
        </div>
      )}

      {menu.map(({ category, items }) => (
        <div key={category.id} className="a-group">
          <div className="a-group-head">
            <span className="g-glyph">{category.glyph || "•"}</span>
            <h3>{category.name_ar}</h3>
            <span className="count">{items.length} صنف{!category.is_active ? " · مخفي" : ""}</span>
            <button className="a-iconbtn" onClick={() => setCatSheet({ cat: category })} aria-label="تعديل القسم"><Pencil strokeWidth={2} /></button>
          </div>
          <div className="a-rows">
            {items.map((it) => (
              <ItemRow key={it.id} item={it} onEdit={() => setItemSheet({ cat: category.id, item: it })} />
            ))}
            <button className="a-row" style={{ width: "100%", border: 0, background: "var(--surface-2)", cursor: "pointer", color: "var(--burgundy)", fontWeight: 600, justifyContent: "center", gap: 8 }}
              onClick={() => setItemSheet({ cat: category.id, item: null })}>
              <Plus strokeWidth={2.2} style={{ width: 18, height: 18 }} /> أضف صنفاً
            </button>
          </div>
        </div>
      ))}

      {itemSheet && <ItemSheet cats={cats} defaultCat={itemSheet.cat} item={itemSheet.item} onClose={() => setItemSheet(null)} />}
      {catSheet && <CategorySheet cat={catSheet.cat} onClose={() => setCatSheet(null)} />}
    </>
  );
}
