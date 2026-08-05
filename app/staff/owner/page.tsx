import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Coffee,
  Droplets,
  LogOut,
  Store,
  Users,
} from "lucide-react";
import { redirect } from "next/navigation";
import { ROLE_LABELS, requireStaff } from "../../lib/staff";
import { logoutStaff } from "../actions";
import {
  REPORT_TYPE_LABELS,
  loadOwnerOverview,
  type OwnerStaffRow,
  type StaffStatusToday,
} from "./overview";
import "./owner.css";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<StaffStatusToday, string> = {
  working: "يعمل الآن",
  finished: "أنهى دوامه",
  absent: "لم يحضر",
  admin: "حساب إداري",
};

function timeOf(value: string | null, timeZone = "Asia/Riyadh") {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ar-SA", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(new Date(value));
}

/** Day of month — a weekday name would not fit 14 columns on a phone. */
function dayLabel(date: string) {
  return new Intl.DateTimeFormat("ar-SA", { day: "numeric" }).format(
    new Date(`${date}T12:00:00Z`),
  );
}

function percent(part: number, whole: number) {
  if (!whole) return 0;
  return Math.round((part / whole) * 100);
}

/** Sort order for the staff list: whoever needs attention first. */
const STATUS_WEIGHT: Record<StaffStatusToday, number> = {
  working: 0,
  absent: 1,
  finished: 2,
  admin: 3,
};

function sortStaff(rows: OwnerStaffRow[]) {
  return [...rows].sort(
    (a, b) =>
      Number(b.is_active) - Number(a.is_active) ||
      STATUS_WEIGHT[a.status_today] - STATUS_WEIGHT[b.status_today] ||
      a.name.localeCompare(b.name, "ar"),
  );
}

