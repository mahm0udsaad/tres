"use client";

import { startTransition, useActionState, useState } from "react";
import { Check, Clock3, ClipboardList, Copy, FileText, KeyRound, UserPlus, Users, X } from "lucide-react";
import {
  LANGUAGE_LABELS,
  NATIONALITIES,
  ROLE_LABELS,
  STAFF_LANGUAGES,
  languageForNationality,
  normalizeStaffPhone,
  type StaffLanguage,
} from "../../lib/staff-shared";
import { createOwnerStaff, resetOwnerStaffPassword, setOwnerStaffSchedule, type TeamActionState } from "../team/actions";
import type { OwnerBranch, OwnerStaffRow } from "./overview";

const ROLES = ["supervisor", "employee", "cleaning_staff", "barista", "kitchen_manager"] as const;

type EmployeeTask = { id: string; user_id: string; task_date: string; title: string; completed: boolean; is_required: boolean; response_type: "completion" | "yes_no"; yes_no_answer: boolean | null };
type EmployeeReport = { id: string; submitted_by: string; report_date: string; status: string; created_at: string; type: string; note: string };

function timeParts(value: string | null, fallbackHour: number, fallbackPeriod: "AM" | "PM") {
  if (!value) return { hour: fallbackHour, minute: "00", period: fallbackPeriod };
  const [hourText, minute = "00"] = value.split(":");
  const hour24 = Number(hourText);
  return { hour: hour24 % 12 || 12, minute, period: (hour24 >= 12 ? "PM" : "AM") as "AM" | "PM" };
}

function ShiftTimeField({ prefix, label, value, fallbackHour, fallbackPeriod }: { prefix: string; label: string; value?: string | null; fallbackHour: number; fallbackPeriod: "AM" | "PM" }) {
  const parts = timeParts(value ?? null, fallbackHour, fallbackPeriod);
  return <fieldset className="owner-shift-time"><legend>{label}</legend><select name={`${prefix}_hour`} defaultValue={String(parts.hour)} aria-label={`${label} الساعة`}>{Array.from({ length: 12 }, (_, index) => index + 1).map((hour) => <option key={hour} value={hour}>{String(hour).padStart(2, "0")}</option>)}</select><span>:</span><select name={`${prefix}_minute`} defaultValue={parts.minute} aria-label={`${label} الدقائق`}>{["00", "15", "30", "45"].map((minute) => <option key={minute} value={minute}>{minute}</option>)}</select><select name={`${prefix}_period`} defaultValue={parts.period} aria-label={`${label} الفترة`}><option value="AM">AM</option><option value="PM">PM</option></select></fieldset>;
}

function displayShift(start: string | null, end: string | null) {
  if (!start || !end) return "لم يحدد";
  const format = (value: string) => { const parts = timeParts(value, 8, "AM"); return `${parts.hour}:${parts.minute} ${parts.period}`; };
  return `${format(start)} — ${format(end)}`;
}

