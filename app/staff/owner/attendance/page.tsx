import { CalendarDays, Clock3, MapPin, Users } from "lucide-react";
import { redirect } from "next/navigation";
import { requireStaff } from "../../../lib/staff";
import OwnerNavigation from "../OwnerNavigation";
import { loadOwnerOverview } from "../overview";
import PrintAttendanceButton from "./PrintAttendanceButton";
import "./attendance.css";

export const dynamic = "force-dynamic";

type AttendanceRow = {
  user_id: string;
  shift_date: string;
  start_time: string;
  end_time: string | null;
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

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("ar-SA", {
    calendar: "gregory",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00Z`));
}

function timeLabel(value: string | null, timeZone: string) {
  if (!value) return "لم تنتهِ الوردية";
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));
}

export default async function OwnerAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; employee?: string }>;
}) {
  const { profile, supabase } = await requireStaff();
  if (profile.role !== "owner") redirect("/staff");

  const query = await searchParams;
  const month = validMonth(query.month) ? query.month! : currentMonth();
  const requestedEmployee =
    typeof query.employee === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(query.employee)
      ? query.employee
      : null;
  const overviewPromise = loadOwnerOverview(supabase, 31);
  const attendanceQuery = supabase
    .from("attendance_records")
    .select("user_id,shift_date,start_time,end_time")
    .gte("shift_date", `${month}-01`)
    .lt("shift_date", `${nextMonth(month)}-01`)
    .order("shift_date", { ascending: true })
    .order("start_time", { ascending: true });
  const [overviewResult, attendanceResult] = await Promise.all([
    overviewPromise,
    attendanceQuery,
  ]);
  const { overview, error: overviewError } = overviewResult;
  const employees = (overview?.staff ?? []).filter(
    (employee) => employee.is_active && employee.uses_attendance,
  );
  const selectedEmployee = employees.some(
    (employee) => employee.user_id === requestedEmployee,
  )
    ? requestedEmployee!
    : "all";
  const visibleEmployees = selectedEmployee === "all"
    ? employees
    : employees.filter((employee) => employee.user_id === selectedEmployee);

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
  const monthLabel = new Intl.DateTimeFormat("ar-SA", {
    calendar: "gregory",
    month: "long",
    year: "numeric",
  }).format(new Date(`${month}-01T12:00:00Z`));
  const loadError = overviewError ?? attendanceResult.error?.message ?? null;

  return (
    <main className="staff-content owner-attendance-page">
      <div className="owner-attendance-screen-only">
        <OwnerNavigation variant="bar" />
        <section className="staff-welcome owner-attendance-heading">
          <div>
            <h1>سجل الحضور الشهري</h1>
            <p>اختر الشهر والموظف، ثم اطبع السجل مباشرة.</p>
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
          <label>
            <span><Users /> الموظف</span>
            <select name="employee" defaultValue={selectedEmployee}>
              <option value="all">كل الموظفين</option>
              {employees.map((employee) => (
                <option key={employee.user_id} value={employee.user_id}>
                  {employee.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">عرض السجل</button>
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
          <h1>سجل الحضور الشهري</h1>
          <p>{monthLabel}</p>
        </div>
      </section>

      <div className="owner-attendance-sheets">
        {visibleEmployees.map((employee) => {
          const rows = rowsByEmployee.get(employee.user_id) ?? [];
          const timeZone = employee.branch_id
            ? timeZoneByBranch.get(employee.branch_id) ?? "Asia/Riyadh"
            : "Asia/Riyadh";
          return (
            <article className="owner-attendance-sheet" key={employee.user_id}>
              <header>
                <div>
                  <span>الموظف</span>
                  <h2>{employee.name}</h2>
                </div>
                <div>
                  <span>الشهر</span>
                  <strong>{monthLabel}</strong>
                </div>
                <div>
                  <span>الفرع</span>
                  <strong>{employee.branch_name ?? "Tres Primary"}</strong>
                </div>
              </header>
              <table>
                <thead>
                  <tr>
                    <th>التاريخ</th>
                    <th>وقت البداية</th>
                    <th>وقت النهاية</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={`${row.shift_date}-${row.start_time}`}>
                      <td>{dateLabel(row.shift_date)}</td>
                      <td><Clock3 /> {timeLabel(row.start_time, timeZone)}</td>
                      <td><Clock3 /> {timeLabel(row.end_time, timeZone)}</td>
                    </tr>
                  ))}
                  {!rows.length ? (
                    <tr>
                      <td colSpan={3} className="owner-attendance-empty">
                        لا توجد سجلات حضور لهذا الموظف في الشهر المحدد.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
              <footer>{rows.length} ورديات مسجلة</footer>
            </article>
          );
        })}

        {!visibleEmployees.length ? (
          <div className="owner-attendance-no-employees">
            لا يوجد موظفون مسجلون في نظام الحضور بعد.
          </div>
        ) : null}
      </div>
    </main>
  );
}
