"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  CalendarCheck2,
  CheckCircle2,
  Clock3,
  Timer,
  UserRound,
  X,
} from "lucide-react";
import { ROLE_LABELS, type StaffRole } from "../../../lib/staff-shared";

export type AttendanceShift = {
  id: string;
  user_id: string;
  shift_date: string;
  start_time: string;
  end_time: string | null;
  status: "active" | "completed";
  on_time: boolean;
  break_started_at: string | null;
  break_ended_at: string | null;
  break_duration_minutes: number;
  worked_minutes: number | null;
  is_current: boolean;
  duration_issue: boolean;
};

export type AttendanceEmployee = {
  user_id: string;
  name: string;
  role: StaffRole;
  branch_name: string;
  time_zone: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  shifts_count: number;
  on_time_count: number;
  late_count: number;
  active_count: number;
  incomplete_count: number;
  issue_count: number;
  total_minutes: number;
  average_minutes: number;
  last_shift_date: string | null;
  shifts: AttendanceShift[];
};

function numberLabel(value: number) {
  return new Intl.NumberFormat("ar-SA").format(value);
}

function hoursLabel(minutes: number | null) {
  if (minutes === null) return "—";
  return new Intl.NumberFormat("ar-SA", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(minutes / 60);
}

function dateLabel(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ar-SA", {
    calendar: "gregory",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00Z`));
}

function timeLabel(value: string | null, timeZone: string, isCurrent = false) {
  if (!value) return isCurrent ? "جارية الآن" : "لا يوجد تسجيل خروج";
  return new Intl.DateTimeFormat("ar-SA", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function scheduleLabel(start: string | null, end: string | null) {
  if (!start || !end) return "غير محدد";
  return `${start.slice(0, 5)} - ${end.slice(0, 5)}`;
}

export default function AttendanceTable({
  employees,
  monthLabel,
}: {
  employees: AttendanceEmployee[];
  monthLabel: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = employees.find((employee) => employee.user_id === selectedId) ?? null;

  useEffect(() => {
    if (!selected) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedId(null);
    };
    document.addEventListener("keydown", close);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", close);
      document.body.style.overflow = "";
    };
  }, [selected]);

  return <>
    <section className="owner-attendance-table-card" aria-labelledby="attendance-table-title">
      <header>
        <div>
          <p className="staff-eyebrow">{monthLabel}</p>
          <h2 id="attendance-table-title">جميع الموظفين</h2>
          <span>اضغط على اسم الموظف لعرض ملخص حضوره اليومي.</span>
        </div>
        <strong>{numberLabel(employees.length)} موظفين</strong>
      </header>
      <div className="owner-attendance-table-scroll">
        <table>
          <thead>
            <tr>
              <th>الموظف</th>
              <th>الفرع</th>
              <th>الدوام المحدد</th>
              <th>الورديات</th>
              <th>في الموعد</th>
              <th>متأخر</th>
              <th>ساعات العمل</th>
              <th>متوسط الوردية</th>
              <th>آخر حضور</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => (
              <tr key={employee.user_id}>
                <td>
                  <button
                    type="button"
                    className="owner-attendance-name"
                    onClick={() => setSelectedId(employee.user_id)}
                    aria-label={`عرض حضور ${employee.name}`}
                  >
                    <span>{employee.name.slice(0, 1)}</span>
                    <span><b>{employee.name}</b><small>{ROLE_LABELS[employee.role]}</small></span>
                  </button>
                </td>
                <td>{employee.branch_name}</td>
                <td dir="ltr">{scheduleLabel(employee.scheduled_start, employee.scheduled_end)}</td>
                <td><b>{numberLabel(employee.shifts_count)}</b>{employee.active_count ? <small className="owner-attendance-live">وردية جارية</small> : employee.issue_count ? <small className="owner-attendance-missing">سجلات تحتاج مراجعة</small> : employee.incomplete_count ? <small className="owner-attendance-missing">سجل بلا خروج</small> : null}</td>
                <td><span className="owner-attendance-status" data-tone="good">{numberLabel(employee.on_time_count)}</span></td>
                <td><span className="owner-attendance-status" data-tone={employee.late_count ? "late" : "neutral"}>{numberLabel(employee.late_count)}</span></td>
                <td><b>{hoursLabel(employee.total_minutes)}</b> س</td>
                <td>{hoursLabel(employee.average_minutes)} س</td>
                <td>{dateLabel(employee.last_shift_date)}</td>
              </tr>
            ))}
            {!employees.length ? <tr><td colSpan={9} className="owner-attendance-empty">لا يوجد موظفون مسجلون في نظام الحضور.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </section>

    {selected ? (
      <div className="owner-attendance-modal-backdrop" role="presentation" onMouseDown={() => setSelectedId(null)}>
        <section className="owner-attendance-modal" role="dialog" aria-modal="true" aria-labelledby="attendance-summary-title" onMouseDown={(event) => event.stopPropagation()}>
          <header>
            <div className="owner-attendance-modal-person">
              <span><UserRound /></span>
              <div><p>{ROLE_LABELS[selected.role]}</p><h2 id="attendance-summary-title">{selected.name}</h2></div>
            </div>
            <button type="button" onClick={() => setSelectedId(null)} aria-label="إغلاق"><X /></button>
          </header>

          <div className="owner-attendance-modal-meta">
            <span><Building2 /> {selected.branch_name}</span>
            <span><Clock3 /> الدوام: <bdi>{scheduleLabel(selected.scheduled_start, selected.scheduled_end)}</bdi></span>
            <span><CalendarCheck2 /> {monthLabel}</span>
          </div>

          <div className="owner-attendance-summary-grid">
            <article><CalendarCheck2 /><span>الورديات المسجلة</span><strong>{numberLabel(selected.shifts_count)}</strong></article>
            <article data-tone="good"><CheckCircle2 /><span>في الموعد</span><strong>{numberLabel(selected.on_time_count)}</strong></article>
            <article data-tone="late"><Clock3 /><span>مرات التأخير</span><strong>{numberLabel(selected.late_count)}</strong></article>
            <article><Timer /><span>ساعات الورديات المكتملة</span><strong>{hoursLabel(selected.total_minutes)} س</strong></article>
          </div>

          <section className="owner-attendance-history">
            <div><h3>سجل الورديات</h3><span>{numberLabel(selected.shifts.length)} سجل</span></div>
            <div className="owner-attendance-history-scroll">
              <table>
                <thead><tr><th>التاريخ</th><th>الدخول</th><th>الخروج</th><th>العمل</th><th>الالتزام</th></tr></thead>
                <tbody>
                  {selected.shifts.map((shift) => <tr key={shift.id}>
                    <td>{dateLabel(shift.shift_date)}</td>
                    <td>{timeLabel(shift.start_time, selected.time_zone)}</td>
                    <td>{timeLabel(shift.end_time, selected.time_zone, shift.is_current)}</td>
                    <td>{shift.duration_issue ? <span className="owner-attendance-duration-issue">تحتاج مراجعة</span> : shift.worked_minutes === null ? "—" : `${hoursLabel(shift.worked_minutes)} س`}</td>
                    <td><span className="owner-attendance-status" data-tone={shift.on_time ? "good" : "late"}>{shift.on_time ? "في الموعد" : "متأخر"}</span></td>
                  </tr>)}
                  {!selected.shifts.length ? <tr><td colSpan={5} className="owner-attendance-empty">لا توجد سجلات في هذا الشهر.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </section>
        </section>
      </div>
    ) : null}
  </>;
}