export default async function OwnerPanel() {
  const { profile, supabase } = await requireStaff();
  if (profile.role !== "owner") redirect("/staff");

  const { overview, error } = await loadOwnerOverview(supabase, 14);

  if (!overview) {
    return (
      <main className="owner-page">
        <header className="owner-topbar">
          <div>
            <p className="staff-eyebrow">TRES</p>
            <h1>لوحة المالك</h1>
          </div>
          <form action={logoutStaff}>
            <button type="submit" className="owner-logout" aria-label="خروج">
              <LogOut />
            </button>
          </form>
        </header>
        <div className="staff-alert staff-alert--error">
          تعذّر تحميل اللوحة. {error ?? ""}
        </div>
      </main>
    );
  }

  const { totals, today_stats: today, branches, trend, staff, pending_reports } = overview;
  const staffRows = sortStaff(staff);
  const workingNames = staffRows
    .filter((row) => row.status_today === "working")
    .map((row) => row.name);
  const maxAttended = Math.max(1, ...trend.map((day) => day.attended));
  const taskPercent = percent(today.tasks_done, today.tasks_total);
  const attendancePercent = percent(today.attended, totals.field_staff);

  return (
    <main className="owner-page">
      <header className="owner-topbar">
        <div>
          <p className="staff-eyebrow">TRES</p>
          <h1>لوحة المالك</h1>
          <p className="owner-subtitle">
            {profile.full_name} ·{" "}
            {new Intl.DateTimeFormat("ar-SA", { dateStyle: "full" }).format(new Date())}
          </p>
        </div>
        <form action={logoutStaff}>
          <button type="submit" className="owner-logout" aria-label="خروج">
            <LogOut />
          </button>
        </form>
      </header>

      {/* الآن — the single most important number on the page. */}
      <section className={`owner-hero ${today.working_now ? "is-live" : "is-quiet"}`}>
        <p className="owner-hero-label">الآن في العمل</p>
        <p className="owner-hero-number">
          {today.working_now}
          <span> من {totals.field_staff}</span>
        </p>
        <p className="owner-hero-help">
          {today.working_now
            ? `الموظفون الموجودون داخل الفرع الآن: ${workingNames.join("، ")}`
            : "لا يوجد أي موظف على رأس العمل في هذه اللحظة."}
        </p>
      </section>

      <section className="owner-tiles">
        <article className="owner-tile">
          <span className="owner-tile-icon"><Users /></span>
          <p className="owner-tile-value">{today.attended}</p>
          <p className="owner-tile-title">حضروا اليوم</p>
          <p className="owner-tile-help">
            من أصل {totals.field_staff} موظف ({attendancePercent}٪)
          </p>
        </article>

        <article className={`owner-tile ${today.late ? "is-bad" : "is-good"}`}>
          <span className="owner-tile-icon"><Clock /></span>
          <p className="owner-tile-value">{today.late}</p>
          <p className="owner-tile-title">تأخّروا اليوم</p>
          <p className="owner-tile-help">
            {today.late ? "راجع أسباب التأخير مع المشرف." : "كل من حضر اليوم كان في وقته."}
          </p>
        </article>

        <article className={`owner-tile ${today.absent ? "is-warn" : "is-good"}`}>
          <span className="owner-tile-icon"><AlertTriangle /></span>
          <p className="owner-tile-value">{today.absent}</p>
          <p className="owner-tile-title">لم يحضروا</p>
          <p className="owner-tile-help">
            {today.absent ? "موظفون لم يسجّلوا حضورهم اليوم." : "لا يوجد غياب اليوم."}
          </p>
        </article>

        <article className={`owner-tile ${today.reports_pending ? "is-warn" : "is-good"}`}>
          <span className="owner-tile-icon"><CheckCircle2 /></span>
          <p className="owner-tile-value">{today.reports_pending}</p>
          <p className="owner-tile-title">تقارير تنتظر المراجعة</p>
          <p className="owner-tile-help">
            {today.reports_pending
              ? "تقارير رفعها الموظفون ولم يراجعها المشرف بعد."
              : "كل التقارير تمّت مراجعتها."}
          </p>
        </article>
      </section>

      <section className="owner-card">
        <h2>مهام اليوم</h2>
        <p className="owner-card-help">
          كل مهمة في قائمة الموظف اليومية. الشريط يمتلئ كلما أنهى الموظفون مهامهم.
        </p>
        <div className="owner-bar" role="img" aria-label={`${taskPercent}٪ من المهام مكتملة`}>
          <span style={{ width: `${taskPercent}%` }} />
        </div>
        <p className="owner-bar-caption">
          <strong>{today.tasks_done}</strong> مهمة مكتملة من {today.tasks_total} · {taskPercent}٪
        </p>
      </section>

      <section className="owner-card">
        <h2>الفروع</h2>
        <p className="owner-card-help">
          كل فرع في مكان واحد. أي فرع جديد يُضاف يظهر هنا تلقائيًا.
        </p>
        <div className="owner-branches">
          {branches.map((branch) => (
            <article key={branch.id} className="owner-branch">
              <header>
                <Store />
                <strong>{branch.name}</strong>
              </header>
              <ul>
                <li>
                  <span>يعملون الآن</span>
                  <b className={branch.working_now ? "is-good-text" : ""}>{branch.working_now}</b>
                </li>
                <li>
                  <span>حضروا اليوم</span>
                  <b>{branch.attended_today} من {branch.staff}</b>
                </li>
                <li>
                  <span>تأخّروا</span>
                  <b className={branch.late_today ? "is-bad-text" : ""}>{branch.late_today}</b>
                </li>
                <li>
                  <span>تقارير تنتظر المراجعة</span>
                  <b className={branch.pending_reports ? "is-warn-text" : ""}>
                    {branch.pending_reports}
                  </b>
                </li>
                <li>
                  <span><Droplets /> ملوحة الماء اليوم</span>
                  <b>{branch.water_ratio_today ?? "لم تُقس"}</b>
                </li>
                <li>
                  <span><Coffee /> مشروبات الموظفين</span>
                  <b>{branch.drinks_taken_today}</b>
                </li>
              </ul>
            </article>
          ))}
          {branches.length === 0 ? <p className="staff-empty">لا توجد فروع بعد.</p> : null}
        </div>
      </section>

      <section className="owner-card">
        <h2>الحضور خلال ١٤ يومًا</h2>
        <p className="owner-card-help">
          كل عمود = يوم واحد. كلما ارتفع العمود زاد عدد الموظفين الذين حضروا في ذلك اليوم.
        </p>
        <div className="owner-chart">
          {trend.map((day) => (
            <div key={day.date} className="owner-chart-col">
              <span className="owner-chart-value">{day.attended}</span>
              <div className="owner-chart-track">
                <span
                  className="owner-chart-fill"
                  style={{ height: `${Math.round((day.attended / maxAttended) * 100)}%` }}
                />
                <span
                  className="owner-chart-ontime"
                  style={{ height: `${Math.round((day.on_time / maxAttended) * 100)}%` }}
                />
              </div>
              <span className="owner-chart-day">{dayLabel(day.date)}</span>
            </div>
          ))}
        </div>
        <p className="owner-chart-key">
          <span className="owner-key-dot owner-key-dot--all" /> حضروا
          <span className="owner-key-dot owner-key-dot--ontime" /> في وقتهم
        </p>
      </section>

      <section className="owner-card">
        <h2>الموظفون ({totals.staff})</h2>
        <p className="owner-card-help">
          حالة كل موظف اليوم، ونسبة انضباطه خلال آخر ١٤ يومًا.
        </p>
        <div className="owner-staff">
          {staffRows.map((row) => (
            <article key={row.user_id} className={`owner-staff-row is-${row.status_today}`}>
              <div className="owner-staff-main">
                <strong>{row.name}</strong>
                <small>
                  {ROLE_LABELS[row.role]}
                  {row.branch_name ? ` · ${row.branch_name}` : " · بدون فرع"}
                  {row.is_active ? "" : " · حساب موقوف"}
                </small>
              </div>
              <div className="owner-staff-side">
                <span className={`owner-pill is-${row.status_today}`}>
                  {STATUS_LABELS[row.status_today]}
                </span>
                {row.uses_attendance ? (
                  <small>
                    {row.status_today === "working" || row.status_today === "finished"
                      ? `بدأ ${timeOf(row.started_at)}`
                      : row.last_shift
                        ? `آخر حضور ${row.last_shift}`
                        : "لم يبدأ أي وردية"}
                    {" · "}
                    {row.shifts
                      ? `${percent(row.on_time_shifts, row.shifts)}٪ في الوقت`
                      : "لا سجل بعد"}
                    {" · "}
                    {row.points} نقطة
                  </small>
                ) : (
                  <small>لا يسجّل حضورًا</small>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="owner-card">
        <h2>تقارير تنتظر المراجعة</h2>
        <p className="owner-card-help">
          تقارير رفعها الموظفون مع صورها، ولم يعتمدها المشرف بعد.
        </p>
        {pending_reports.length ? (
          <ul className="owner-pending">
            {pending_reports.map((report) => (
              <li key={`${report.type}-${report.id}`}>
                <strong>{REPORT_TYPE_LABELS[report.type]}</strong>
                <span>
                  {report.staff_name}
                  {report.branch_name ? ` · ${report.branch_name}` : ""}
                </span>
                <small>{report.report_date}</small>
              </li>
            ))}
          </ul>
        ) : (
          <p className="staff-empty">لا شيء ينتظر المراجعة. 👌</p>
        )}
      </section>
    </main>
  );
}
