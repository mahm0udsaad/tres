"use client";

import { useFormStatus } from "react-dom";
import { Megaphone, Clock, Phone, AtSign, Music2, Ghost, Save } from "lucide-react";
import { saveSettings } from "../actions";

type Hours = { day: string; open?: string; close?: string; closed?: boolean }[];
type S = {
  hours: Hours; announcement: string | null; announcement_active: boolean;
  phone: string | null; address: string | null;
  instagram: string | null; tiktok: string | null; snapchat: string | null;
};

const DAYS = ["السبت", "الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];

function SaveBar() {
  const { pending } = useFormStatus();
  return (
    <div style={{ position: "sticky", bottom: "calc(var(--nav-h) + 12px)", marginTop: 22, zIndex: 5 }}>
      <button type="submit" className="a-btn a-btn--primary a-btn--block" disabled={pending}>
        <Save strokeWidth={2} /> {pending ? "جارٍ الحفظ…" : "حفظ التغييرات"}
      </button>
    </div>
  );
}

export default function SettingsForm({ settings }: { settings: S }) {
  const hours: Hours = DAYS.map((day, i) => settings.hours?.[i] ?? { day, open: "", close: "", closed: false });

  return (
    <form action={saveSettings}>
      {/* announcement */}
      <div className="a-section-title"><h2><Megaphone strokeWidth={2} style={{ width: 17, height: 17, verticalAlign: "-3px", marginInlineEnd: 6 }} />شريط الإعلان</h2></div>
      <div className="a-card a-card--pad">
        <div className="a-field">
          <label>نص الإعلان</label>
          <input name="announcement" className="a-input" defaultValue={settings.announcement ?? ""} placeholder="مثال: مفتوحين اليوم حتى 12 منتصف الليل ☕" />
          <p className="a-hint">يظهر كشريط أعلى الموقع عند تفعيله.</p>
        </div>
        <div className="a-check">
          <span className="lbl">إظهار الشريط</span>
          <label className="a-switch"><input type="checkbox" name="announcement_active" defaultChecked={settings.announcement_active} /><span className="track" /><span className="thumb" /></label>
        </div>
      </div>

      {/* hours */}
      <div className="a-section-title"><h2><Clock strokeWidth={2} style={{ width: 17, height: 17, verticalAlign: "-3px", marginInlineEnd: 6 }} />ساعات العمل</h2></div>
      <div className="a-card a-card--pad" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {hours.map((h, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input type="hidden" name="hour_day" value={DAYS[i]} />
            <span style={{ width: 64, fontWeight: 600, fontSize: 14 }}>{DAYS[i]}</span>
            <input name="hour_open" type="time" className="a-input" style={{ flex: 1, minHeight: 42 }} defaultValue={h.open || ""} />
            <span style={{ color: "var(--faint)" }}>—</span>
            <input name="hour_close" type="time" className="a-input" style={{ flex: 1, minHeight: 42 }} defaultValue={h.close || ""} />
            <label className="a-switch" aria-label="مغلق" title="مغلق">
              <input type="checkbox" name="hour_closed" value={i} defaultChecked={h.closed} />
              <span className="track" /><span className="thumb" />
            </label>
          </div>
        ))}
        <p className="a-hint">المفتاح الأخضر = اليوم مغلق.</p>
      </div>

      {/* contact + social */}
      <div className="a-section-title"><h2>التواصل والروابط</h2></div>
      <div className="a-card a-card--pad">
        <div className="a-field"><label><Phone strokeWidth={2} style={{ width: 15, height: 15, verticalAlign: "-2px", marginInlineEnd: 5 }} />الجوال</label><input name="phone" className="a-input" dir="ltr" inputMode="tel" defaultValue={settings.phone ?? ""} /></div>
        <div className="a-field"><label>العنوان</label><input name="address" className="a-input" defaultValue={settings.address ?? ""} /></div>
        <div className="a-field"><label><AtSign strokeWidth={2} style={{ width: 15, height: 15, verticalAlign: "-2px", marginInlineEnd: 5 }} />إنستغرام</label><input name="instagram" className="a-input" dir="ltr" defaultValue={settings.instagram ?? ""} /></div>
        <div className="a-field"><label><Music2 strokeWidth={2} style={{ width: 15, height: 15, verticalAlign: "-2px", marginInlineEnd: 5 }} />تيك توك</label><input name="tiktok" className="a-input" dir="ltr" defaultValue={settings.tiktok ?? ""} /></div>
        <div className="a-field" style={{ margin: 0 }}><label><Ghost strokeWidth={2} style={{ width: 15, height: 15, verticalAlign: "-2px", marginInlineEnd: 5 }} />سناب شات</label><input name="snapchat" className="a-input" dir="ltr" defaultValue={settings.snapchat ?? ""} /></div>
      </div>

      <SaveBar />
    </form>
  );
}
