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

  const [branches, employees, assignments] = await Promise.all([
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
      .from("owner_task_assignments")
      .select("id,employee_id,starts_on,title,notes,is_required,requires_photo,requires_note,response_type,sort_order")
      .eq("is_active", true)
      .order("starts_on")
      .order("sort_order"),
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

  return <main className="staff-content staff-checklist-page">
    <OwnerNavigation variant="bar" />
    <section className="staff-welcome"><div><h1>المهام اليومية</h1><p>أنشئ المهمة مرة واحدة، ثم عدّلها أو غيّر الموظف في أي وقت.</p></div><div className="staff-branch-pill"><ListTodo /> مهام ثابتة ومتكررة</div></section>
    <OwnerTaskManager
      employees={employeeRows}
      tasks={(assignments.data ?? []).map((assignment) => ({
        id: assignment.id,
        user_id: assignment.employee_id,
        task_date: assignment.starts_on,
        title: assignment.title,
        notes: assignment.notes,
        is_required: assignment.is_required,
        requires_photo: assignment.requires_photo,
        requires_note: assignment.requires_note,
        response_type: assignment.response_type,
        sort_order: assignment.sort_order,
      }))}
      branchNames={branchNames}
      initialEmployeeId={initialEmployeeId}
      today={today}
    />
  </main>;
}
