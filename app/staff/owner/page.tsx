import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ClipboardCheck,
  Coffee,
  FileCheck2,
  ListTodo,
  LogOut,
  Store,
  UserPlus,
  Users,
} from "lucide-react";
import { ROLE_LABELS, requireStaff } from "../../lib/staff";
import { logoutStaff } from "../actions";
import {
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

function sortStaff(rows: OwnerStaffRow[]) {
  return [...rows].sort(
    (a, b) =>
      Number(b.is_active) - Number(a.is_active) ||
      STATUS_WEIGHT[a.status_today] - STATUS_WEIGHT[b.status_today] ||
      a.name.localeCompare(b.name, "ar"),
  );
}

function SimpleMetric({
  icon,
  label,
  value,
  note,
  href,
  tone = "neutral",
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  note: string;
  href: string;
  tone?: "neutral" | "good" | "warn" | "danger";
}) {
  return (
    <Link className="owner-simple-metric" href={href} data-tone={tone}>
      <span className="owner-simple-metric-icon">{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        <p>{note}</p>
      </div>
      <ChevronLeft />
    </Link>
  );
}

export default async function OwnerPanel() {
  const { profile, supabase } = await requireStaff();
  if (profile.role !== "owner" && profile.role !== "manager") redirect("/staff");
  const dashboardOnly = profile.role === "manager";
  const safeHref = (href: string) => dashboardOnly ? "/staff/owner" : href;

  const { overview, error } = await loadOwnerOverview(supabase, 14);
  if (!overview) {
    return (
      <main className="owner-error-page">
        <div>
          <span className="owner-error-mark">T</span>
          <h1>تعذّر تحميل لوحة المالك</h1>
          <p>{error ?? "حاول تحديث الصفحة بعد قليل."}</p>
          <form action={logoutStaff}>
            <button type="submit"><LogOut /> تسجيل الخروج</button>
          </form>
        </div>
      </main>
    );
  }

  const { totals, today_stats: today, branches, staff } = overview;
  const activeStaff = sortStaff(staff).filter((row) => row.is_active);
  const visibleStaff = activeStaff.filter((row) => row.uses_attendance).slice(0, 6);
  const hasFieldStaff = totals.field_staff > 0;
  const hasTasks = today.tasks_total > 0;
  const tasksRemaining = Math.max(0, today.tasks_total - today.tasks_done);
  const waterCheckedBranches = branches.filter((branch) => branch.water_ratio_today != null).length;
  const dateLabel = new Intl.DateTimeFormat("ar-EG-u-ca-gregory", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${overview.today}T12:00:00Z`));

  const alerts = [
    !hasFieldStaff
      ? {
          tone: "neutral",
          title: "أضف أول موظف",
          detail: "أنشئ الحساب وحدد وقت الوردية.",
          href: "/staff/owner/team",
          action: "إضافة موظف",
        }
      : null,
    hasFieldStaff && !hasTasks
      ? {
          tone: "neutral",
          title: "لا توجد مهام اليوم",
          detail: "اكتب المهمة واختر الموظف الذي سينفذها.",
          href: "/staff/checklist",
          action: "إسناد مهمة",
        }
      : null,
    today.absent
      ? {
          tone: "danger",
          title: `${today.absent} لم يحضروا اليوم`,
          detail: "افتح الموظفين لمعرفة حالتهم.",
          href: "/staff/owner/attendance",
          action: "عرض الموظفين",
        }
      : null,
    today.late
      ? {
          tone: "warn",
          title: `${today.late} حالات تأخير`,
          detail: "راجع حالة الفريق ووقت بداية الوردية.",
          href: "/staff/owner/attendance",
          action: "مراجعة الحضور",
        }
      : null,
    today.reports_pending
      ? {
          tone: "warn",
          title: `${today.reports_pending} تقارير تحتاج مراجعتك`,
          detail: "افتح التقرير ثم اعتمده أو ارفضه.",
          href: "/staff/reports",
          action: "مراجعة التقارير",
        }
      : null,
    hasFieldStaff && waterCheckedBranches < branches.length
      ? {
          tone: "neutral",
          title: "فحص المياه غير مكتمل",
          detail: `${branches.length - waterCheckedBranches} فرع لم يسجّل الفحص اليوم.`,
          href: "/staff/reports",
          action: "عرض التقارير",
        }
      : null,
  ].filter((item): item is {
    tone: string;
    title: string;
    detail: string;
    href: string;
    action: string;
  } => Boolean(item));

  return (
    <main className="owner-console owner-console--simple">
      <aside className="owner-sidebar">
        <div className="owner-logo" aria-label="TRES Coffee Roasters">
          <strong>TRES</strong>
          <span>COFFEE ROASTERS</span>
        </div>
        <OwnerNavigation dashboardOnly={dashboardOnly} />
        <div className="owner-account">
          <span className="owner-avatar">{profile.full_name.trim().slice(0, 1)}</span>
          <div><strong>{profile.full_name}</strong><small>{dashboardOnly ? "عرض الداشبورد" : "المالك"}</small></div>
          <form action={logoutStaff}>
            <button type="submit" aria-label="تسجيل الخروج" title="تسجيل الخروج"><LogOut /></button>
          </form>
        </div>
      </aside>

      <div className="owner-main owner-simple-main">
        <header className="owner-command-header">
          <div className="owner-command-title">
            <span><Coffee /></span>
            <div>
              <h1>لوحة المالك</h1>
              <p>اختر ما تريد تنفيذه الآن</p>
            </div>
          </div>
          <div className="owner-command-tools">
            <OwnerThemeToggle />
            <span><Store /> {branches[0]?.name ?? "Tres Primary"}</span>
            <time dateTime={overview.today}><CalendarDays /> {dateLabel}</time>
          </div>
        </header>

        {dashboardOnly ? (
          <section className="owner-start-here" aria-labelledby="viewer-title">
            <div className="owner-simple-section-heading">
              <div>
                <span>حساب عرض مستقل</span>
                <h2 id="viewer-title">متابعة التشغيل بدون استخدام حساب المالك</h2>
              </div>
              <p>هذا الحساب للمتابعة فقط ولا يملك صلاحية تعديل الموظفين أو المهام.</p>
            </div>
          </section>
        ) : <section className="owner-start-here" aria-labelledby="start-here-title">
          <div className="owner-simple-section-heading">
            <div>
              <span>ابدأ من هنا</span>
              <h2 id="start-here-title">ماذا تريد أن تفعل؟</h2>
            </div>
            <p>ثلاث خطوات فقط لإدارة التشغيل.</p>
          </div>
          <div className="owner-step-list">
            <Link href="/staff/owner/team">
              <b>١</b><span><UserPlus /></span>
              <div><strong>أضف الموظفين</strong><small>الحساب، الجوال، والوردية</small></div>
              <ChevronLeft />
            </Link>
            <Link href="/staff/checklist">
              <b>٢</b><span><ListTodo /></span>
              <div><strong>وزّع مهام اليوم</strong><small>اختر المهمة والموظف</small></div>
              <ChevronLeft />
            </Link>
            <Link href="/staff/reports">
              <b>٣</b><span><FileCheck2 /></span>
              <div><strong>راجع النتائج</strong><small>التقارير والصور والملاحظات</small></div>
              <ChevronLeft />
            </Link>
          </div>
        </section>}

        <section className="owner-simple-metrics" aria-label="حالة اليوم">
          <SimpleMetric
            icon={<Users />}
            label="يعملون الآن"
            value={today.working_now}
            note={hasFieldStaff ? `من ${totals.field_staff} موظف` : "لا يوجد موظفون"}
            href={safeHref("/staff/owner/team")}
            tone={today.working_now ? "good" : "neutral"}
          />
          <SimpleMetric
            icon={<ListTodo />}
            label="مهام متبقية"
            value={tasksRemaining}
            note={hasTasks ? `${today.tasks_done} مكتملة` : "لم تُسند مهام"}
            href={safeHref("/staff/checklist")}
            tone={tasksRemaining ? "warn" : hasTasks ? "good" : "neutral"}
          />
          <SimpleMetric
            icon={<FileCheck2 />}
            label="تقارير للمراجعة"
            value={today.reports_pending}
            note={today.reports_today ? `${today.reports_today} مرفوعة اليوم` : "لا توجد تقارير"}
            href={safeHref("/staff/reports")}
            tone={today.reports_pending ? "danger" : "good"}
          />
          <SimpleMetric
            icon={<AlertTriangle />}
            label="تحتاج انتباه"
            value={alerts.length}
            note={alerts.length ? "افتح القائمة أدناه" : "كل شيء واضح"}
            href="#needs-attention"
            tone={alerts.length ? "warn" : "good"}
          />
        </section>

        <div className="owner-simple-grid">
          <section className="owner-panel owner-needs-panel" id="needs-attention">
            <header className="owner-simple-panel-head">
              <div><ClipboardCheck /><h2>ماذا يحتاج منك الآن؟</h2></div>
              <span>{alerts.length}</span>
            </header>
            <div className="owner-simple-alerts">
              {alerts.length ? alerts.map((alert) => (
                <Link key={alert.title} href={safeHref(alert.href)} data-tone={alert.tone}>
                  <i />
                  <div><strong>{alert.title}</strong><small>{alert.detail}</small></div>
                  <b>{alert.action}</b><ChevronLeft />
                </Link>
              )) : (
                <div className="owner-simple-clear">
                  <CheckCircle2 />
                  <div><strong>لا يوجد شيء عاجل</strong><small>التشغيل واضح ولا يحتاج إجراء منك الآن.</small></div>
                </div>
              )}
            </div>
          </section>

          <section className="owner-panel owner-simple-team-panel">
            <header className="owner-simple-panel-head">
              <div><Activity /><h2>الفريق اليوم</h2></div>
              {dashboardOnly ? <span>عرض فقط</span> : <Link href="/staff/owner/team">إدارة الموظفين</Link>}
            </header>
            <div className="owner-simple-people">
              {visibleStaff.map((row) => (
                <Link href={safeHref("/staff/owner/team")} key={row.user_id}>
                  <span>{row.name.slice(0, 1)}</span>
                  <div><strong>{row.name}</strong><small>{ROLE_LABELS[row.role]} · {row.branch_name ?? "Tres Primary"}</small></div>
                  <b data-status={row.status_today}>{STATUS_LABELS[row.status_today]}</b>
                  <ChevronLeft />
                </Link>
              ))}
              {!visibleStaff.length ? (
                <div className="owner-simple-empty">
                  <Users /><strong>لا يوجد موظفون بعد</strong>
                  {dashboardOnly ? null : <Link href="/staff/owner/team">إضافة أول موظف</Link>}
                </div>
              ) : null}
            </div>
          </section>
        </div>

        <footer className="owner-footer">
          <span><i /> البيانات محدّثة من نظام العمليات</span>
          <time dateTime={overview.today}>{dateLabel}</time>
        </footer>
      </div>
    </main>
  );
}
