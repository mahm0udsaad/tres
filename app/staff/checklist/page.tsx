import { ListTodo } from "lucide-react";
import { redirect } from "next/navigation";
import { requireStaff } from "../../lib/staff";
import { dateInTimeZone } from "../evidence";
import OwnerTaskManager from "./OwnerTaskManager";
import OwnerNavigation from "../owner/OwnerNavigation";
import "./checklist.css";
import "../owner/owner.css";

export const dynamic = "force-dynamic";

export default async function StaffChecklistPage({
  searchParams,
}: {
  searchParams: Promise<{ employee?: string }>;
}) {
  const { profile, supabase } = await requireStaff();
  if (profile.role !== "owner") redirect("/staff");
  const { employee: requestedEmployee } = await searchParams;

  const [branches, employees, tasks, history] = await Promise.all([
    supabase.from("branches").select("id,name,timezone").order("name"),
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
    // Everything the owner has assigned before, newest first, so a repeat job
    // can be re-issued without retyping it.
    supabase
      .from("tasks")
      .select("title,notes,is_required,requires_photo,requires_note,response_type,created_at")
      .eq("task_type", "general_duty")
      .order("created_at", { ascending: false })
      .limit(300),
  ]);
  const branchRows = branches.data ?? [];
  // The date picker must default to the branch's own "today". Using the
  // server/browser UTC date makes every evening assignment (after 21:00 in
  // Riyadh) land on yesterday, where no employee shift can ever pick it up.
  const today = dateInTimeZone(String(branchRows[0]?.timezone || "Asia/Riyadh"));
  const employeeRows = employees.data ?? [];
  const initialEmployeeId = employeeRows.some((employee) => employee.user_id === requestedEmployee)
    ? requestedEmployee ?? null
    : null;
  const branchNames = Object.fromEntries(branchRows.map((branch) => [branch.id, branch.name]));

  // One entry per distinct title, keeping the most recent settings for it.
  const seenTitles = new Set<string>();
  const savedTasks = (history.data ?? []).flatMap((row) => {
    const title = String(row.title ?? "").trim();
    if (!title || seenTitles.has(title)) return [];
    seenTitles.add(title);
    return [{
      title,
      // Employee answers and reopen reasons get appended to `notes`; only the
      // owner's original instruction line is worth carrying into a new copy.
      notes: String(row.notes ?? "").split("\n")[0].trim() || null,
      is_required: row.is_required,
      requires_photo: row.requires_photo,
      requires_note: row.requires_note,
      response_type: row.response_type === "yes_no" ? ("yes_no" as const) : ("completion" as const),
    }];
  }).slice(0, 30);

  return <main className="staff-content staff-checklist-page">
    <OwnerNavigation variant="bar" />
    <section className="staff-welcome"><div><h1>المهام</h1><p>اكتب المهمة، اختر الموظف، ثم اضغط توزيع.</p></div><div className="staff-branch-pill"><ListTodo /> مهام المالك فقط</div></section>
    <OwnerTaskManager employees={employeeRows} tasks={tasks.data ?? []} branchNames={branchNames} initialEmployeeId={initialEmployeeId} today={today} savedTasks={savedTasks} />
  </main>;
}
