import { MapPin } from "lucide-react";
import { redirect } from "next/navigation";
import { requireStaff } from "../../../lib/staff";
import OwnerStaffManager from "../OwnerStaffManager";
import OwnerNavigation from "../OwnerNavigation";
import { loadOwnerOverview, type OwnerEmployeeMetric } from "../overview";
import "../../team/team.css";
import "../owner.css";

export const dynamic = "force-dynamic";

type OwnerEmployeeNoteRow = {
  entity_type: string;
  entity_id: string;
  author_id: string;
  note: string;
  created_at: string;
};

export default async function OwnerTeamPage() {
  const { profile, supabase } = await requireStaff();
  if (profile.role !== "owner") redirect("/staff");
  const { overview, error } = await loadOwnerOverview(supabase, 1);
  if (!overview)
    return (
      <main className="staff-content">
        <p className="staff-form-error">{error ?? "تعذّر تحميل الفريق."}</p>
      </main>
    );
  const [metricsResult, schedules, tasks, cleaningReports, baristaReports, kitchenReports, waterChecks, privateNotes] =
    await Promise.all([
      supabase.rpc("get_owner_employee_table"),
      supabase
        .from("staff_profiles")
        .select(
          "user_id,branch_id,scheduled_start,scheduled_end,nationality,preferred_language",
        ),
      supabase
        .from("tasks")
        .select(
          "id,user_id,task_date,title,completed,is_required,response_type,yes_no_answer",
        )
        .eq("task_type", "general_duty")
        .order("task_date", { ascending: false })
        .limit(250),
      supabase
        .from("cleaning_reports")
        .select(
          "id,submitted_by,report_date,status,cleanliness_notes,created_at",
        )
        .order("created_at", { ascending: false })
        .limit(250),
      supabase
        .from("barista_reports")
        .select("id,submitted_by,report_date,status,handover_notes,created_at")
        .order("created_at", { ascending: false })
        .limit(250),
      supabase
        .from("kitchen_reports")
        .select(
          "id,submitted_by,report_date,status,cleanliness_notes,created_at",
        )
        .order("created_at", { ascending: false })
        .limit(250),
      supabase
        .from("water_quality_checks")
        .select("id,recorded_by,check_date,salt_ratio,created_at")
        .order("created_at", { ascending: false })
        .limit(250),
      supabase.rpc("get_owner_employee_notes"),
    ]);
  const employeeNoteByEntity = new Map(
    ((privateNotes.data ?? []) as OwnerEmployeeNoteRow[]).map((row) => [
      `${row.entity_type}:${row.entity_id}`,
      row.note,
    ]),
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
        tasks={(tasks.data ?? []).map((task) => ({
          ...task,
          employee_note:
            employeeNoteByEntity.get(`task:${task.id}`) ?? null,
        }))}
        reports={[
          ...(cleaningReports.data ?? []).map((row) => ({
            ...row,
            type: "النظافة",
            note: row.cleanliness_notes,
            employee_note:
              employeeNoteByEntity.get(`cleaning_report:${row.id}`) ?? null,
          })),
          ...(baristaReports.data ?? []).map((row) => ({
            ...row,
            type: "الباريستا",
            note: row.handover_notes,
            employee_note:
              employeeNoteByEntity.get(`barista_report:${row.id}`) ?? null,
          })),
          ...(kitchenReports.data ?? []).map((row) => ({
            ...row,
            type: "المطبخ",
            note: row.cleanliness_notes,
            employee_note:
              employeeNoteByEntity.get(`kitchen_report:${row.id}`) ?? null,
          })),
          ...(waterChecks.data ?? []).map((row) => ({
            id: row.id,
            submitted_by: row.recorded_by,
            report_date: row.check_date,
            status: "recorded",
            created_at: row.created_at,
            type: "فحص المياه",
            note: `نسبة الأملاح: ${row.salt_ratio}`,
            employee_note:
              employeeNoteByEntity.get(`water_check:${row.id}`) ?? null,
          })),
        ]}
      />
    </main>
  );
}
