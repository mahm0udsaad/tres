"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { CupSoda, X, Plus, ChevronUp, ChevronDown, Check, Save } from "lucide-react";
import { saveHome } from "../actions";

export type PickItem = { id: string; name_ar: string; name_en: string | null; price: number | null; image_url: string | null; emblem_url: string | null; category_ar: string };
export type SectionCfg = { kicker: string; title: string; desc: string; itemIds: string[] };

function Thumb({ it, cls }: { it?: PickItem; cls: string }) {
  const src = it?.image_url || it?.emblem_url;
  return <span className={cls}>{src ? <img src={src} alt="" /> : <CupSoda strokeWidth={1.6} style={{ width: 18, height: 18 }} />}</span>;
}

function PickerSheet({ all, selected, onToggle, onClose }: { all: PickItem[]; selected: string[]; onToggle: (id: string) => void; onClose: () => void }) {
  const groups = all.reduce<Record<string, PickItem[]>>((acc, it) => {
    (acc[it.category_ar] ??= []).push(it);
    return acc;
  }, {});
  return (
    <div className="a-sheet-overlay" onClick={onClose}>
      <div className="a-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="a-sheet-grip" />
        <div className="a-sheet-head">
          <h2>اختر المنتجات</h2>
          <button type="button" className="a-iconbtn" onClick={onClose} aria-label="إغلاق"><X strokeWidth={2} /></button>
        </div>
        {Object.entries(groups).map(([cat, items]) => (
          <div key={cat}>
            <div className="a-pickcat">{cat}</div>
            <div className="a-rows">
              {items.map((it) => {
                const on = selected.includes(it.id);
                return (
                  <button key={it.id} type="button" className="a-pickrow" data-on={on} onClick={() => onToggle(it.id)}>
                    <Thumb it={it} cls="thumb" />
                    <span className="nm">{it.name_ar}{it.name_en && <small dir="ltr">{it.name_en}</small>}</span>
                    {it.price != null && <span style={{ fontFamily: "var(--font-latin)", fontWeight: 700, color: "var(--burgundy)", fontSize: 13 }}>{it.price} ر.س</span>}
                    <span className="tick">{on && <Check strokeWidth={3} style={{ width: 14, height: 14 }} />}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <div className="a-sheet-foot">
          <button type="button" className="a-btn a-btn--primary" onClick={onClose}>تم ({selected.length})</button>
        </div>
      </div>
    </div>
  );
}

function SectionEditor({ k, label, cfg, byId, all }: { k: "today" | "best"; label: string; cfg: SectionCfg; byId: Map<string, PickItem>; all: PickItem[] }) {
  const [ids, setIds] = useState<string[]>(cfg.itemIds);
  const [pick, setPick] = useState(false);

  const toggle = (id: string) => setIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const move = (i: number, d: -1 | 1) => setIds((p) => {
    const n = [...p]; const j = i + d;
    if (j < 0 || j >= n.length) return p;
    [n[i], n[j]] = [n[j], n[i]]; return n;
  });

  return (
    <div className="a-card a-card--pad" style={{ marginBottom: 18 }}>
      <div className="a-section-title" style={{ marginTop: 0 }}><h2>{label}</h2></div>
      <input type="hidden" name={`${k}_items`} value={ids.join(",")} />
      <div className="a-row-2">
        <div className="a-field"><label>العنوان الفرعي (إنجليزي)</label><input name={`${k}_kicker`} className="a-input" dir="ltr" defaultValue={cfg.kicker} /></div>
        <div className="a-field"><label>العنوان</label><input name={`${k}_title`} className="a-input" defaultValue={cfg.title} required /></div>
      </div>
      <div className="a-field"><label>النص التعريفي</label><textarea name={`${k}_desc`} className="a-textarea" defaultValue={cfg.desc} /></div>

      <label style={{ display: "block", fontSize: 13.5, fontWeight: 600, marginBottom: 6 }}>المنتجات المعروضة</label>
      <div className="a-chips">
        {ids.length === 0 && <div className="a-chip-empty">لم تختر منتجات بعد.</div>}
        {ids.map((id, i) => {
          const it = byId.get(id);
          return (
            <div key={id} className="a-chip">
              <span className="ord">
                <button type="button" onClick={() => move(i, -1)} aria-label="أعلى"><ChevronUp strokeWidth={2} style={{ width: 16, height: 16 }} /></button>
                <button type="button" onClick={() => move(i, 1)} aria-label="أسفل"><ChevronDown strokeWidth={2} style={{ width: 16, height: 16 }} /></button>
              </span>
              <Thumb it={it} cls="thumb" />
              <span className="nm">{it?.name_ar ?? "—"}</span>
              {it?.price != null && <span className="pr">{it.price} ر.س</span>}
              <button type="button" className="rm" onClick={() => toggle(id)} aria-label="إزالة"><X strokeWidth={2.2} style={{ width: 17, height: 17 }} /></button>
            </div>
          );
        })}
      </div>
      <button type="button" className="a-btn a-btn--ghost a-btn--block" onClick={() => setPick(true)}>
        <Plus strokeWidth={2.2} /> اختر المنتجات
      </button>

      {pick && <PickerSheet all={all} selected={ids} onToggle={toggle} onClose={() => setPick(false)} />}
    </div>
  );
}

function SaveBar() {
  const { pending } = useFormStatus();
  return (
    <div style={{ position: "sticky", bottom: "calc(var(--nav-h) + 12px)", marginTop: 8, zIndex: 5 }}>
      <button type="submit" className="a-btn a-btn--primary a-btn--block" disabled={pending}>
        <Save strokeWidth={2} /> {pending ? "جارٍ الحفظ…" : "حفظ التغييرات"}
      </button>
    </div>
  );
}

export default function HomeEditor({ today, best, all }: { today: SectionCfg; best: SectionCfg; all: PickItem[] }) {
  const byId = new Map(all.map((i) => [i.id, i]));
  return (
    <form action={saveHome}>
      <SectionEditor k="today" label="خيارات تريس اليوم" cfg={today} byId={byId} all={all} />
      <SectionEditor k="best" label="الأكثر مبيعاً" cfg={best} byId={byId} all={all} />
      <SaveBar />
    </form>
  );
}
