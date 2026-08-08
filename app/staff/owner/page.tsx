import type { CSSProperties, ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Coffee,
  Droplets,
  FileCheck2,
  LogOut,
  MapPin,
  ShieldCheck,
  Store,
  Users,
} from "lucide-react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ROLE_LABELS, requireStaff } from "../../lib/staff";
import { logoutStaff } from "../actions";
import {
  REPORT_TYPE_LABELS,
  loadOwnerOverview,
  type OwnerStaffRow,
  type StaffStatusToday,
} from "./overview";
import OwnerNavigation from "./OwnerNavigation";
import OwnerThemeToggle from "./OwnerThemeToggle";
import "./owner.css";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<StaffStatusToday, string> = {
  working: "يعمل الآن",
  finished: "أنهى دوامه",
  absent: "لم يحضر",
  admin: "إداري",
};

const STATUS_WEIGHT: Record<StaffStatusToday, number> = {
  working: 0,
  absent: 1,
  finished: 2,
  admin: 3,
};

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

function percent(part: number, whole: number) {
  if (!whole) return 0;
  return clampPercent(Math.round((part / whole) * 100));
}

function sortStaff(rows: OwnerStaffRow[]) {
  return [...rows].sort(
    (a, b) =>
      Number(b.is_active) - Number(a.is_active) ||
      STATUS_WEIGHT[a.status_today] - STATUS_WEIGHT[b.status_today] ||
      a.name.localeCompare(b.name, "ar"),
  );
}

function timeOf(value: string | null, timeZone = "Asia/Riyadh") {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ar-EG", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(new Date(value));
}

function dayLabel(date: string) {
  return new Intl.DateTimeFormat("ar-EG-u-ca-gregory", { day: "numeric" }).format(
    new Date(`${date}T12:00:00Z`),
  );
}

function Gauge({ value, label }: { value: number; label: string }) {
  const safeValue = clampPercent(value);
  const style = { "--gauge-value": `${safeValue * 3.6}deg` } as CSSProperties;
  return (
    <div className="owner-gauge" style={style} role="img" aria-label={`${label}: ${safeValue}٪`}>
      <div>
        <strong>{safeValue}٪</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  note,
  tone = "neutral",
  progress,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  note: string;
  tone?: "neutral" | "good" | "warn" | "danger";
  progress?: number;
}) {
  return (
    <article className="owner-metric" data-tone={tone}>
      <div className="owner-metric-head">
        <span>{icon}</span>
        <p>{label}</p>
      </div>
      <strong className="owner-metric-value">{value}</strong>
      <p className="owner-metric-note">{note}</p>
      {typeof progress === "number" ? (
        <div className="owner-metric-progress" aria-hidden="true">
          <span style={{ width: `${clampPercent(progress)}%` }} />
        </div>
      ) : null}
    </article>
  );
}

function PanelTitle({
  icon,
  title,
  meta,
}: {
  icon: ReactNode;
  title: string;
  meta?: ReactNode;
}) {
  return (
    <header className="owner-panel-title">
      <div>
        <span>{icon}</span>
        <h2>{title}</h2>
      </div>
      {meta ? <small>{meta}</small> : null}
    </header>
  );
}

