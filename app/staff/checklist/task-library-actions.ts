"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "../../lib/staff";

export type TaskLibraryActionState = { error?: string; message?: string };

function text(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function fail(error: { code?: string } | null, result: Record<string, unknown>, fallback: string) {
  if (error?.code === "42501") return "هذا الإجراء متاح للمالك فقط.";
  const code = String(result.code ?? "");
  if (code === "task_invalid") return "أكمل بيانات المهمة بصورة صحيحة.";
  if (code === "definition_not_found") return "المهمة المختارة غير متاحة.";
  if (code === "employee_invalid") return "اختر موظفين نشطين صالحين.";
  if (code === "assignment_invalid") return "اختر مهمة وتاريخاً وموظفاً واحداً على الأقل.";
  return fallback;
}

export async function saveTaskDefinition(
  _previous: TaskLibraryActionState | undefined,
  form: FormData,
): Promise<TaskLibraryActionState> {
  const { profile, supabase } = await requireStaff();
  if (profile.role !== "owner") return { error: "هذا الإجراء متاح للمالك فقط." };
  const title = text(form.get("title"));
  if (!title) return { error: "أدخل عنوان المهمة." };
  const { data, error } = await supabase.rpc("owner_save_task_definition", {
    p_title: title,
    p_notes: text(form.get("notes")) || null,
    p_is_required: form.get("is_required") === "on",
    p_requires_photo: form.get("requires_photo") === "on",
    p_requires_note: form.get("requires_note") === "on",
    p_response_type: text(form.get("response_type")) || "completion",
  });
  const result = (data ?? {}) as Record<string, unknown>;
  if (error || result.ok !== true) return { error: fail(error, result, "تعذّر حفظ المهمة.") };
  revalidatePath("/staff/checklist");
  revalidatePath("/staff/owner/team");
  return { message: "تمت إضافة المهمة إلى مكتبة المهام. اختر الموظفين لتوزيعها." };
}

export async function assignTaskDefinition(
  _previous: TaskLibraryActionState | undefined,
  form: FormData,
): Promise<TaskLibraryActionState> {
  const { profile, supabase } = await requireStaff();
  if (profile.role !== "owner") return { error: "هذا الإجراء متاح للمالك فقط." };
  const employeeIds = form.getAll("employee_ids").map(String).filter(Boolean);
  const { data, error } = await supabase.rpc("owner_assign_task_definition", {
    p_definition_id: text(form.get("definition_id")),
    p_employee_ids: employeeIds,
    p_task_date: text(form.get("task_date")),
  });
  const result = (data ?? {}) as Record<string, unknown>;
  if (error || result.ok !== true) return { error: fail(error, result, "تعذّر توزيع المهمة.") };
  const assigned = Number(result.assigned ?? 0);
  const duplicates = Number(result.duplicates ?? 0);
  revalidatePath("/staff/checklist");
  revalidatePath("/staff/owner/team");
  return { message: `تم توزيع المهمة على ${assigned} موظف${duplicates ? `، وتخطي ${duplicates} مكررة` : ""}.` };
}
