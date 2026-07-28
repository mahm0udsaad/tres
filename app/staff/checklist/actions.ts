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
};

function text(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
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
  if (profile.role !== "supervisor") {
    return { error: "هذا الإجراء متاح للمشرف فقط." };
  }

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

  const { data, error } = await supabase.rpc("save_checklist_template", {
    p_template_id: templateId || null,
    p_title: title,
    p_role: role,
    p_requires_photo: form.get("requires_photo") === "on",
    p_is_required: form.get("is_required") === "on",
    p_sort_order: Number(text(form.get("sort_order"))) || 0,
  });

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
  if (profile.role !== "supervisor") {
    return { error: "هذا الإجراء متاح للمشرف فقط." };
  }

  const templateId = text(form.get("template_id"));
  const nextActive = text(form.get("next_active")) === "true";
  if (!templateId) return { error: RPC_ERRORS.template_not_found };

  const { data, error } = await supabase.rpc("set_checklist_template_active", {
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
