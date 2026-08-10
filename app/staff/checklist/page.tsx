import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import { redirect } from "next/navigation";
import { requireStaff } from "../../lib/staff";
import type { ChecklistTemplate } from "../../lib/staff-shared";
import ChecklistManager from "./ChecklistManager";
import "./checklist.css";

export const dynamic = "force-dynamic";

export default async function StaffChecklistPage() {
  const { profile, supabase } = await requireStaff();
  if (profile.role !== "supervisor" && profile.role !== "owner") redirect("/staff");

  const { data: branch } = profile.role === "supervisor" && profile.branch_id
    ? await supabase
        .from("branches")
        .select("id,name")
        .eq("id", profile.branch_id)
        .maybeSingle()
    : { data: null };

  const { data: branches } = profile.role === "owner"
    ? await supabase.from("branches").select("id,name").order("name")
    : { data: null };

  if (profile.role === "supervisor" && !branch) {
    return (
      <main className="staff-content">
        <Link className="staff-back-link" href="/staff"><ArrowRight /> لوحة الموظفين</Link>
        <section className="staff-card staff-no-branch">
          <MapPin />
          <h1>لم يتم تعيين فرع</h1>
          <p>تواصل مع الإدارة لتعيين فرع لحسابك قبل إدارة قائمة المهام.</p>
        </section>
      </main>
    );
  }

  let templateQuery = supabase
    .from("checklist_templates")
    .select("id,branch_id,role,title,requires_photo,is_required,sort_order,is_active")
    .order("sort_order")
    .order("created_at");
  if (profile.role === "supervisor" && branch) templateQuery = templateQuery.eq("branch_id", branch.id);
  const { data: templates } = await templateQuery;
  const { data: employees } = profile.role === "owner"
    ? await supabase.from("staff_profiles").select("user_id,full_name,role,branch_id,is_active").neq("role", "owner").neq("role", "manager").neq("role", "shift_manager").eq("is_active", true).order("full_name")
    : { data: null };
  const { data: assignedTasks } = profile.role === "owner"
    ? await supabase.from("tasks").select("id,user_id,task_date,title,notes,is_required,requires_photo,requires_note,response_type,sort_order").eq("task_type", "general_duty").eq("completed", false).order("task_date").order("sort_order")
    : { data: null };

  return (
    <main className="staff-content staff-checklist-page">
      <Link className="staff-back-link" href="/staff"><ArrowRight /> لوحة الموظفين</Link>

      <section className="staff-welcome">
        <div>
          <p className="staff-eyebrow">DAILY CHECKLIST</p>
          <h1>قائمة مهام الفرع</h1>
          <p>
            بنود تتكرر يوميًا وتظهر لموظفيك عند بدء الوردية — البنود التي تتطلب
            صورة لا يمكن إكمالها بدون إثبات مصوّر.
          </p>
        </div>
        <div className="staff-branch-pill"><MapPin /> {profile.role === "owner" ? `${branches?.length ?? 0} فروع` : branch?.name}</div>
      </section>

      <ChecklistManager templates={(templates ?? []) as ChecklistTemplate[]} branches={branches ?? []} employees={employees ?? []} assignedTasks={assignedTasks ?? []} owner={profile.role === "owner"} />
    </main>
  );
}
