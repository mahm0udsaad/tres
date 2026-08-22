import { CalendarDays, MapPin } from "lucide-react";
import { redirect } from "next/navigation";
import { requireStaff } from "../../../lib/staff";
import OwnerNavigation from "../OwnerNavigation";
import { loadOwnerOverview } from "../overview";
import AttendanceTable, { type AttendanceEmployee } from "./AttendanceTable";
import PrintAttendanceButton from "./PrintAttendanceButton";
import "./attendance.css";

export const dynamic = "force-dynamic";

type AttendanceRow = {
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
};

function validMonth(value: string | undefined) {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function currentMonth() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return `${year}-${month}`;
}

function nextMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return monthNumber === 12
    ? `${year + 1}-01`
    : `${year}-${String(monthNumber + 1).padStart(2, "0")}`;
}

function minutesWorked(row: AttendanceRow) {
  if (!row.end_time) return null;
  const start = new Date(row.start_time).getTime();
  const end = new Date(row.end_time).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  const grossMinutes = Math.round((end - start) / 60_000);
  // A single cafe shift cannot credibly span multiple days. Keep the raw
  // timestamps in the detail modal, but exclude corrupted/stale durations from
  // payroll-like totals rather than presenting fabricated hours to the owner.
  if (grossMinutes > 18 * 60) return null;

  let breakMinutes = Math.max(0, row.break_duration_minutes || 0);
  if (row.break_started_at && !row.break_ended_at) {
    breakMinutes += Math.max(0, Math.floor((end - new Date(row.break_started_at).getTime()) / 60_000));
  }
  return Math.max(0, grossMinutes - breakMinutes);
}

export default async function OwnerAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { profile, supabase } = await requireStaff();
  if (profile.role !== "owner") redirect("/staff");

  const query = await searchParams;
  const month = validMonth(query.month) ? query.month! : currentMonth();
  const [overviewResult, attendanceResult] = await Promise.all([
    loadOwnerOverview(supabase, 31),
    supabase
      .from("attendance_records")
      .select("id,user_id,shift_date,start_time,end_time,status,on_time,break_started_at,break_ended_at,break_duration_minutes")
      .gte("shift_date", `${month}-01`)
      .lt("shift_date", `${nextMonth(month)}-01`)
      .order("shift_date", { ascending: false })
      .order("start_time", { ascending: false }),
  ]);
  const { overview, error: overviewError } = overviewResult;
  const employees = (overview?.staff ?? []).filter(
    (employee) => employee.is_active && employee.uses_attendance,
  );
  const employeeIds = new Set(employees.map((employee) => employee.user_id));
  const attendance = ((attendanceResult.data ?? []) as AttendanceRow[]).filter(
    (row) => employeeIds.has(row.user_id),
  );
  const rowsByEmployee = new Map<string, AttendanceRow[]>();
  for (const row of attendance) {
    const rows = rowsByEmployee.get(row.user_id) ?? [];
    rows.push(row);
    rowsByEmployee.set(row.user_id, rows);
  }
  const timeZoneByBranch = new Map(
    (overview?.branches ?? []).map((branch) => [branch.id, branch.timezone]),
  );
  const now = Date.now();
  const tableEmployees: AttendanceEmployee[] = employees.map((employee) => {
    const rows = rowsByEmployee.get(employee.user_id) ?? [];
    const timeZone = employee.branch_id
      ? timeZoneByBranch.get(employee.branch_id) ?? "Asia/Riyadh"
      : "Asia/Riyadh";
    const branchToday = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(now));
    const shifts = rows.map((row) => {
      const workedMinutes = minutesWorked(row);
      return {
        ...row,
        worked_minutes: workedMinutes,
        is_current: row.status === "active" && row.shift_date === branchToday,
        duration_issue: Boolean(row.end_time && workedMinutes === null),
      };
    });
    const onTime = rows.filter((row) => row.on_time).length;
    const active = shifts.filter((row) => row.is_current).length;
    const completed = shifts.filter((row) => row.worked_minutes !== null);
    const totalMinutes = completed.reduce((total, row) => total + (row.worked_minutes ?? 0), 0);
    return {
      user_id: employee.user_id,
      name: employee.name,
      role: employee.role,
      branch_name: employee.branch_name ?? "Tres Primary",
      time_zone: timeZone,
      scheduled_start: employee.scheduled_start,
      scheduled_end: employee.scheduled_end,
      shifts_count: rows.length,
      on_time_count: onTime,
      late_count: rows.length - onTime,
      active_count: active,
      incomplete_count: shifts.filter((row) => row.worked_minutes === null).length,
      issue_count: shifts.filter((row) => row.duration_issue).length,
      total_minutes: totalMinutes,
      average_minutes: completed.length ? Math.round(totalMinutes / completed.length) : 0,
      last_shift_date: rows[0]?.shift_date ?? null,
      shifts,
    };
  });
  const monthLabel = new Intl.DateTimeFormat("ar-SA", {
    calendar: "gregory",
    month: "long",
    year: "numeric",
  }).format(new Date(`${month}-01T12:00:00Z`));
  const generatedLabel = new Intl.DateTimeFormat("ar-SA", {
    calendar: "gregory",
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Riyadh",
  }).format(new Date(now));
  const loadError = overviewError ?? attendanceResult.error?.message ?? null;

  return (
    <main className="staff-content owner-attendance-page">
      <div className="owner-attendance-screen-only">
        <OwnerNavigation variant="bar" />
        <section className="staff-welcome owner-attendance-heading">
          <div>
            <h1>سجل حضور الموظفين</h1>
            <p>جدول واحد لكل الموظفين. اضغط على الاسم لعرض الملخص والتفاصيل.</p>
          </div>
          <div className="staff-branch-pill">
            <MapPin /> {overview?.branches.length ?? 0} فروع
          </div>
        </section>

        <form className="owner-attendance-filters" method="get">
          <label>
            <span><CalendarDays /> الشهر</span>
            <input name="month" type="month" defaultValue={month} />
          </label>
          <button type="submit">عرض الشهر</button>
          <PrintAttendanceButton />
        </form>
      </div>

      {loadError ? (
        <p className="staff-form-error owner-attendance-screen-only">
          تعذّر تحميل سجل الحضور: {loadError}
        </p>
      ) : null}

      <section className="owner-attendance-print-header">
        <strong>TRES COFFEE ROASTERS</strong>
        <div>
          <h1>جدول حضور الموظفين</h1>
          <p>{monthLabel}</p>
        </div>
        <small>تم التصدير: {generatedLabel}</small>
      </section>

      <AttendanceTable employees={tableEmployees} monthLabel={monthLabel} />
    </main>
  );
}
