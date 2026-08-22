"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Check,
  Clock3,
  ClipboardList,
  Copy,
  FileText,
  KeyRound,
  Eye,
  LogOut,
  Pencil,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import {
  NATIONALITIES,
  ROLE_LABELS,
  languageForNationality,
  normalizeStaffPhone,
  type StaffLanguage,
} from "../../lib/staff-shared";
import {
  createOwnerStaff,
  deleteOwnerStaff,
  endOwnerEmployeeShift,
  resetOwnerStaffPassword,
  updateOwnerStaff,
  updateOwnerStaffPhone,
  type TeamActionState,
} from "../team/actions";
import type {
  OwnerBranch,
  OwnerEmployeeMetric,
  OwnerStaffRow,
} from "./overview";
import {
  loadOwnerEmployeeDetails,
  type EmployeeDetailsResult,
} from "./team/actions";

const ROLES = [
  "manager",
  "supervisor",
  "employee",
  "cleaning_staff",
  "barista",
  "kitchen_manager",
] as const;

function timeParts(
  value: string | null,
  fallbackHour: number,
  fallbackPeriod: "AM" | "PM",
) {
  if (!value)
    return { hour: fallbackHour, minute: "00", period: fallbackPeriod };
  const [hourText, minute = "00"] = value.split(":");
  const hour24 = Number(hourText);
  return {
    hour: hour24 % 12 || 12,
    minute,
    period: (hour24 >= 12 ? "PM" : "AM") as "AM" | "PM",
  };
}

function ShiftTimeField({
  prefix,
  label,
  value,
  fallbackHour,
  fallbackPeriod,
}: {
  prefix: string;
  label: string;
  value?: string | null;
  fallbackHour: number;
  fallbackPeriod: "AM" | "PM";
}) {
  const parts = timeParts(value ?? null, fallbackHour, fallbackPeriod);
  const hour24 = (parts.hour % 12) + (parts.period === "PM" ? 12 : 0);
  const defaultValue = `${String(hour24).padStart(2, "0")}:${parts.minute.slice(0, 2)}`;
  return (
    <label className="owner-shift-time">
      <span>{label}</span>
      <span className="owner-shift-time-control">
        <Clock3 />
        <input
          name={prefix}
          type="time"
          step="300"
          defaultValue={defaultValue}
          required
          aria-label={`${label} الوردية`}
        />
      </span>
    </label>
  );
}

function displayShift(start: string | null, end: string | null) {
  if (!start || !end) return "لم يحدد";
  const format = (value: string) => {
    const parts = timeParts(value, 8, "AM");
    return `${parts.hour}:${parts.minute} ${parts.period}`;
  };
  return `${format(start)} — ${format(end)}`;
}

