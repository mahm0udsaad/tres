import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import { redirect } from "next/navigation";
import { ROLE_LABELS, requireStaff } from "../../lib/staff";
import { dashboardLang } from "../../lib/staff-shared";
import DailyReport from "../DailyReport";

export const dynamic = "force-dynamic";

/** Roles whose daily forms now live inline on /staff — they never navigate. */
const INLINE_FORM_ROLES = ["employee", "cleaning_staff", "barista", "kitchen_manager"];

function dateInTimeZone(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * What is left of the old "daily forms" page: the water check and the staff
 * beverage log for management roles. Employee reports moved onto /staff so
 * finishing a shift never requires finding another screen.
 */
export default async function StaffSubmissionsPage() {
  const { profile, supabase } = await requireStaff();
  if (profile.role === "shift_manager") redirect("/staff/reports");
  if (INLINE_FORM_ROLES.includes(profile.role)) redirect("/staff");

  const lang = dashboardLang(profile);
  const { data: branch } = profile.branch_id
    ? await supabase.from("branches").select("id,name,timezone").eq("id", profile.branch_id).maybeSingle()
    : { data: null };

  if (!branch) {
    return (
      <main className="staff-content">
        <Link className="staff-back-link" href="/staff">
          <ArrowRight /> لوحة الموظفين
        </Link>
        <section className="staff-card staff-no-branch">
          <MapPin />
          <h1>لم يتم تعيين فرع</h1>
          <p>تواصل مع الإدارة لتعيين فرع لحسابك قبل إرسال التقارير.</p>
        </section>
      </main>
    );
  }

  const reportDate = dateInTimeZone(String(branch.timezone || "Asia/Riyadh"));
  const [waterResult, beverageResult] = await Promise.all([
    supabase
      .from("water_quality_checks")
      .select("salt_ratio")
      .eq("branch_id", branch.id)
      .eq("check_date", reportDate)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("daily_beverage_logs")
      .select("consumed")
      .eq("employee_id", profile.user_id)
      .eq("log_date", reportDate)
      .maybeSingle(),
  ]);

  return (
    <main className="staff-content">
      <nav className="staff-submission-nav" aria-label="التنقل">
        <Link className="staff-back-link" href="/staff">
          <ArrowRight /> لوحة الموظفين
        </Link>
        <span>{ROLE_LABELS[profile.role]}</span>
      </nav>

      <section className="staff-greeting">
        <h1>تقارير اليوم</h1>
        <p>
          {branch.name} · {reportDate}
        </p>
      </section>

      <DailyReport
        role={profile.role}
        lang={lang}
        reports={{ cleaning: null, barista: null, kitchen: null }}
        latestWater={waterResult.data ? { salt_ratio: Number(waterResult.data.salt_ratio) } : null}
        beverageConsumed={beverageResult.data ? Boolean(beverageResult.data.consumed) : null}
      />
    </main>
  );
}