export default function OwnerStaffManager({ branches, staff, tasks, reports }: { branches: OwnerBranch[]; staff: OwnerStaffRow[]; tasks: EmployeeTask[]; reports: EmployeeReport[] }) {
  const [state, action, pending] = useActionState<TeamActionState | undefined, FormData>(createOwnerStaff, undefined);
  const [phone, setPhone] = useState("");
  const [nationality, setNationality] = useState("Saudi Arabia");
  const [language, setLanguage] = useState<StaffLanguage>(languageForNationality("Saudi Arabia"));
  const [copied, setCopied] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [scheduleState, scheduleAction, scheduling] = useActionState(setOwnerStaffSchedule, undefined);
  const [passwordState, passwordAction, resettingPassword] = useActionState(resetOwnerStaffPassword, undefined);
  const credentials = state?.credentials;
  const selectedMember = staff.find((member) => member.user_id === selectedMemberId) ?? null;
  const selectedTasks = selectedMember ? tasks.filter((task) => task.user_id === selectedMember.user_id) : [];
  const selectedReports = selectedMember ? reports.filter((report) => report.submitted_by === selectedMember.user_id).slice(0, 8) : [];

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
          <ShiftTimeField prefix="schedule_start" label="بداية الوردية" fallbackHour={8} fallbackPeriod="AM" />
          <ShiftTimeField prefix="schedule_end" label="نهاية الوردية" fallbackHour={4} fallbackPeriod="PM" />
          <div className="staff-field-wide">{state?.error ? <p className="staff-form-error">{state.error}</p> : null}{state?.message && !state.error ? <p className="staff-form-success">{state.message}</p> : null}<button type="submit" className="staff-primary" disabled={pending}><UserPlus /> {pending ? "جارٍ الإنشاء…" : "إنشاء الحساب"}</button></div>
        </form>
      </section>
      <section className="staff-card staff-team-list"><div className="staff-card-head"><div><p className="staff-eyebrow">DIRECTORY</p><h2>الفريق الحالي</h2><p>اضغط على الموظف لتعديل وقت ورديته وعرض بياناته.</p></div><span className="staff-team-count">{staff.length}</span></div>{staff.length ? <ul className="staff-team-members">{staff.map((row) => <li key={row.user_id}><div className="staff-team-member-row"><div className="staff-team-member-info"><strong>{row.name}</strong><span>{ROLE_LABELS[row.role]} · {row.branch_name ?? "بدون فرع"} · {displayShift(row.scheduled_start, row.scheduled_end)}</span></div><div className="owner-member-controls"><span className="owner-status" data-status={row.status_today}>{row.is_active ? "نشط" : "معطل"}</span><button type="button" className="staff-team-toggle" onClick={() => setSelectedMemberId(row.user_id)}><Users /> التفاصيل</button></div></div></li>)}</ul> : <p className="staff-empty">لا يوجد موظفون مضافون بعد.</p>}</section>
      {selectedMember ? <div className="owner-member-modal-backdrop" role="presentation" onMouseDown={() => setSelectedMemberId(null)}><section className="owner-member-modal" role="dialog" aria-modal="true" aria-labelledby="member-details-title" onMouseDown={(event) => event.stopPropagation()}><header><div><p className="staff-eyebrow">EMPLOYEE ACCOUNT</p><h2 id="member-details-title">{selectedMember.name}</h2><p>{ROLE_LABELS[selectedMember.role]} · {selectedMember.branch_name ?? "بدون فرع"}</p></div><button type="button" className="staff-icon-button" onClick={() => setSelectedMemberId(null)} aria-label="إغلاق"><X /></button></header><div className="owner-member-modal-stats"><span>الورديات <b>{selectedMember.shifts}</b></span><span>الالتزام <b>{selectedMember.shifts ? `${Math.round((selectedMember.on_time_shifts / selectedMember.shifts) * 100)}٪` : "—"}</b></span><span>النقاط <b>{selectedMember.points}</b></span></div><section className="owner-member-task-picker"><h3><Clock3 /> وقت الوردية</h3><form key={`schedule-${selectedMember.user_id}`} className="staff-form" action={(form) => startTransition(() => scheduleAction(form))}><input type="hidden" name="employee_id" value={selectedMember.user_id} /><ShiftTimeField prefix="schedule_start" label="من" value={selectedMember.scheduled_start} fallbackHour={8} fallbackPeriod="AM" /><ShiftTimeField prefix="schedule_end" label="إلى" value={selectedMember.scheduled_end} fallbackHour={4} fallbackPeriod="PM" />{scheduleState?.error ? <p className="staff-form-error">{scheduleState.error}</p> : null}{scheduleState?.message ? <p className="staff-form-success">{scheduleState.message}</p> : null}<button type="submit" className="staff-primary" disabled={scheduling}>{scheduling ? "جارٍ الحفظ…" : "حفظ وقت الوردية"}</button></form></section><section className="owner-member-task-picker"><h3><KeyRound /> تغيير كلمة مرور الموظف</h3><form key={`password-${selectedMember.user_id}`} className="staff-form" action={(form) => startTransition(() => passwordAction(form))}><input type="hidden" name="employee_id" value={selectedMember.user_id} /><label><span>كلمة المرور الجديدة</span><input name="new_password" type="password" minLength={8} autoComplete="new-password" required /></label><label><span>تأكيد كلمة المرور</span><input name="new_password_confirmation" type="password" minLength={8} autoComplete="new-password" required /></label>{passwordState?.error ? <p className="staff-form-error">{passwordState.error}</p> : null}{passwordState?.message ? <p className="staff-form-success">{passwordState.message}</p> : null}<button type="submit" className="staff-primary" disabled={resettingPassword}>{resettingPassword ? "جارٍ التغيير…" : "تغيير كلمة المرور"}</button></form></section><section><h3><ClipboardList /> مهام الموظف</h3>{selectedTasks.length ? <ul className="owner-member-list">{selectedTasks.map((task) => <li key={task.id}><span><strong>{task.title}</strong><small>{task.task_date} · {task.response_type === "yes_no" ? "نعم أو لا" : "إكمال"}</small></span><b data-done={task.completed}>{task.completed ? task.response_type === "yes_no" ? (task.yes_no_answer ? "نعم" : "لا") : "مكتملة" : "قيد التنفيذ"}</b></li>)}</ul> : <p className="staff-empty">لا توجد مهام مسندة لهذا الموظف.</p>}</section><section><h3><FileText /> التقارير الأخيرة</h3>{selectedReports.length ? <ul className="owner-member-list">{selectedReports.map((report) => <li key={report.id}><span><strong>{report.type} · {report.report_date}</strong><small>{report.note}</small></span><b data-done={report.status === "confirmed"}>{report.status === "confirmed" ? "معتمد" : report.status}</b></li>)}</ul> : <p className="staff-empty">لا توجد تقارير لهذا الموظف بعد.</p>}</section></section></div> : null}
    </div>
  );
}
