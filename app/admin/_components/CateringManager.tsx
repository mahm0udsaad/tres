"use client";

/**
 * Catering packages — the prices the /catering page shows and the booking
 * WhatsApp message quotes. Deliberately the same shape as a menu item (photo,
 * name, price, what's included), so the owner edits it the way they already
 * edit the menu.
 */

import { useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Plus, Pencil, Trash2, X, PartyPopper } from "lucide-react";
import {
  saveCateringPackage, deleteCateringPackage, toggleCateringActive,
} from "../actions";
import type { AdminCateringPackage } from "../../lib/admin-data";

function SaveBtn({ label = "حفظ" }: { label?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="a-btn a-btn--primary" disabled={pending}>
      {pending ? "جارٍ الحفظ…" : label}
    </button>
  );
}

function Row({ pkg, onEdit }: { pkg: AdminCateringPackage; onEdit: () => void }) {
  const [active, setActive] = useState(pkg.is_active);
  const [, start] = useTransition();
  return (
    <div className="a-row" data-off={!active}>
      <span className="a-row-thumb">
        {pkg.image_url ? <img src={pkg.image_url} alt="" /> : "🎉"}
      </span>
      <div className="a-row-main">
        <div className="a-row-name">
          {pkg.name_ar}
          {pkg.badge && <span className="a-pill a-pill--badge">{pkg.badge}</span>}
        </div>
        <div className="a-row-sub">
          {pkg.price != null && (
            <span className="a-row-price">{pkg.price} ر.س {pkg.unit ?? ""}</span>
          )}
          {pkg.serves && <span>{pkg.serves}</span>}
        </div>
      </div>
      <div className="a-row-actions">
        <label className="a-switch" aria-label="معروض">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => {
              const v = e.target.checked;
              setActive(v);
              const fd = new FormData();
              fd.set("id", pkg.id);
              fd.set("value", v ? "1" : "");
              start(() => { toggleCateringActive(fd); });
            }}
          />
          <span className="track" /><span className="thumb" />
        </label>
        <button type="button" className="a-iconbtn" onClick={onEdit} aria-label="تعديل">
          <Pencil strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

function Editor({ pkg, onClose }: { pkg: AdminCateringPackage | null; onClose: () => void }) {
  return (
    <div className="a-sheet-overlay" onClick={onClose}>
      <div className="a-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="a-sheet-grip" />
        <div className="a-sheet-head">
          <h2>{pkg ? "تعديل الباقة" : "باقة جديدة"}</h2>
          <button type="button" className="a-iconbtn" onClick={onClose} aria-label="إغلاق">
            <X strokeWidth={2} />
          </button>
        </div>
        <form action={saveCateringPackage}>
          {pkg && <input type="hidden" name="id" value={pkg.id} />}
          <input type="hidden" name="image_url" value={pkg?.image_url ?? ""} />
          <div className="a-row-2">
            <div className="a-field">
              <label>اسم الباقة</label>
              <input name="name_ar" className="a-input" required defaultValue={pkg?.name_ar ?? ""} />
            </div>
            <div className="a-field">
              <label>بالإنجليزي</label>
              <input name="name_en" className="a-input" dir="ltr" defaultValue={pkg?.name_en ?? ""} />
            </div>
          </div>
          <div className="a-row-2">
            <div className="a-field">
              <label>السعر</label>
              <input name="price" className="a-input" inputMode="decimal" defaultValue={pkg?.price ?? ""} />
            </div>
            <div className="a-field">
              <label>الوحدة</label>
              <input name="unit" className="a-input" placeholder="للشخص / للصندوق" defaultValue={pkg?.unit ?? ""} />
            </div>
          </div>
          <div className="a-row-2">
            <div className="a-field">
              <label>تكفي لـ</label>
              <input name="serves" className="a-input" placeholder="٢٠ ضيف فأكثر" defaultValue={pkg?.serves ?? ""} />
            </div>
            <div className="a-field">
              <label>وسم</label>
              <input name="badge" className="a-input" placeholder="الأكثر طلباً" defaultValue={pkg?.badge ?? ""} />
            </div>
          </div>
          <div className="a-field">
            <label>الوصف</label>
            <textarea name="description" className="a-textarea" defaultValue={pkg?.description ?? ""} />
          </div>
          <div className="a-field">
            <label>تشمل</label>
            <textarea
              name="includes"
              className="a-textarea"
              placeholder="كل سطر بند مستقل"
              defaultValue={(pkg?.includes ?? []).join("\n")}
            />
            <p className="a-hint">سطر لكل بند — تظهر كقائمة في صفحة الكاترينغ.</p>
          </div>
          <div className="a-field">
            <label>صورة الباقة</label>
            <input type="file" name="image" accept="image/*" className="a-input" />
          </div>
          <div className="a-row-2">
            <div className="a-field">
              <label>الترتيب</label>
              <input name="sort_order" className="a-input" inputMode="numeric" defaultValue={pkg?.sort_order ?? 0} />
            </div>
            <div className="a-check" style={{ alignSelf: "end", marginBottom: 14 }}>
              <span className="lbl">معروضة للزبائن</span>
              <label className="a-switch">
                <input type="checkbox" name="is_active" defaultChecked={pkg ? pkg.is_active : true} />
                <span className="track" /><span className="thumb" />
              </label>
            </div>
          </div>
          <div className="a-sheet-foot">
            {pkg && (
              <button
                type="submit"
                formAction={deleteCateringPackage}
                className="a-btn a-btn--danger"
                name="id"
                value={pkg.id}
              >
                <Trash2 strokeWidth={2} /> حذف
              </button>
            )}
            <span style={{ flex: 1 }} />
            <SaveBtn />
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CateringManager({ packages }: { packages: AdminCateringPackage[] }) {
  const [editing, setEditing] = useState<AdminCateringPackage | null | undefined>(undefined);

  return (
    <>
      <div className="admin-page-head">
        <h1>الكاترينغ</h1>
        <p>باقات الضيافة وأسعارها — تظهر في صفحة «حجز كاترينغ» مع زر الواتساب.</p>
      </div>

      <div className="a-section-title">
        <h2>الباقات</h2>
        <button type="button" className="a-btn a-btn--primary a-btn--sm" onClick={() => setEditing(null)}>
          <Plus strokeWidth={2} /> باقة
        </button>
      </div>

      {packages.length === 0 ? (
        <div className="a-empty">
          <span className="ico"><PartyPopper strokeWidth={1.6} /></span>
          <h3>لا توجد باقات</h3>
          <p>أضف أول باقة ضيافة ليبدأ عرض الأسعار في الموقع.</p>
        </div>
      ) : (
        <div className="a-card">
          {packages.map((p) => (
            <Row key={p.id} pkg={p} onEdit={() => setEditing(p)} />
          ))}
        </div>
      )}

      {editing !== undefined && <Editor pkg={editing} onClose={() => setEditing(undefined)} />}
    </>
  );
}
