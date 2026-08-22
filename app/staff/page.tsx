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
import NotificationBell, { type StaffNotification } from "./NotificationBell";
import ShiftControls from "./ShiftControls";
import { logoutStaff } from "./actions";

export const dynamic = "force-dynamic";

const EMPTY_GAMIFICATION: Gamification = { points: 0, badges: [], streak_count: 0 };

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
  if (profile.role === "owner" || profile.role === "manager") redirect("/staff/owner");
  const lang: Lang = dashboardLang(profile);
  const locale = localeFor(lang);
  const attends = usesAttendance(profile.role);

  const [branchResult, attendanceResult, gamificationResult, notificationsResult] = await Promise.all([
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
    // The owner's verdicts on finished work, waiting in the bell. Not gated on
    // attendance: the point is that they land before the next shift starts.
    supabase
      .from("staff_notifications")
      .select("id,kind,entity_type,decision,title,note,created_at")
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const notifications = (notificationsResult.data ?? []) as StaffNotification[];
  const branch = (branchResult.data ?? null) as Branch | null;
  const attendance = (attendanceResult.data ?? null) as AttendanceRecord | null;
  const reportDate = dateInTimeZone(String(branch?.timezone || "Asia/Riyadh"));

  let tasks: StaffTask[] = [];

  if (attendance) {
    // A shift that ran past midnight keeps yesterday's shift_date, so the day
    // that counts as "due now" is whichever of the two is later.
    const taskCutoff = attendance.shift_date > reportDate ? attendance.shift_date : reportDate;
    const taskResult = await supabase
      .from("tasks")
      .select(
        "id,title,notes,task_type,completed,completed_at,is_required,requires_photo,requires_note,response_type,yes_no_answer,photo_path,sort_order",
      )
      .eq("user_id", profile.user_id)
      // Owner-assigned work is dated by the owner, not by the shift, so an
      // exact match on shift_date hides any task whose date drifted by a day.
      // Everything already due stays on the list until it is actually done.
      .lte("task_date", taskCutoff)
      .or(`completed.eq.false,task_date.eq.${attendance.shift_date}`)
      .order("task_date")
      .order("sort_order")
      .order("created_at");

    tasks = (taskResult.data ?? []) as StaffTask[];
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
          <NotificationBell notifications={notifications} lang={lang} />
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
