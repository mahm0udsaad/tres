"use client";

import { startTransition, useActionState, useState } from "react";
import { Check, Copy, KeyRound, UserPlus } from "lucide-react";
import {
  LANGUAGE_LABELS,
  NATIONALITIES,
  ROLE_LABELS,
  STAFF_LANGUAGES,
  languageForNationality,
  normalizeStaffPhone,
  type StaffLanguage,
} from "../../lib/staff-shared";
import { createOwnerStaff, type TeamActionState } from "../team/actions";
import type { OwnerBranch, OwnerStaffRow } from "./overview";

const ROLES = ["supervisor", "employee", "cleaning_staff", "barista", "kitchen_manager"] as const;

export default function OwnerStaffManager({ branches, staff }: { branches: OwnerBranch[]; staff: OwnerStaffRow[] }) {
  const [state, action, pending] = useActionState<TeamActionState | undefined, FormData>(createOwnerStaff, undefined);
  const [phone, setPhone] = useState("");
  const [nationality, setNationality] = useState("Saudi Arabia");
  const [language, setLanguage] = useState<StaffLanguage>(languageForNationality("Saudi Arabia"));
  const [copied, setCopied] = useState(false);
  const credentials = state?.credentials;

  function copyCredentials() {
    if (!credentials) return;
    void navigator.clipboard?.writeText(`الموظف: ${credentials.fullName}\nالجوال: ${credentials.phone}\nكلمة المرور: ${credentials.password}`)
      .then(() => setCopied(true));
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="owner-staff-manager">
      <section className="staff-card staff-team-create">
        <div className="staff-card-head"><div><p className="staff-eyebrow">OWNER ACCESS</p><h2>إنشاء حساب موظف أو مشرف</h2></div><UserPlus className="staff-team-head-icon" /></div>
        {credentials ? <div className="staff-team-credentials" role="status"><div className="staff-team-credentials-head"><KeyRound /><div><strong>بيانات دخول {credentials.fullName}</strong><p>احفظها الآن — لن تظهر مرة أخرى بعد مغادرة الصفحة.</p></div></div><dl><div><dt>رقم الجوال</dt><dd dir="ltr">{credentials.phone}</dd></div><div><dt>كلمة المرور المؤقتة</dt><dd dir="ltr">{credentials.password}</dd></div></dl><button type="button" className="staff-secondary" onClick={copyCredentials}>{copied ? <Check /> : <Copy />} {copied ? "تم النسخ" : "نسخ البيانات"}</button></div> : null}
        <form className="staff-form staff-team-form" action={(form) => startTransition(() => action(form))}>
          <label><span>اسم الموظف</span><input name="full_name" required maxLength={120} placeholder="مثال: أحمد السالم" /></label>
          <label><span>الدور</span><select name="role" defaultValue="employee">{ROLES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select></label>
          <label className="staff-field-wide"><span>الفرع</span><select name="branch_id" required defaultValue={branches[0]?.id ?? ""}><option value="" disabled>اختر الفرع</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
          <label className="staff-field-wide"><span>رقم الجوال لتسجيل الدخول</span><input name="phone" type="tel" inputMode="tel" dir="ltr" required value={phone} onChange={(e) => setPhone(normalizeStaffPhone(e.target.value))} placeholder="+966 5X XXX XXXX" /></label>
          <label><span>كلمة المرور (اختياري)</span><input name="password" dir="ltr" minLength={8} autoComplete="off" placeholder="تُولَّد تلقائيًا" /></label>
          <label><span>الجنسية</span><select name="nationality" value={nationality} onChange={(e) => { setNationality(e.target.value); setLanguage(languageForNationality(e.target.value)); }}>{NATIONALITIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label><span>لغة لوحة الموظف</span><input type="hidden" name="preferred_language" value={language} /><select value={language} disabled>{STAFF_LANGUAGES.map((code) => <option key={code} value={code}>{LANGUAGE_LABELS[code]}</option>)}</select></label>
          <label><span>بداية الدوام (اختياري)</span><input name="scheduled_start" type="time" /></label>
          <div className="staff-field-wide">{state?.error ? <p className="staff-form-error">{state.error}</p> : null}{state?.message && !state.error ? <p className="staff-form-success">{state.message}</p> : null}<button type="submit" className="staff-primary" disabled={pending}><UserPlus /> {pending ? "جارٍ الإنشاء…" : "إنشاء الحساب"}</button></div>
        </form>
      </section>
      <section className="staff-card staff-team-list"><div className="staff-card-head"><div><p className="staff-eyebrow">DIRECTORY</p><h2>الفريق الحالي</h2></div><span className="staff-team-count">{staff.length}</span></div>{staff.length ? <ul className="staff-team-members">{staff.map((row) => <li key={row.user_id}><div className="staff-team-member-row"><div className="staff-team-member-info"><strong>{row.name}</strong><span>{ROLE_LABELS[row.role]} · {row.branch_name ?? "بدون فرع"}</span></div><span className="owner-status" data-status={row.status_today}>{row.is_active ? "نشط" : "معطل"}</span></div></li>)}</ul> : <p className="staff-empty">لا يوجد موظفون مضافون بعد.</p>}</section>
    </div>
  );
}