export default function OwnerStaffManager({
  branches,
  staff,
  metrics,
  openShiftEmployeeIds,
}: {
  branches: OwnerBranch[];
  staff: OwnerStaffRow[];
  metrics: OwnerEmployeeMetric[];
  /** Employees with an attendance row still open, of any date — a shift left
   *  running from a previous day locks them out of clocking in again. */
  openShiftEmployeeIds: string[];
}) {
  const activeStaff = staff.filter(
    (member) =>
      member.is_active && ROLES.includes(member.role as (typeof ROLES)[number]),
  );
  const [state, action, pending] = useActionState<
    TeamActionState | undefined,
    FormData
  >(createOwnerStaff, undefined);
  const [phone, setPhone] = useState("");
  const [nationality, setNationality] = useState("Saudi Arabia");
  const [language, setLanguage] = useState<StaffLanguage>(
    languageForNationality("Saudi Arabia"),
  );
  const [copied, setCopied] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(
    activeStaff.length === 0,
  );
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [employeeDetails, setEmployeeDetails] = useState<EmployeeDetailsResult | null>(null);
  const [detailsError, setDetailsError] = useState("");
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [editState, editAction, editing] = useActionState(
    updateOwnerStaff,
    undefined,
  );
  const [passwordState, passwordAction, resettingPassword] = useActionState(
    resetOwnerStaffPassword,
    undefined,
  );
  const [phoneState, phoneAction, updatingPhone] = useActionState(
    updateOwnerStaffPhone,
    undefined,
  );
  const [deleteState, deleteAction, deleting] = useActionState(
    deleteOwnerStaff,
    undefined,
  );
  const [deleteTarget, setDeleteTarget] = useState<OwnerStaffRow | null>(null);
  const [endShiftState, endShiftAction, endingShift] = useActionState(
    endOwnerEmployeeShift,
    undefined,
  );
  const openShifts = new Set(openShiftEmployeeIds);
  const credentials = state?.credentials;
  const selectedMember =
    activeStaff.find((member) => member.user_id === selectedMemberId) ?? null;
  const metricByUser = new Map(metrics.map((metric) => [metric.user_id, metric]));
  const selectedMetric = selectedMember
    ? metricByUser.get(selectedMember.user_id) ?? null
    : null;
  const selectedTasks = employeeDetails?.tasks ?? [];
  const selectedReports = employeeDetails?.reports ?? [];

  useEffect(() => {
    if (!selectedMemberId) {
      setEmployeeDetails(null);
      setDetailsError("");
      setDetailsLoading(false);
      return;
    }
    let cancelled = false;
    setEmployeeDetails(null);
    setDetailsError("");
    setDetailsLoading(true);
    void loadOwnerEmployeeDetails(selectedMemberId).then((result) => {
      if (cancelled) return;
      setDetailsLoading(false);
      if (result.error) setDetailsError(result.error);
      else setEmployeeDetails(result.data ?? { tasks: [], reports: [] });
    });
    return () => {
      cancelled = true;
    };
  }, [selectedMemberId]);

  useEffect(() => {
    if (!deleteState?.message) return;
    setDeleteTarget(null);
    setSelectedMemberId(null);
  }, [deleteState?.message]);

  function copyCredentials() {
    if (!credentials) return;
    void navigator.clipboard
      ?.writeText(
        `الموظف: ${credentials.fullName}\nالجوال: ${credentials.phone}\nكلمة المرور: ${credentials.password}`,
      )
      .then(() => setCopied(true));
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="owner-staff-manager">
      <div className="owner-manager-toolbar">
        <div>
          <h2>متابعة الموظفين اليوم</h2>
          <p>المهام والاستراحة والحضور من سجلات اليوم الفعلية.</p>
        </div>
        <button
          type="button"
          className="staff-primary"
          onClick={() => setShowCreateForm((visible) => !visible)}
        >
          {showCreateForm ? <X /> : <UserPlus />}
          {showCreateForm ? "إغلاق النموذج" : "إضافة حساب"}
        </button>
      </div>
      {showCreateForm ? (
        <section className="staff-card staff-team-create">
          <div className="staff-card-head">
            <div>
              <h2>إضافة موظف أو حساب داشبورد</h2>
              <p>
                أدخل البيانات الأساسية. اختر «متابعة الداشبورد فقط» لإنشاء
                دخول مستقل للمتابعة بدون استخدام حساب المالك.
              </p>
            </div>
            <UserPlus className="staff-team-head-icon" />
          </div>
          {credentials ? (
            <div className="staff-team-credentials" role="status">
              <div className="staff-team-credentials-head">
                <KeyRound />
                <div>
                  <strong>بيانات دخول {credentials.fullName}</strong>
                  <p>احفظها الآن — لن تظهر مرة أخرى بعد مغادرة الصفحة.</p>
                </div>
              </div>
              <dl>
                <div>
                  <dt>رقم الجوال</dt>
                  <dd dir="ltr">{credentials.phone}</dd>
                </div>
                <div>
                  <dt>كلمة المرور المؤقتة</dt>
                  <dd dir="ltr">{credentials.password}</dd>
                </div>
              </dl>
              <button
                type="button"
                className="staff-secondary"
                onClick={copyCredentials}
              >
                {copied ? <Check /> : <Copy />}{" "}
                {copied ? "تم النسخ" : "نسخ البيانات"}
              </button>
            </div>
          ) : null}
          <form
            className="staff-form staff-team-form"
            action={(form) => startTransition(() => action(form))}
          >
            <label>
              <span>اسم الموظف</span>
              <input
                name="full_name"
                required
                maxLength={120}
                placeholder="مثال: أحمد السالم"
              />
            </label>
            <label>
              <span>الدور</span>
              <select name="role" defaultValue="employee">
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role === "manager" ? "متابعة الداشبورد فقط" : ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </label>
            <label className="staff-field-wide">
              <span>الفرع</span>
              <select
                name="branch_id"
                required
                defaultValue={branches[0]?.id ?? ""}
              >
                <option value="" disabled>
                  اختر الفرع
                </option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="staff-field-wide">
              <span>رقم الجوال لتسجيل الدخول</span>
              <input
                name="phone"
                type="tel"
                inputMode="tel"
                dir="ltr"
                required
                value={phone}
                onChange={(e) => setPhone(normalizeStaffPhone(e.target.value))}
                placeholder="+966 5X XXX XXXX"
              />
            </label>
            <label>
              <span>كلمة المرور (اختياري)</span>
              <input
                name="password"
                dir="ltr"
                minLength={8}
                autoComplete="off"
                placeholder="تُولَّد تلقائيًا"
              />
            </label>
            <label>
              <span>الجنسية</span>
              <select
                name="nationality"
                value={nationality}
                onChange={(e) => {
                  setNationality(e.target.value);
                  setLanguage(languageForNationality(e.target.value));
                }}
              >
                {NATIONALITIES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <input type="hidden" name="preferred_language" value={language} />
            <ShiftTimeField
              prefix="schedule_start"
              label="بداية الوردية"
              fallbackHour={8}
              fallbackPeriod="AM"
            />
            <ShiftTimeField
              prefix="schedule_end"
              label="نهاية الوردية"
              fallbackHour={4}
              fallbackPeriod="PM"
            />
            <div className="staff-field-wide">
              {state?.error ? (
                <p className="staff-form-error">{state.error}</p>
              ) : null}
              {state?.message && !state.error ? (
                <p className="staff-form-success">{state.message}</p>
              ) : null}
              <button
                type="submit"
                className="staff-primary"
                disabled={pending}
              >
                <UserPlus /> {pending ? "جارٍ الإنشاء…" : "إنشاء الحساب"}
              </button>
            </div>
          </form>
        </section>
      ) : null}
      <section className="staff-card staff-team-list">
        <div className="staff-card-head">
          <div>
            <h2>الموظفون</h2>
            <p>
              {activeStaff.length
                ? "اضغط «التفاصيل» لإدارة الحساب والوردية والمهام."
                : "ابدأ بإضافة أول موظف."}
            </p>
          </div>
          <span className="staff-team-count">{activeStaff.length}</span>
        </div>
        {deleteState?.error ? (
          <p className="staff-form-error">{deleteState.error}</p>
        ) : null}
        {deleteState?.message ? (
          <p className="staff-form-success">{deleteState.message}</p>
        ) : null}
        {activeStaff.length ? (
          <div className="owner-employee-table-wrap">
            <table className="owner-employee-table">
              <thead>
                <tr>
                  <th scope="col">الموظف</th>
                  <th scope="col">رقم الجوال</th>
                  <th scope="col">مهام اليوم</th>
                  <th scope="col">الاستراحة</th>
                  <th scope="col">حالة الوردية</th>
                  <th scope="col"><span className="sr-only">الإجراء</span></th>
                </tr>
              </thead>
              <tbody>
                {activeStaff.map((row) => {
                  const metric = metricByUser.get(row.user_id);
                  const shiftStatus = metric?.shift_status ?? "not_started";
                  const breakStatus = metric?.break_status ?? "not_taken";
                  return (
                    <tr key={row.user_id}>
                      <td data-label="الموظف">
                        <span className="owner-employee-identity">
                          <strong>{row.name}</strong>
                          <small>{ROLE_LABELS[row.role]} · {row.branch_name ?? "بدون فرع"}</small>
                        </span>
                      </td>
                      <td data-label="رقم الجوال">
                        <b className="owner-employee-phone" dir="ltr">
                          {metric?.phone ?? "غير متوفر"}
                        </b>
                      </td>
                      <td data-label="مهام اليوم">
                        <span className="owner-table-number">
                          <b>{metric?.tasks_done ?? 0}</b>
                          <small>من {metric?.tasks_total ?? 0}</small>
                        </span>
                      </td>
                      <td data-label="الاستراحة">
                        <span className="owner-break-value" data-status={breakStatus}>
                          {breakStatus === "active"
                            ? `جارية · ${metric?.break_minutes ?? 0} د`
                            : breakStatus === "completed"
                              ? `${metric?.break_minutes ?? 0} دقيقة`
                              : "لم تؤخذ"}
                        </span>
                      </td>
                      <td data-label="حالة الوردية">
                        <span className="owner-shift-state" data-status={shiftStatus}>
                          {shiftStatus === "working"
                            ? "في الوردية"
                            : shiftStatus === "finished"
                              ? "أنهى الوردية"
                              : "لم يبدأ"}
                        </span>
                      </td>
                      <td data-label="الإجراء" className="owner-table-action-cell">
                        <button
                          type="button"
                          className="owner-details-button"
                          onClick={() => setSelectedMemberId(row.user_id)}
                          aria-label={`عرض تفاصيل ${row.name}`}
                        >
                          <Eye /> التفاصيل
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="staff-empty">لا يوجد موظفون مضافون بعد.</p>
        )}
      </section>
      {selectedMember ? (
        <div
          className="owner-member-modal-backdrop"
          role="presentation"
          onMouseDown={() => setSelectedMemberId(null)}
        >
          <section
            className="owner-member-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="member-details-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <h2 id="member-details-title">{selectedMember.name}</h2>
                <p>
                  {ROLE_LABELS[selectedMember.role]} ·{" "}
                  {selectedMember.branch_name ?? "بدون فرع"}
                </p>
              </div>
              <button
                type="button"
                className="staff-icon-button"
                onClick={() => setSelectedMemberId(null)}
                aria-label="إغلاق"
              >
                <X />
              </button>
            </header>
            <div className="owner-member-modal-stats">
              <span>
                مهام اليوم <b>{selectedMetric?.tasks_done ?? 0}/{selectedMetric?.tasks_total ?? 0}</b>
              </span>
              <span>
                الاستراحة <b>{selectedMetric?.break_minutes ?? 0} د</b>
              </span>
              <span>
                الورديات <b>{selectedMember.shifts}</b>
              </span>
              <span>
                الالتزام{" "}
                <b>
                  {selectedMember.shifts
                    ? `${Math.round((selectedMember.on_time_shifts / selectedMember.shifts) * 100)}٪`
                    : "—"}
                </b>
              </span>
              <span>
                النقاط <b>{selectedMember.points}</b>
              </span>
            </div>
            <section className="owner-member-task-picker">
              <h3>
                <Pencil /> تعديل بيانات الموظف
              </h3>
              <form
                key={`edit-${selectedMember.user_id}`}
                className="staff-form"
                action={(form) => startTransition(() => editAction(form))}
              >
                <input
                  type="hidden"
                  name="employee_id"
                  value={selectedMember.user_id}
                />
                <label>
                  <span>اسم الموظف</span>
                  <input
                    name="full_name"
                    defaultValue={selectedMember.name}
                    required
                    maxLength={120}
                  />
                </label>
                <label>
                  <span>الدور</span>
                  <select name="role" defaultValue={selectedMember.role}>
                    {ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role === "manager" ? "متابعة الداشبورد فقط" : ROLE_LABELS[role]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>الفرع</span>
                  <select
                    name="branch_id"
                    defaultValue={selectedMember.branch_id ?? ""}
                    required
                  >
                    <option value="" disabled>
                      اختر الفرع
                    </option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>الجنسية</span>
                  <select
                    name="nationality"
                    defaultValue={selectedMember.nationality}
                  >
                    {NATIONALITIES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <ShiftTimeField
                  prefix="schedule_start"
                  label="بداية الوردية"
                  value={selectedMember.scheduled_start}
                  fallbackHour={8}
                  fallbackPeriod="AM"
                />
                <ShiftTimeField
                  prefix="schedule_end"
                  label="نهاية الوردية"
                  value={selectedMember.scheduled_end}
                  fallbackHour={4}
                  fallbackPeriod="PM"
                />
                {editState?.error ? (
                  <p className="staff-form-error">{editState.error}</p>
                ) : null}
                {editState?.message ? (
                  <p className="staff-form-success">{editState.message}</p>
                ) : null}
                <button
                  type="submit"
                  className="staff-primary"
                  disabled={editing}
                >
                  {editing ? "جارٍ الحفظ…" : "حفظ التعديلات"}
                </button>
              </form>
            </section>
            <section className="owner-member-task-picker">
              <h3>
                <Users /> تغيير رقم الدخول
              </h3>
              <form
                key={`phone-${selectedMember.user_id}`}
                className="staff-form owner-single-line-form"
                action={(form) => startTransition(() => phoneAction(form))}
              >
                <input
                  type="hidden"
                  name="employee_id"
                  value={selectedMember.user_id}
                />
                <label>
                  <span>رقم الجوال الجديد</span>
                  <input
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    dir="ltr"
                    required
                    placeholder="+966 5X XXX XXXX"
                  />
                </label>
                {phoneState?.error ? (
                  <p className="staff-form-error">{phoneState.error}</p>
                ) : null}
                {phoneState?.message ? (
                  <p className="staff-form-success">{phoneState.message}</p>
                ) : null}
                <button
                  type="submit"
                  className="staff-primary"
                  disabled={updatingPhone}
                >
                  {updatingPhone ? "جارٍ التغيير…" : "تغيير رقم الدخول"}
                </button>
              </form>
            </section>
            <section className="owner-member-task-picker">
              <h3>
                <KeyRound /> تغيير كلمة مرور الموظف
              </h3>
              <form
                key={`password-${selectedMember.user_id}`}
                className="staff-form"
                action={(form) => startTransition(() => passwordAction(form))}
              >
                <input
                  type="hidden"
                  name="employee_id"
                  value={selectedMember.user_id}
                />
                <label>
                  <span>كلمة المرور الجديدة</span>
                  <input
                    name="new_password"
                    type="password"
                    minLength={8}
                    autoComplete="new-password"
                    required
                  />
                </label>
                <label>
                  <span>تأكيد كلمة المرور</span>
                  <input
                    name="new_password_confirmation"
                    type="password"
                    minLength={8}
                    autoComplete="new-password"
                    required
                  />
                </label>
                {passwordState?.error ? (
                  <p className="staff-form-error">{passwordState.error}</p>
                ) : null}
                {passwordState?.message ? (
                  <p className="staff-form-success">{passwordState.message}</p>
                ) : null}
                <button
                  type="submit"
                  className="staff-primary"
                  disabled={resettingPassword}
                >
                  {resettingPassword ? "جارٍ التغيير…" : "تغيير كلمة المرور"}
                </button>
              </form>
            </section>
            <section>
              <div className="owner-modal-section-head">
                <h3>
                  <ClipboardList /> مهام الموظف
                </h3>
                <Link
                  href={`/staff/checklist?employee=${selectedMember.user_id}`}
                >
                  إسناد مهمة
                </Link>
              </div>
              {detailsLoading ? (
                <p className="staff-empty">جارٍ تحميل سجل المهام…</p>
              ) : detailsError ? (
                <p className="staff-form-error">{detailsError}</p>
              ) : selectedTasks.length ? (
                <ul className="owner-member-list">
                  {selectedTasks.map((task) => (
                    <li key={task.id}>
                      <span>
                        <strong>{task.title}</strong>
                        <small>
                          {task.task_date} ·{" "}
                          {task.response_type === "yes_no"
                            ? "نعم أو لا"
                            : "إكمال"}
                        </small>
                        {task.employee_note ? (
                          <small className="owner-private-employee-note">
                            ملاحظة الموظف · للمالك فقط: {task.employee_note}
                          </small>
                        ) : null}
                      </span>
                      <b data-done={task.completed}>
                        {task.completed
                          ? task.response_type === "yes_no"
                            ? task.yes_no_answer
                              ? "نعم"
                              : "لا"
                            : "مكتملة"
                          : "قيد التنفيذ"}
                      </b>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="staff-empty">لا توجد مهام مسندة لهذا الموظف.</p>
              )}
            </section>
            <section>
              <div className="owner-modal-section-head">
                <h3>
                  <FileText /> التقارير الأخيرة
                </h3>
                <Link href="/staff/reports">فتح التقارير</Link>
              </div>
              {detailsLoading ? (
                <p className="staff-empty">جارٍ تحميل التقارير…</p>
              ) : detailsError ? (
                <p className="staff-form-error">{detailsError}</p>
              ) : selectedReports.length ? (
                <ul className="owner-member-list">
                  {selectedReports.map((report) => (
                    <li key={report.id}>
                      <span>
                        <strong>
                          {report.type} · {report.report_date}
                        </strong>
                        <small>{report.note}</small>
                        {report.employee_note ? (
                          <small className="owner-private-employee-note">
                            ملاحظة الموظف · للمالك فقط: {report.employee_note}
                          </small>
                        ) : null}
                      </span>
                      <b data-done={report.status === "confirmed"}>
                        {report.status === "recorded"
                          ? "مسجل"
                          : report.status === "confirmed"
                          ? "معتمد"
                          : report.status}
                      </b>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="staff-empty">لا توجد تقارير لهذا الموظف بعد.</p>
              )}
            </section>
            {openShifts.has(selectedMember.user_id) ? (
              <section className="owner-open-shift" aria-labelledby="end-shift-title">
                <div className="owner-danger-copy">
                  <span className="owner-open-shift-icon" aria-hidden="true">
                    <LogOut />
                  </span>
                  <div>
                    <h3 id="end-shift-title">وردية مفتوحة</h3>
                    <p>
                      لم يسجّل الموظف نهاية ورديته. لن يستطيع تسجيل حضور جديد قبل
                      إغلاقها.
                    </p>
                  </div>
                </div>
                {endShiftState?.error ? (
                  <p className="staff-form-error">{endShiftState.error}</p>
                ) : null}
                <form action={(form) => startTransition(() => endShiftAction(form))}>
                  <input type="hidden" name="employee_id" value={selectedMember.user_id} />
                  <input
                    type="hidden"
                    name="reason"
                    value="أنهى المالك الوردية من لوحة الموظفين"
                  />
                  <button type="submit" className="staff-secondary" disabled={endingShift}>
                    <LogOut /> {endingShift ? "جارٍ الإنهاء…" : "إنهاء وردية الموظف"}
                  </button>
                </form>
              </section>
            ) : null}

            <section
              className="owner-danger-zone"
              aria-labelledby="remove-employee-title"
            >
              <div className="owner-danger-copy">
                <span className="owner-danger-icon" aria-hidden="true">
                  <Trash2 />
                </span>
                <div>
                  <h3 id="remove-employee-title">إزالة الحساب من الفريق</h3>
                  <p>يلغي دخوله ويحذفه من الفريق مع إبقاء التقارير والسجلات.</p>
                </div>
              </div>
              <button
                type="button"
                className="owner-danger-button"
                onClick={() => setDeleteTarget(selectedMember)}
                aria-haspopup="dialog"
              >
                <Trash2 /> حذف الموظف
              </button>
            </section>
          </section>
        </div>
      ) : null}
      {deleteTarget ? (
        <div
          className="owner-confirm-backdrop"
          role="presentation"
          onMouseDown={() => setDeleteTarget(null)}
        >
          <section
            className="owner-confirm-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-employee-title"
            aria-describedby="delete-employee-description"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <span className="owner-confirm-icon">
              <AlertTriangle />
            </span>
            <h2 id="delete-employee-title">حذف {deleteTarget.name}؟</h2>
            <p id="delete-employee-description">
              سيتم إيقاف دخول الموظف وحذفه من قائمة الفريق. ستبقى تقاريره وسجلات
              حضوره محفوظة للرجوع إليها.
            </p>
            {deleteState?.error ? (
              <p className="staff-form-error">{deleteState.error}</p>
            ) : null}
            <div className="owner-confirm-actions">
              <button
                type="button"
                className="staff-secondary"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                إلغاء
              </button>
              <form
                action={(form) => startTransition(() => deleteAction(form))}
              >
                <input
                  type="hidden"
                  name="employee_id"
                  value={deleteTarget.user_id}
                />
                <button
                  type="submit"
                  className="owner-danger-button"
                  disabled={deleting}
                >
                  <Trash2 /> {deleting ? "جارٍ الحذف…" : "نعم، احذف الموظف"}
                </button>
              </form>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
