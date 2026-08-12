import Link from "next/link";
import { ArrowRight, ListTodo } from "lucide-react";
import { redirect } from "next/navigation";
import { requireStaff } from "../../lib/staff";
import OwnerTaskManager from "./OwnerTaskManager";
import "./checklist.css";
import "../owner/owner.css";

export const dynamic = "force-dynamic";

export default async function StaffChecklistPage() {
  const { profile, supabase } = await requireStaff();
  if (profile.role !== "owner") redirect("/staff");

  const [branches, employees, tasks] = await Promise.all([
    supabase.from("branches").select("id,name").order("name"),
    supabase
      .from("staff_profiles")
      .select("user_id,full_name,role,branch_id,is_active")
      .eq("is_active", true)
      .neq("role", "owner")
      .neq("role", "manager")
      .neq("role", "shift_manager")
      .order("full_name"),
    supabase
      .from("tasks")
      .select("id,user_id,task_date,title,notes,is_required,requires_photo,requires_note,response_type,sort_order")
      .eq("task_type", "general_duty")
      .eq("completed", false)
      .order("task_date")
      .order("sort_order"),
  ]);
  const branchNames = Object.fromEntries((branches.data ?? []).map((branch) => [branch.id, branch.name]));

  return <main className="staff-content staff-checklist-page">
    <Link className="staff-back-link" href="/staff/owner"><ArrowRight /> لوحة المالك</Link>
    <section className="staff-welcome"><div><p className="staff-eyebrow">OWNER TASKS</p><h1>إدارة المهام</h1><p>لا توجد مهام تلقائية أو نماذج ثابتة. أنت تنشئ كل مهمة وتختار من ينفذها.</p></div><div className="staff-branch-pill"><ListTodo /> مهام المالك فقط</div></section>
    <OwnerTaskManager employees={employees.data ?? []} tasks={tasks.data ?? []} branchNames={branchNames} />
  </main>;
}
