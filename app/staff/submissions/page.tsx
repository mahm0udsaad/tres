import Link from "next/link";
import { ArrowRight, ClipboardCheck, MapPin } from "lucide-react";
import { redirect } from "next/navigation";
import { ROLE_LABELS, requireStaff } from "../../lib/staff";
import type { StaffRole } from "../../lib/staff-shared";
import SubmissionForms from "./SubmissionForms";
import "./submissions.css";

export const dynamic = "force-dynamic";

type ReportStatus = {
  status: "pending" | "confirmed" | "rejected";
  review_notes: string | null;
  revision: number;
} | null;

const WATER_ROLES: StaffRole[] = ["owner", "manager", "supervisor", "kitchen_manager"];
const BEVERAGE_ROLES: StaffRole[] = [
  "supervisor",
  "employee",
  "cleaning_staff",
  "barista",
  "kitchen_manager",
];

function dateInTimeZone(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default async function StaffSubmissionsPage() {
  const { profile, supabase } = await requireStaff();
  if (profile.role === "shift_manager") redirect("/staff/reports");

  const { data: branch } = profile.branch_id
    ? await supabase
        .from("branches")
        .select("id,name,timezone")
        .eq("id", profile.branch_id)
        .maybeSingle()
    : { data: null };

  if (!branch) {
    return (
      <main className="staff-content">
        <Link className="staff-back-link" href="/staff"><ArrowRight /> لوحة الموظفين</Link>
        <section className="staff-card staff-no-branch">
          <MapPin />
          <h1>لم يتم تعيين فرع</h1>
          <p>تواصل مع الإدارة لتعيين فرع لحسابك قبل إرسال التقارير.</p>
        </section>
      </main>
    );
  }

  const reportDate = dateInTimeZone(String(branch.timezone || "Asia/Riyadh"));
  const emptyResult = Promise.resolve({ data: null });
  const [
    cleaningResult,
    baristaResult,
    kitchenResult,
    waterResult,
    beverageResult,
  ] = await Promise.all([
    profile.role === "cleaning_staff"
      ? supabase
          .from("cleaning_reports")
          .select("status,review_notes,revision")
          .eq("submitted_by", profile.user_id)
          .eq("report_date", reportDate)
          .order("revision", { ascending: false })
          .limit(1)
          .maybeSingle()
      : emptyResult,
    profile.role === "barista"
      ? supabase
          .from("barista_reports")
          .select("status,review_notes,revision")
          .eq("submitted_by", profile.user_id)
          .eq("report_date", reportDate)
          .order("revision", { ascending: false })
          .limit(1)
          .maybeSingle()
      : emptyResult,
    profile.role === "kitchen_manager"
      ? supabase
          .from("kitchen_reports")
          .select("status,review_notes,revision")
          .eq("submitted_by", profile.user_id)
          .eq("report_date", reportDate)
          .order("revision", { ascending: false })
          .limit(1)
          .maybeSingle()
      : emptyResult,
    WATER_ROLES.includes(profile.role)
      ? supabase
          .from("water_quality_checks")
          .select("salt_ratio,created_at")
          .eq("branch_id", branch.id)
          .eq("check_date", reportDate)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : emptyResult,
    BEVERAGE_ROLES.includes(profile.role)
      ? supabase
          .from("daily_beverage_logs")
          .select("consumed")
          .eq("employee_id", profile.user_id)
          .eq("log_date", reportDate)
          .maybeSingle()
      : emptyResult,
  ]);

  return (
    <main className="staff-content staff-submissions-page">
      <nav className="staff-submission-nav" aria-label="التنقل">
        <Link className="staff-back-link" href="/staff"><ArrowRight /> لوحة الموظفين</Link>
        <span>{ROLE_LABELS[profile.role]}</span>
      </nav>

      <header className="staff-submission-hero">
        <div>
          <p className="staff-eyebrow">DAILY OPERATIONS</p>
          <h1>تقارير ومهام اليوم</h1>
          <p>أكمل النماذج المطلوبة قبل إنهاء ورديتك.</p>
        </div>
        <div className="staff-submission-branch">
          <ClipboardCheck />
          <span>
            <strong>{branch.name}</strong>
            <small>{reportDate}</small>
          </span>
        </div>
      </header>

      <SubmissionForms
        role={profile.role}
        reports={{
          cleaning: (cleaningResult.data ?? null) as ReportStatus,
          barista: (baristaResult.data ?? null) as ReportStatus,
          kitchen: (kitchenResult.data ?? null) as ReportStatus,
        }}
        latestWater={
          waterResult.data
            ? {
                salt_ratio: Number(waterResult.data.salt_ratio),
                created_at: String(waterResult.data.created_at),
              }
            : null
        }
        beverageConsumed={
          beverageResult.data ? Boolean(beverageResult.data.consumed) : null
        }
      />
    </main>
  );
}