export default async function OwnerPanel() {
  const { profile, supabase } = await requireStaff();
  if (profile.role !== "owner") redirect("/staff");

  const { overview, error } = await loadOwnerOverview(supabase, 14);

  if (!overview) {
    return (
      <main className="owner-error-page">
        <div>
          <span className="owner-error-mark">T</span>
          <h1>تعذّر تحميل لوحة التشغيل</h1>
          <p>{error ?? "حاول تحديث الصفحة بعد قليل."}</p>
          <form action={logoutStaff}>
            <button type="submit"><LogOut /> تسجيل الخروج</button>
          </form>
        </div>
      </main>
    );
  }

  const { totals, today_stats: today, branches, trend, staff, pending_reports } = overview;
  const staffRows = sortStaff(staff);
  const activeStaffRows = staffRows.filter((row) => row.is_active);
  const visibleStaff = activeStaffRows.filter((row) => row.uses_attendance).slice(0, 8);
  const maxAttended = Math.max(1, ...trend.map((day) => day.attended));
  const hasTasks = today.tasks_total > 0;
  const hasFieldStaff = totals.field_staff > 0;
  const hasAttendance = today.attended > 0;
  const hasTrendData = trend.some(
    (day) => day.attended > 0 || day.on_time > 0 || day.hours > 0 || day.reports > 0,
  );
  const taskPercent = percent(today.tasks_done, today.tasks_total);
  const attendancePercent = percent(today.attended, totals.field_staff);
  const onTimePercent = percent(today.on_time, today.attended);
  const waterCheckedBranches = branches.filter((branch) => branch.water_ratio_today != null).length;
  const branchesReady = branches.filter(
    (branch) => branch.staff > 0 && branch.pending_reports === 0 && branch.late_today === 0,
  ).length;
  const branchReadiness = percent(branchesReady, branches.length);
  const dateLabel = new Intl.DateTimeFormat("ar-EG-u-ca-gregory", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${overview.today}T12:00:00Z`));

  const alerts = [
    !hasFieldStaff
      ? {
          tone: "neutral",
          title: "لا يوجد موظفون مسجلون",
          detail: "أضف فريق العمل لبدء متابعة التشغيل",
        }
      : null,
    today.absent
      ? { tone: "danger", title: `${today.absent} موظف لم يحضر`, detail: "لم يبدأوا ورديتهم اليوم" }
      : null,
    today.late
      ? { tone: "warn", title: `${today.late} حالة تأخير`, detail: "تحتاج متابعة المشرف" }
      : null,
    today.reports_pending
      ? { tone: "warn", title: `${today.reports_pending} تقارير معلّقة`, detail: "بانتظار المراجعة والاعتماد" }
      : null,
    hasFieldStaff && waterCheckedBranches < branches.length
      ? {
          tone: "neutral",
          title: `${branches.length - waterCheckedBranches} فرع بلا فحص مياه`,
          detail: "لم يسجّل قياس اليوم",
        }
      : null,
  ].filter((item): item is { tone: string; title: string; detail: string } => Boolean(item));

  return (
    <main className="owner-console">
      <aside className="owner-sidebar">
        <div className="owner-logo" aria-label="TRES Coffee Roasters">
          <strong>TRES</strong>
          <span>COFFEE ROASTERS</span>
        </div>

        <OwnerNavigation />

        <div className="owner-account">
          <span className="owner-avatar">{profile.full_name.trim().slice(0, 1)}</span>
          <div>
            <strong>{profile.full_name}</strong>
            <small>المالك</small>
          </div>
          <form action={logoutStaff}>
            <button type="submit" aria-label="تسجيل الخروج" title="تسجيل الخروج">
              <LogOut />
            </button>
          </form>
        </div>
      </aside>

      <div className="owner-main">
        <header className="owner-command-header owner-section-anchor" id="overview">
          <div className="owner-command-title">
            <span><Coffee /></span>
            <div>
              <h1>التشغيل اليومي</h1>
              <p>متابعة العمليات لحظة بلحظة</p>
            </div>
          </div>
          <div className="owner-command-tools">
            <OwnerThemeToggle />
            <span>
              <Store />
              {branches.length === 1 ? branches[0].name : branches.length ? "جميع الفروع" : "لا توجد فروع"}
            </span>
            <time dateTime={overview.today}><CalendarDays /> {dateLabel}</time>
          </div>
        </header>

        <section className="owner-metrics" aria-label="ملخص اليوم">
          <MetricCard
            icon={<Activity />}
            label="جاهزية التشغيل"
            value={hasTasks ? `${taskPercent}٪` : "—"}
            note={hasTasks ? `${today.tasks_done} من ${today.tasks_total} مهمة` : "لا توجد مهام مسندة"}
            tone={!hasTasks ? "neutral" : taskPercent >= 85 ? "good" : taskPercent >= 60 ? "warn" : "danger"}
            progress={hasTasks ? taskPercent : undefined}
          />
          <MetricCard
            icon={<Users />}
            label="الحضور اليوم"
            value={today.attended}
            note={hasFieldStaff ? `من أصل ${totals.field_staff} موظف` : "لا يوجد موظفون بعد"}
            tone={!hasFieldStaff ? "neutral" : attendancePercent >= 85 ? "good" : "warn"}
            progress={hasFieldStaff ? attendancePercent : undefined}
          />
          <MetricCard
            icon={<Clock3 />}
            label="الالتزام بالوقت"
            value={hasAttendance ? `${onTimePercent}٪` : "—"}
            note={hasAttendance ? `${today.on_time} حضروا في موعدهم` : "لا توجد سجلات حضور"}
            tone={!hasAttendance ? "neutral" : today.late ? "warn" : "good"}
            progress={hasAttendance ? onTimePercent : undefined}
          />
          <MetricCard
            icon={<MapPin />}
            label="في العمل الآن"
            value={today.working_now}
            note={hasAttendance ? `${today.finished} أنهوا ورديتهم` : "لا توجد ورديات اليوم"}
            tone={today.working_now ? "good" : "neutral"}
          />
          <MetricCard
            icon={<CheckCircle2 />}
            label="المهام المنجزة"
            value={today.tasks_done}
            note={hasTasks ? `${today.tasks_total - today.tasks_done} متبقية` : "لا توجد مهام اليوم"}
            tone={!hasTasks ? "neutral" : today.tasks_total > today.tasks_done ? "warn" : "good"}
          />
          <MetricCard
            icon={<FileCheck2 />}
            label="تقارير معلّقة"
            value={today.reports_pending}
            note={today.reports_today ? `${today.reports_today} تقارير رُفعت اليوم` : "لا توجد تقارير اليوم"}
            tone={today.reports_pending ? "danger" : today.reports_today ? "good" : "neutral"}
          />
        </section>

        <div className="owner-dashboard-grid">
          <section className="owner-panel owner-attention-panel owner-section-anchor" id="operations">
            <PanelTitle
              icon={<ClipboardCheck />}
              title="متابعة التشغيل اليومي"
              meta={`${alerts.length} عناصر تحتاج انتباه`}
            />
            <div className="owner-task-summary">
              <div>
                <strong>{hasTasks ? `${taskPercent}٪` : "—"}</strong>
                <span>{hasTasks ? "نسبة إنجاز مهام اليوم" : "لا توجد مهام اليوم"}</span>
              </div>
              <div
                className="owner-wide-progress"
                aria-label={hasTasks ? `${taskPercent}٪ من المهام منجزة` : "لا توجد مهام اليوم"}
              >
                <span style={{ width: `${taskPercent}%` }} />
              </div>
              <small>
                {hasTasks
                  ? `${today.tasks_done} مكتملة · ${today.tasks_total - today.tasks_done} متبقية`
                  : "ستظهر نسبة الإنجاز بعد إسناد المهام"}
              </small>
            </div>
            <div className="owner-alert-list owner-section-anchor" id="alerts">
              {alerts.length ? alerts.map((alert) => (
                <article key={alert.title} data-tone={alert.tone}>
                  <i />
                  <div>
                    <strong>{alert.title}</strong>
                    <span>{alert.detail}</span>
                  </div>
                  <AlertTriangle />
                </article>
              )) : (
                <div className="owner-all-clear">
                  <CheckCircle2 />
                  <div><strong>التشغيل مستقر</strong><span>لا توجد عناصر عاجلة الآن</span></div>
                </div>
              )}
            </div>
          </section>

          <section className="owner-panel owner-branches-panel owner-section-anchor" id="branches">
            <PanelTitle
              icon={<Store />}
              title="حالة الفروع الآن"
              meta={`${branches.length} فروع`}
            />
            <div className="owner-branch-list">
              {branches.map((branch) => {
                const branchAttendance = percent(branch.attended_today, branch.staff);
                return (
                  <article key={branch.id}>
                    <header>
                      <div><i data-live={branch.working_now > 0} /><strong>{branch.name}</strong></div>
                      <span>{branch.working_now} يعملون الآن</span>
                    </header>
                    <div className="owner-branch-stats">
                      <span><b>{branch.attended_today}/{branch.staff}</b> الحضور</span>
                      <span><b>{branch.pending_reports}</b> معلّق</span>
                      <span><b>{branch.water_ratio_today ?? "—"}</b> ملوحة</span>
                    </div>
                    <div className="owner-branch-progress"><span style={{ width: `${branchAttendance}%` }} /></div>
                  </article>
                );
              })}
              {!branches.length ? <p className="owner-empty">لا توجد فروع مضافة بعد.</p> : null}
            </div>
          </section>

          <section className="owner-panel owner-quality-panel owner-section-anchor" id="quality">
            <PanelTitle icon={<ShieldCheck />} title="جودة التشغيل" meta="اليوم" />
            <Gauge value={taskPercent} label={hasTasks ? "مكتمل" : "لا بيانات"} />
            <ul className="owner-quality-list">
              <li><span><Check /> إنجاز المهام</span><b>{hasTasks ? `${taskPercent}٪` : "—"}</b></li>
              <li><span><Check /> الحضور</span><b>{hasFieldStaff ? `${attendancePercent}٪` : "—"}</b></li>
              <li><span><Check /> الالتزام بالوقت</span><b>{hasAttendance ? `${onTimePercent}٪` : "—"}</b></li>
              <li><span><Droplets /> فحص المياه</span><b>{waterCheckedBranches}/{branches.length}</b></li>
            </ul>
          </section>

          <section className="owner-panel owner-trend-panel">
            <PanelTitle icon={<BarChart3 />} title="الحضور خلال ١٤ يومًا" meta="حضروا / في وقتهم" />
            {hasTrendData ? (
              <>
                <div className="owner-chart" aria-label="مخطط الحضور خلال أربعة عشر يومًا">
                  {trend.map((day) => (
                    <div className="owner-chart-col" key={day.date}>
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
                <div className="owner-chart-legend">
                  <span><i className="is-attended" /> الحضور</span>
                  <span><i className="is-ontime" /> في الوقت</span>
                  <strong>{trend.reduce((sum, day) => sum + day.hours, 0).toFixed(1)} ساعة عمل</strong>
                </div>
              </>
            ) : (
              <p className="owner-empty owner-chart-empty">لا توجد سجلات حضور خلال هذه الفترة.</p>
            )}
          </section>

          <section className="owner-panel owner-team-panel owner-section-anchor" id="team">
            <PanelTitle icon={<Users />} title="أداء الفريق اليوم" meta={`${totals.field_staff} موظف`} />
            <Link className="owner-panel-action" href="/staff/owner/team">إدارة الفريق وإنشاء الحسابات</Link>
            <div className="owner-table-scroll">
              <table className="owner-team-table">
                <thead>
                  <tr><th>الموظف</th><th>الحالة</th><th>الانضباط</th><th>النقاط</th></tr>
                </thead>
                <tbody>
                  {visibleStaff.map((row) => (
                    <tr key={row.user_id}>
                      <td><strong>{row.name}</strong><small>{ROLE_LABELS[row.role]} · {row.branch_name ?? "بدون فرع"}</small></td>
                      <td><span className="owner-status" data-status={row.status_today}>{STATUS_LABELS[row.status_today]}</span></td>
                      <td>{row.shifts ? `${percent(row.on_time_shifts, row.shifts)}٪` : "—"}</td>
                      <td>{row.points}</td>
                    </tr>
                  ))}
                  {!visibleStaff.length ? (
                    <tr><td colSpan={4}><p className="owner-empty">لا يوجد موظفون مضافون بعد.</p></td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="owner-panel owner-live-team-panel">
            <PanelTitle icon={<MapPin />} title="الفريق الموجود الآن" meta={`${today.working_now} موظف`} />
            <div className="owner-live-team">
              {activeStaffRows.filter((row) => row.status_today === "working").map((row) => (
                <article key={row.user_id}>
                  <span>{row.name.slice(0, 1)}</span>
                  <div><strong>{row.name}</strong><small>{row.branch_name ?? "بدون فرع"} · بدأ {timeOf(row.started_at)}</small></div>
                  <i />
                </article>
              ))}
              {!today.working_now ? <p className="owner-empty">لا يوجد موظفون على رأس العمل الآن.</p> : null}
            </div>
          </section>

          <section className="owner-panel owner-reports-panel owner-section-anchor" id="reports">
            <PanelTitle icon={<FileCheck2 />} title="تقارير بانتظار المراجعة" meta={today.reports_pending} />
            <ul className="owner-report-list">
              {pending_reports.slice(0, 6).map((report) => (
                <li key={`${report.type}-${report.id}`}>
                  <span className="owner-report-icon"><FileCheck2 /></span>
                  <div><strong>{REPORT_TYPE_LABELS[report.type]}</strong><small>{report.staff_name} · {report.branch_name ?? "بدون فرع"}</small></div>
                  <time>{report.report_date}</time>
                </li>
              ))}
              {!pending_reports.length ? (
                <li className="owner-report-clear"><CheckCircle2 /><span>لا توجد تقارير حتى الآن</span></li>
              ) : null}
            </ul>
          </section>

          <section className="owner-panel owner-branch-readiness-panel">
            <PanelTitle icon={<ShieldCheck />} title="جاهزية الفروع" meta={`${branchesReady}/${branches.length}`} />
            <div className="owner-readiness-body">
              <Gauge value={branchReadiness} label={hasFieldStaff ? "جاهز" : "لا بيانات"} />
              <div>
                <p>
                  {hasFieldStaff
                    ? "الفرع الجاهز لا يملك حالات تأخير أو تقارير معلّقة."
                    : "ستظهر الجاهزية بعد إضافة الموظفين وبدء تسجيل التشغيل."}
                </p>
                {hasFieldStaff ? (
                  <>
                    <span><Check /> {branchesReady} فروع مستقرة</span>
                    <span><AlertTriangle /> {branches.length - branchesReady} تحتاج متابعة</span>
                  </>
                ) : (
                  <span><AlertTriangle /> لا توجد بيانات تشغيل بعد</span>
                )}
              </div>
            </div>
          </section>
        </div>

        <footer className="owner-footer">
          <span><i /> البيانات محدّثة لحظيًا من نظام العمليات</span>
          <time dateTime={overview.today}>{dateLabel}</time>
        </footer>
      </div>
    </main>
  );
}
