import { ClipboardList, LogOut, MapPin } from "lucide-react";
import Link from "next/link";
import {
  ROLE_LABELS,
  type AttendanceRecord,
  type Branch,
  type Gamification,
  type StaffTask,
  requireStaff,
  usesAttendance,
} from "../lib/staff";
import { t, dirFor, type Lang } from "../lib/staff-i18n";
import BranchSettings from "./BranchSettings";
import ShiftControls from "./ShiftControls";
import { logoutStaff } from "./actions";

export const dynamic = "force-dynamic";

const EMPTY_GAMIFICATION: Gamification = {
  points: 0,
  badges: [],
  streak_count: 0,
};

export default async function StaffDashboard() {
  const { profile, supabase } = await requireStaff();
  // Attendance roles see the app in their preferred language; admin roles
  // (owner/manager/supervisor/shift_manager) always see Arabic.
  const lang: Lang = usesAttendance(profile.role) ? profile.preferred_language : "ar";
  const locale = lang === "ar" ? "ar-SA" : "en-US";

  const [branchResult, attendanceResult, gamificationResult] = await Promise.all([
    profile.branch_id
      ? supabase
          .from("branches")
          .select("id,name,latitude,longitude,radius_meters,timezone")
          .eq("id", profile.branch_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    usesAttendance(profile.role)
      ? supabase
          .from("attendance_records")
          .select("id,shift_date,start_time,end_time,break_started_at,break_ended_at,break_duration_minutes,break_entitlement_minutes,status,on_time,points_earned,tasks_completed,supervisor_override_by")
          .eq("user_id", profile.user_id)
          .eq("status", "active")
          .maybeSingle()
      : Promise.resolve({ data: null }),
    usesAttendance(profile.role)
      ? supabase
          .from("gamification")
          .select("points,badges,streak_count")
          .eq("user_id", profile.user_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const branch = (branchResult.data ?? null) as Branch | null;
  const attendance = (attendanceResult.data ?? null) as AttendanceRecord | null;
  let tasks: StaffTask[] = [];
  if (attendance) {
    const { data } = await supabase
      .from("tasks")
      .select("id,title,task_type,completed,completed_at,is_required,requires_photo,photo_path,sort_order")
      .eq("user_id", profile.user_id)
      .eq("task_date", attendance.shift_date)
      .order("sort_order")
      .order("created_at");
    tasks = (data ?? []) as StaffTask[];
  }

  return (
    <main className="staff-dashboard">
      <header className="staff-topbar">
        <div className="staff-brand">
          <span>T</span>
          <div>
            <strong>{lang === "ar" ? "تريس" : "TRES"}</strong>
            <small>{t("panel_title", lang)}</small>
          </div>
        </div>
        <div className="staff-user">
          <div>
            <strong>{profile.full_name}</strong>
            <span>{ROLE_LABELS[profile.role]}</span>
          </div>
          <form action={logoutStaff}>
            <button type="submit" aria-label={t("logout", lang)}><LogOut /></button>
          </form>
        </div>
      </header>

      <div className="staff-content">
        <nav className="staff-section-nav" aria-label={t("panel_title", lang)}>
          <Link href="/staff" data-active="true">{t("nav_home", lang)}</Link>
          {profile.role !== "shift_manager" ? (
            <Link href="/staff/submissions">{t("nav_daily_forms", lang)}</Link>
          ) : null}
          {profile.role === "supervisor" ? (
            <Link href="/staff/team">{t("nav_team", lang)}</Link>
          ) : null}
          {profile.role === "supervisor" ? (
            <Link href="/staff/checklist">{t("nav_checklist", lang)}</Link>
          ) : null}
          {["owner", "manager", "supervisor", "shift_manager"].includes(profile.role) ? (
            <Link href="/staff/reports">{t("nav_reports", lang)}</Link>
          ) : null}
        </nav>

        <section className="staff-welcome">
          <div>
            <p className="staff-eyebrow">STAFF OPERATIONS</p>
            <h1>{t("greeting", lang, { name: profile.full_name.split(" ")[0] })}</h1>
            <p>{new Intl.DateTimeFormat(locale, { dateStyle: "full" }).format(new Date())}</p>
          </div>
          {branch ? (
            <div className="staff-branch-pill"><MapPin /> {branch.name}</div>
          ) : null}
        </section>

        {!branch ? (
          <div className="staff-alert staff-alert--error">
            {t("branch_unassigned", lang)}
          </div>
        ) : null}

        {branch && usesAttendance(profile.role) ? (
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
      </div>
    </main>
  );
}
