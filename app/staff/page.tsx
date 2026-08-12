import { ClipboardList, KeyRound, LogOut, MapPin } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  type AttendanceRecord,
  type Branch,
  type Gamification,
  type StaffTask,
  requireStaff,
  usesAttendance,
} from "../lib/staff";
import { dashboardLang, isAdminRole } from "../lib/staff-shared";
import { localeFor, t, type Lang } from "../lib/staff-i18n";
import BranchSettings from "./BranchSettings";
import ShiftControls from "./ShiftControls";
import type { ReportStatus } from "./DailyReport";
import { logoutStaff } from "./actions";

export const dynamic = "force-dynamic";

const EMPTY_GAMIFICATION: Gamification = { points: 0, badges: [], streak_count: 0 };

const REPORT_TABLE = {
  cleaning_staff: "cleaning_reports",
  barista: "barista_reports",
  kitchen_manager: "kitchen_reports",
} as const;

function dateInTimeZone(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function shiftTime(value: string) {
  const [hourText, minute = "00"] = value.split(":");
  const hour = Number(hourText);
  return `${hour % 12 || 12}:${minute} ${hour >= 12 ? "PM" : "AM"}`;
}

export default async function StaffDashboard() {
  const { profile, supabase } = await requireStaff();
  // The owner runs the company, not a shift: send them straight to the panel
  // that shows every branch instead of this single-branch dashboard.
  if (profile.role === "owner") redirect("/staff/owner");
  const lang: Lang = dashboardLang(profile);
  const locale = localeFor(lang);
  const attends = usesAttendance(profile.role);

  const [branchResult, attendanceResult, gamificationResult] = await Promise.all([
    profile.branch_id
      ? supabase
          .from("branches")
          .select("id,name,latitude,longitude,radius_meters,timezone")
          .eq("id", profile.branch_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    attends
      ? supabase
          .from("attendance_records")
          .select(
            "id,shift_date,start_time,end_time,break_started_at,break_ended_at,break_duration_minutes,break_entitlement_minutes,status,on_time,points_earned,tasks_completed,supervisor_override_by",
          )
          .eq("user_id", profile.user_id)
          .eq("status", "active")
          .maybeSingle()
      : Promise.resolve({ data: null }),
    attends
      ? supabase
          .from("gamification")
          .select("points,badges,streak_count")
          .eq("user_id", profile.user_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const branch = (branchResult.data ?? null) as Branch | null;
  const attendance = (attendanceResult.data ?? null) as AttendanceRecord | null;
  const reportDate = dateInTimeZone(String(branch?.timezone || "Asia/Riyadh"));

  // The daily forms now live on this page, so their state is fetched here —
  // an employee never has to navigate away to find out what is still missing.
  let tasks: StaffTask[] = [];
  let ownReport: ReportStatus = null;
  let latestWater: { salt_ratio: number } | null = null;
  let beverageConsumed: boolean | null = null;

  if (attendance) {
    const reportTable = REPORT_TABLE[profile.role as keyof typeof REPORT_TABLE];
    const canCheckWater = ["supervisor", "kitchen_manager"].includes(profile.role);
    const [taskResult, reportResult, waterResult, beverageResult] = await Promise.all([
      supabase
        .from("tasks")
        .select(
          "id,title,notes,task_type,completed,completed_at,is_required,requires_photo,requires_note,response_type,yes_no_answer,photo_path,sort_order",
        )
        .eq("user_id", profile.user_id)
        .eq("task_date", attendance.shift_date)
        .order("sort_order")
        .order("created_at"),
      reportTable
        ? supabase
            .from(reportTable)
            .select("status,review_notes,revision")
            .eq("submitted_by", profile.user_id)
            .eq("report_date", reportDate)
            .order("revision", { ascending: false })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      canCheckWater && branch
        ? supabase
            .from("water_quality_checks")
            .select("salt_ratio")
            .eq("branch_id", branch.id)
            .eq("check_date", reportDate)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("daily_beverage_logs")
        .select("consumed")
        .eq("employee_id", profile.user_id)
        .eq("log_date", reportDate)
        .maybeSingle(),
    ]);

    tasks = (taskResult.data ?? []) as StaffTask[];
    ownReport = (reportResult.data ?? null) as ReportStatus;
    latestWater = waterResult.data ? { salt_ratio: Number(waterResult.data.salt_ratio) } : null;
    beverageConsumed = beverageResult.data ? Boolean(beverageResult.data.consumed) : null;
  }

  const showNav = isAdminRole(profile.role);

  return (
    <main className="staff-dashboard">
      <header className="staff-topbar">
        <div className="staff-brand">
          <span>T</span>
          <div>
            <strong>{lang === "ar" ? "تريس" : "TRES"}</strong>
            <small>{profile.full_name}</small>
          </div>
        </div>
        <div className="staff-user">
          {branch ? (
            <span className="staff-branch-pill">
              <MapPin /> {branch.name}
            </span>
          ) : null}
          <Link className="staff-account-link" href="/staff/account" aria-label={lang === "bn" ? "পাসওয়ার্ড পরিবর্তন" : lang === "en" ? "Change password" : "تغيير كلمة المرور"} title={lang === "bn" ? "পাসওয়ার্ড পরিবর্তন" : lang === "en" ? "Change password" : "تغيير كلمة المرور"}><KeyRound /></Link>
          <form action={logoutStaff}>
            <button type="submit" aria-label={t("logout", lang)}>
              <LogOut />
            </button>
          </form>
        </div>
      </header>

      <div className="staff-content">
        {showNav ? (
          <nav className="staff-section-nav" aria-label={t("panel_title", lang)}>
            <Link href="/staff" data-active="true">
              {t("nav_home", lang)}
            </Link>
            {profile.role !== "shift_manager" ? (
              <Link href="/staff/submissions">{t("nav_daily_forms", lang)}</Link>
            ) : null}
            {profile.role === "supervisor" ? <Link href="/staff/team">{t("nav_team", lang)}</Link> : null}
            <Link href="/staff/reports">{t("nav_reports", lang)}</Link>
          </nav>
        ) : null}

        <section className="staff-greeting">
          <h1>{t("greeting", lang, { name: profile.full_name.split(" ")[0] })}</h1>
          <p>{new Intl.DateTimeFormat(locale, { dateStyle: "full" }).format(new Date())}</p>
          {profile.scheduled_start && profile.scheduled_end ? <p className="staff-shift-schedule">{lang === "bn" ? "শিফট" : lang === "en" ? "Shift" : "الوردية"}: <b dir="ltr">{shiftTime(profile.scheduled_start)} — {shiftTime(profile.scheduled_end)}</b></p> : null}
        </section>

        {!branch ? <div className="staff-alert staff-alert--error">{t("branch_unassigned", lang)}</div> : null}

        {branch && attends ? (
          <ShiftControls
            attendance={attendance}
            tasks={tasks}
            gamification={(gamificationResult.data ?? EMPTY_GAMIFICATION) as Gamification}
            lang={lang}
            role={profile.role}
            reports={{
              cleaning: profile.role === "cleaning_staff" ? ownReport : null,
              barista: profile.role === "barista" ? ownReport : null,
              kitchen: profile.role === "kitchen_manager" ? ownReport : null,
            }}
            latestWater={latestWater}
            beverageConsumed={beverageConsumed}
          />
        ) : null}

        {branch && ["owner", "manager"].includes(profile.role) ? (
          <>
            <section className="staff-role-note">
              <ClipboardList />
              <div>
                <strong>حساب إداري — لا يتطلب تسجيل حضور</strong>
                <p>يمكنك ضبط موقع الفرع ونطاق السماح أدناه.</p>
              </div>
            </section>
            <BranchSettings branch={branch} />
          </>
        ) : null}

        {profile.role === "shift_manager" ? (
          <section className="staff-role-note">
            <ClipboardList />
            <div>
              <strong>عرض التقارير والملاحظات فقط</strong>
              <p>لن تظهر بيانات الحضور في هذا الحساب. يمكنك متابعة التقارير من تبويب «التقارير».</p>
            </div>
          </section>
        ) : null}

        <p className="staff-role-foot">{t(`role_${profile.role}`, lang)}</p>
      </div>
    </main>
  );
}
