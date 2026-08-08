"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "../../lib/staff";
import { STAFF_ROLES, type StaffRole } from "../../lib/staff-shared";

export type ChecklistActionState = {
  error?: string;
  message?: string;
};

const TEMPLATE_ROLES = new Set<StaffRole>([
  "supervisor",
  "employee",
  "cleaning_staff",
  "barista",
  "kitchen_manager",
]);

const RPC_ERRORS: Record<string, string> = {
  title_invalid: "أدخل عنوانًا للبند (بحد أقصى 200 حرف).",
  role_not_allowed: "لا يمكن استهداف الأدوار الإدارية ببنود القائمة.",
  template_not_found: "البند غير موجود في فرعك.",
  duplicate_template: "يوجد بند نشط بنفس العنوان لنفس الدور.",
  employee_invalid: "اختر موظفاً نشطاً صالحاً.",
  task_invalid: "أكمل عنوان المهمة وتاريخها.",
  duplicate_task: "هذه المهمة موجودة بالفعل لهذا الموظف في نفس اليوم.",
  branch_invalid: "اختر فرعاً صالحاً.",
};

function text(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

export async function assignOwnerTask(
  _previous: ChecklistActionState | undefined,
  form: FormData,
): Promise<ChecklistActionState> {
  const { profile, supabase } = await requireStaff();
  if (profile.role !== "owner") return { error: "هذا الإجراء متاح للمالك فقط." };
  const employeeId = text(form.get("employee_id"));
  const taskDate = text(form.get("task_date"));
  const title = text(form.get("task_title"));
  if (!employeeId) return { error: RPC_ERRORS.employee_invalid };
  if (!taskDate || !title) return { error: RPC_ERRORS.task_invalid };
  const { data, error } = await supabase.rpc("owner_assign_task", {
    p_employee_id: employeeId,
    p_task_date: taskDate,
    p_title: title,
    p_is_required: form.get("task_required") === "on",
    p_requires_photo: form.get("task_photo") === "on",
    p_sort_order: Number(text(form.get("task_sort_order"))) || 0,
    p_notes: text(form.get("task_notes")) || null,
  });
  const result = (data ?? {}) as Record<string, unknown>;
  if (error || result.ok !== true) return { error: fail(error, result, "تعذّر إسناد المهمة.") };
  revalidatePath("/staff/checklist");
  return { message: "تم إسناد المهمة للموظف." };
}

function fail(error?: { code?: string } | null, result?: Record<string, unknown>, fallback = "تعذّر حفظ البند. حاول مرة أخرى.") {
  if (error) {
    return error.code === "42501" ? "هذا الإجراء متاح للمشرف فقط." : fallback;
  }
  const code = typeof result?.code === "string" ? result.code : "";
  return RPC_ERRORS[code] ?? fallback;
}

export async function saveChecklistTemplate(
  _previous: ChecklistActionState | undefined,
  form: FormData,
): Promise<ChecklistActionState> {
  const { profile, supabase } = await requireStaff();
  if (profile.role !== "supervisor" && profile.role !== "owner") return { error: "هذا الإجراء متاح للمالك أو المشرف." };

  const templateId = text(form.get("template_id"));
  const title = text(form.get("title"));
  const roleRaw = text(form.get("role"));
  const role = (STAFF_ROLES as readonly string[]).includes(roleRaw)
    ? (roleRaw as StaffRole)
    : null;
  if (!title) return { error: RPC_ERRORS.title_invalid };
  if (role && !TEMPLATE_ROLES.has(role)) {
    return { error: RPC_ERRORS.role_not_allowed };
  }

  const branchId = text(form.get("branch_id"));
  if (profile.role === "owner" && !branchId) return { error: RPC_ERRORS.branch_invalid };

  const rpc = profile.role === "owner" ? "owner_save_checklist_template" : "save_checklist_template";
  const args = profile.role === "owner" ? {
    p_template_id: templateId || null, p_branch_id: branchId, p_title: title, p_role: role,
    p_requires_photo: form.get("requires_photo") === "on", p_is_required: form.get("is_required") === "on",
    p_sort_order: Number(text(form.get("sort_order"))) || 0,
  } : {
    p_template_id: templateId || null,
    p_title: title,
    p_role: role,
    p_requires_photo: form.get("requires_photo") === "on",
    p_is_required: form.get("is_required") === "on",
    p_sort_order: Number(text(form.get("sort_order"))) || 0,
  };
  const { data, error } = await supabase.rpc(rpc, args);

  const result = (data ?? {}) as Record<string, unknown>;
  if (error || result.ok !== true) {
    return { error: fail(error, result) };
  }

  revalidatePath("/staff/checklist");
  return { message: templateId ? "تم تحديث البند." : "تمت إضافة البند إلى قائمة الفرع." };
}

export async function toggleChecklistTemplate(
  _previous: ChecklistActionState | undefined,
  form: FormData,
): Promise<ChecklistActionState> {
  const { profile, supabase } = await requireStaff();
  if (profile.role !== "supervisor" && profile.role !== "owner") return { error: "هذا الإجراء متاح للمالك أو المشرف." };

  const templateId = text(form.get("template_id"));
  const nextActive = text(form.get("next_active")) === "true";
  if (!templateId) return { error: RPC_ERRORS.template_not_found };

  const rpc = profile.role === "owner" ? "owner_set_checklist_template_active" : "set_checklist_template_active";
  const { data, error } = await supabase.rpc(rpc, {
    p_template_id: templateId,
    p_is_active: nextActive,
  });

  const result = (data ?? {}) as Record<string, unknown>;
  if (error || result.ok !== true) {
    return { error: fail(error, result, "تعذّر تحديث البند. حاول مرة أخرى.") };
  }

  revalidatePath("/staff/checklist");
  return { message: nextActive ? "تم تفعيل البند." : "تم إيقاف البند." };
}
