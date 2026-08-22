import { MapPin } from "lucide-react";
import { redirect } from "next/navigation";
import { requireStaff } from "../../../lib/staff";
import OwnerStaffManager from "../OwnerStaffManager";
import OwnerNavigation from "../OwnerNavigation";
import { loadOwnerOverview, type OwnerEmployeeMetric } from "../overview";
import "../../team/team.css";
import "../owner.css";

export const dynamic = "force-dynamic";

export default async function OwnerTeamPage() {
  const { profile, supabase } = await requireStaff();
  if (profile.role !== "owner") redirect("/staff");
  const overviewPromise = loadOwnerOverview(supabase, 1);
  const [overviewResult, metricsResult, openShifts, schedules] = await Promise.all([
    overviewPromise,
    supabase.rpc("get_owner_employee_table"),
    // Any date, not just today: a shift left open from a previous day is
    // exactly the case that locks an employee out of clocking in.
    supabase.from("attendance_records").select("user_id").eq("status", "active"),
    supabase
      .from("staff_profiles")
      .select("user_id,branch_id,scheduled_start,scheduled_end,nationality,preferred_language"),
  ]);
  const { overview, error } = overviewResult;
  if (!overview)
    return (
      <main className="staff-content">
        <p className="staff-form-error">{error ?? "تعذّر تحميل الفريق."}</p>
      </main>
    );
  const scheduleByUser = new Map(
    (schedules.data ?? []).map((row) => [row.user_id, row]),
  );
  const staff = overview.staff.map((row) => ({
    ...row,
    branch_id: scheduleByUser.get(row.user_id)?.branch_id ?? null,
    scheduled_start:
      scheduleByUser.get(row.user_id)?.scheduled_start ?? row.scheduled_start,
    scheduled_end: scheduleByUser.get(row.user_id)?.scheduled_end ?? null,
    nationality: scheduleByUser.get(row.user_id)?.nationality ?? "Other",
    preferred_language:
      scheduleByUser.get(row.user_id)?.preferred_language ?? "en",
  }));
  return (
    <main className="staff-content staff-team-page owner-staff-page">
      <OwnerNavigation variant="bar" />
      <section className="staff-welcome">
        <div>
          <h1>الموظفون</h1>
          <p>أنشئ الحسابات وحدد أوقات الورديات من مكان واحد.</p>
        </div>
        <div className="staff-branch-pill">
          <MapPin /> {overview.branches.length} فروع
        </div>
      </section>
      <OwnerStaffManager
        branches={overview.branches}
        staff={staff}
        metrics={(metricsResult.data ?? []) as OwnerEmployeeMetric[]}
        openShiftEmployeeIds={(openShifts.data ?? []).map((row) => row.user_id)}
      />
    </main>
  );
}
