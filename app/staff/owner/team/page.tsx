import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import { redirect } from "next/navigation";
import { requireStaff } from "../../../lib/staff";
import OwnerStaffManager from "../OwnerStaffManager";
import { loadOwnerOverview } from "../overview";
import type { TaskDefinition } from "../../checklist/TaskLibraryManager";
import "../../team/team.css";
import "../owner.css";

export const dynamic = "force-dynamic";

export default async function OwnerTeamPage() {
  const { profile, supabase } = await requireStaff();
  if (profile.role !== "owner") redirect("/staff");
  const { overview, error } = await loadOwnerOverview(supabase, 1);
  if (!overview) return <main className="staff-content"><p className="staff-form-error">{error ?? "تعذّر تحميل الفريق."}</p></main>;
  const [taskDefinitions, tasks, cleaningReports, baristaReports, kitchenReports] = await Promise.all([
    supabase.from("task_definitions").select("id,title,notes,is_required,requires_photo,requires_note,response_type,is_active").eq("is_active", true).order("created_at", { ascending: false }),
    supabase.from("tasks").select("id,user_id,task_date,title,completed,is_required,response_type,yes_no_answer").eq("task_type", "general_duty").order("task_date", { ascending: false }).limit(250),
    supabase.from("cleaning_reports").select("id,submitted_by,report_date,status,cleanliness_notes,created_at").order("created_at", { ascending: false }).limit(250),
    supabase.from("barista_reports").select("id,submitted_by,report_date,status,handover_notes,created_at").order("created_at", { ascending: false }).limit(250),
    supabase.from("kitchen_reports").select("id,submitted_by,report_date,status,cleanliness_notes,created_at").order("created_at", { ascending: false }).limit(250),
  ]);
  return <main className="staff-content staff-team-page owner-staff-page">
    <Link className="staff-back-link" href="/staff/owner"><ArrowRight /> لوحة المالك</Link>
    <section className="staff-welcome"><div><p className="staff-eyebrow">OWNER TEAM</p><h1>إدارة الفريق</h1><p>أنشئ حسابات الموظفين والمشرفين واختر فرع كل حساب.</p></div><div className="staff-branch-pill"><MapPin /> {overview.branches.length} فروع</div></section>
    <OwnerStaffManager
      branches={overview.branches}
      staff={overview.staff}
      definitions={(taskDefinitions.data ?? []) as TaskDefinition[]}
      tasks={tasks.data ?? []}
      reports={[...(cleaningReports.data ?? []).map((row) => ({ ...row, type: "النظافة", note: row.cleanliness_notes })), ...(baristaReports.data ?? []).map((row) => ({ ...row, type: "الباريستا", note: row.handover_notes })), ...(kitchenReports.data ?? []).map((row) => ({ ...row, type: "المطبخ", note: row.cleanliness_notes }))]}
    />
  </main>;
}
