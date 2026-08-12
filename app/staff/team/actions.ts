"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "../../lib/staff";
import {
  createStaffAuthUser,
  deleteStaffAuthUser,
  updateStaffAuthPassword,
} from "../../lib/staff-provisioning";
import {
  NATIONALITY_VALUES,
  PROVISIONABLE_ROLES,
  languageForNationality,
  normalizeStaffPhone,
  isStaffPhone,
  type ProvisionableRole,
} from "../../lib/staff-shared";

export type TeamActionState = {
  error?: string;
  message?: string;
  /** Shown exactly once after a successful creation — not stored anywhere. */
  credentials?: { fullName: string; phone: string; password: string };
};

// No ambiguous characters (0/O, 1/l/I) — these get read out loud on handover.
const PASSWORD_ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";

function text(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function twelveHourTime(form: FormData, prefix: string): string | null {
  const hour = Number(text(form.get(`${prefix}_hour`)));
  const minute = Number(text(form.get(`${prefix}_minute`)));
  const period = text(form.get(`${prefix}_period`));
  if (!Number.isInteger(hour) || hour < 1 || hour > 12 || ![0, 15, 30, 45].includes(minute) || !["AM", "PM"].includes(period)) return null;
  const hour24 = hour % 12 + (period === "PM" ? 12 : 0);
  return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function generatePassword(length = 12): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length]).join("");
}

const RPC_ERRORS: Record<string, string> = {
  role_not_allowed: "يمكن للمشرف إنشاء حسابات الموظفين فقط (موظف، نظافة، باريستا، مطبخ).",
  name_invalid: "أدخل اسم الموظف (بحد أقصى 120 حرفًا).",
  auth_user_missing: "تعذّر إنشاء الحساب. حاول مرة أخرى.",
  profile_exists: "يوجد ملف موظف لهذا الحساب بالفعل.",
  cannot_target_self: "لا يمكنك تعديل حسابك من هنا.",
  target_not_allowed: "لا يمكن تنفيذ الإجراء — الحساب خارج فرعك أو دوره محمي.",
  nationality_invalid: "اختر جنسية صحيحة.",
  language_invalid: "اختر لغة صحيحة (العربية أو البنغالية أو الإنجليزية).",
  reason_required: "أدخل سبباً لا يقل عن 10 أحرف.",
  active_shift_exists: "لدى الموظف وردية جارية بالفعل.",
  no_active_shift: "لا توجد وردية جارية لهذا الموظف.",
  incomplete_tasks: "لا يمكن إنهاء الوردية — لدى الموظف مهام مطلوبة غير مكتملة.",
  break_active: "لدى الموظف استراحة جارية — يجب إنهاؤها أولاً.",
  branch_invalid: "اختر فرعاً صالحاً.",
};

const OWNER_PROVISIONABLE_ROLES = [
  "supervisor",
  "employee",
  "cleaning_staff",
  "barista",
  "kitchen_manager",
] as const;
type OwnerProvisionableRole = (typeof OWNER_PROVISIONABLE_ROLES)[number];

function rpcError(result: Record<string, unknown>, fallback: string): string {
  const code = typeof result.code === "string" ? result.code : "";
  return RPC_ERRORS[code] ?? fallback;
}

export async function createBranchStaff(
  _previous: TeamActionState | undefined,
  form: FormData,
): Promise<TeamActionState> {
  const { profile, supabase } = await requireStaff();
  if (profile.role !== "supervisor") {
    return { error: "هذا الإجراء متاح للمشرف فقط." };
  }
  if (!profile.branch_id) {
    return { error: "لم يتم تعيين فرع لحسابك بعد." };
  }

  const fullName = text(form.get("full_name"));
  const role = text(form.get("role")) as ProvisionableRole;
  const phone = normalizeStaffPhone(text(form.get("phone")));
  const scheduledStart = text(form.get("scheduled_start"));
  const nationality = text(form.get("nationality")) || "Other";
  let password = text(form.get("password"));

  if (!fullName) return { error: "أدخل اسم الموظف." };
  if (!PROVISIONABLE_ROLES.includes(role)) {
    return { error: RPC_ERRORS.role_not_allowed };
  }
  if (!isStaffPhone(phone)) {
    return { error: "أدخل رقم جوال دولياً صالحاً، مثل +9665XXXXXXXX." };
  }
  if (!NATIONALITY_VALUES.includes(nationality)) {
    return { error: RPC_ERRORS.nationality_invalid };
  }
  const preferredLanguage = languageForNationality(nationality);
  if (password && password.length < 8) {
    return { error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل — أو اتركها فارغة لتوليدها تلقائيًا." };
  }
  if (!password) password = generatePassword();

  // 1. Bare auth account via the service role (app/lib/staff-provisioning.ts).
  const created = await createStaffAuthUser(phone, password);
  if (created.error !== null) return { error: created.error };

  // 2. Profile registration under the SUPERVISOR'S session — Postgres enforces
  //    the branch scope and role allowlist regardless of what this code sends.
  const { data, error } = await supabase.rpc("register_branch_staff", {
    p_new_user_id: created.userId,
    p_full_name: fullName,
    p_role: role,
    p_scheduled_start: scheduledStart || null,
    p_nationality: nationality,
    p_preferred_language: preferredLanguage,
  });

  const result = (data ?? {}) as Record<string, unknown>;
  if (error || result.ok !== true) {
    // 3. Roll back the orphaned auth account.
    await deleteStaffAuthUser(created.userId);
    if (error) {
      return {
        error:
          error.code === "42501"
            ? "هذا الإجراء متاح للمشرف فقط."
            : "تعذّر تسجيل ملف الموظف. حاول مرة أخرى.",
      };
    }
    return { error: rpcError(result, "تعذّر تسجيل ملف الموظف. حاول مرة أخرى.") };
  }

  revalidatePath("/staff/team");
  return {
    message: "تم إنشاء الحساب بنجاح.",
    credentials: { fullName, phone, password },
  };
}

/** Owner-wide provisioning: the database re-checks the owner role, branch, and
 * role allowlist, while the service-role auth helper only creates the login. */
export async function createOwnerStaff(
  _previous: TeamActionState | undefined,
  form: FormData,
): Promise<TeamActionState> {
  const { profile, supabase } = await requireStaff();
  if (profile.role !== "owner") return { error: "هذا الإجراء متاح للمالك فقط." };

  const fullName = text(form.get("full_name"));
  const role = text(form.get("role")) as OwnerProvisionableRole;
  const branchId = text(form.get("branch_id"));
  const phone = normalizeStaffPhone(text(form.get("phone")));
  const scheduledStart = twelveHourTime(form, "schedule_start");
  const scheduledEnd = twelveHourTime(form, "schedule_end");
  const nationality = text(form.get("nationality")) || "Other";
  let password = text(form.get("password"));

  if (!fullName) return { error: "أدخل اسم الموظف." };
  if (!OWNER_PROVISIONABLE_ROLES.includes(role)) return { error: "يمكن للمالك إنشاء حسابات المشرفين والموظفين فقط." };
  if (!branchId) return { error: RPC_ERRORS.branch_invalid };
  if (!isStaffPhone(phone)) return { error: "أدخل رقم جوال دولياً صالحاً، مثل +9665XXXXXXXX." };
  if (!NATIONALITY_VALUES.includes(nationality)) return { error: RPC_ERRORS.nationality_invalid };
  if (!scheduledStart || !scheduledEnd || scheduledStart === scheduledEnd) return { error: "حدد بداية ونهاية الوردية بصورة صحيحة." };
  if (password && password.length < 8) {
    return { error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل — أو اتركها فارغة لتوليدها تلقائيًا." };
  }
  if (!password) password = generatePassword();

  const created = await createStaffAuthUser(phone, password);
  if (created.error !== null) return { error: created.error };

  const { data, error } = await supabase.rpc("register_owner_staff", {
    p_new_user_id: created.userId,
    p_full_name: fullName,
    p_role: role,
    p_branch_id: branchId,
    p_scheduled_start: scheduledStart || null,
    p_nationality: nationality,
  });
  const result = (data ?? {}) as Record<string, unknown>;
  if (error || result.ok !== true) {
    await deleteStaffAuthUser(created.userId);
    if (error) {
      return { error: error.code === "42501" ? "هذا الإجراء متاح للمالك فقط." : "تعذّر تسجيل ملف الموظف. حاول مرة أخرى." };
    }
    return { error: rpcError(result, "تعذّر تسجيل ملف الموظف. حاول مرة أخرى.") };
  }

  const schedule = await supabase.rpc("owner_set_staff_schedule", {
    p_employee_id: created.userId,
    p_scheduled_start: scheduledStart,
    p_scheduled_end: scheduledEnd,
  });
  const scheduleResult = (schedule.data ?? {}) as Record<string, unknown>;
  if (schedule.error || scheduleResult.ok !== true) {
    await deleteStaffAuthUser(created.userId);
    return { error: "تعذّر حفظ توقيت الوردية؛ لم يتم إنشاء الحساب." };
  }

  revalidatePath("/staff/owner");
  revalidatePath("/staff/owner/team");
  return { message: "تم إنشاء الحساب بنجاح.", credentials: { fullName, phone, password } };
}

export async function setOwnerStaffSchedule(
  _previous: TeamActionState | undefined,
  form: FormData,
): Promise<TeamActionState> {
  const { profile, supabase } = await requireStaff();
  if (profile.role !== "owner") return { error: "هذا الإجراء متاح للمالك فقط." };
  const employeeId = text(form.get("employee_id"));
  const scheduledStart = twelveHourTime(form, "schedule_start");
  const scheduledEnd = twelveHourTime(form, "schedule_end");
  if (!employeeId || !scheduledStart || !scheduledEnd || scheduledStart === scheduledEnd) return { error: "حدد بداية ونهاية الوردية بصورة صحيحة." };
  const { data, error } = await supabase.rpc("owner_set_staff_schedule", {
    p_employee_id: employeeId,
    p_scheduled_start: scheduledStart,
    p_scheduled_end: scheduledEnd,
  });
  const result = (data ?? {}) as Record<string, unknown>;
  if (error || result.ok !== true) return { error: rpcError(result, "تعذّر حفظ توقيت الوردية.") };
  revalidatePath("/staff/owner");
  revalidatePath("/staff/owner/team");
  return { message: "تم تحديث وقت الوردية." };
}

export async function resetOwnerStaffPassword(
  _previous: TeamActionState | undefined,
  form: FormData,
): Promise<TeamActionState> {
  const { profile, supabase } = await requireStaff();
  if (profile.role !== "owner") return { error: "هذا الإجراء متاح للمالك فقط." };
  const employeeId = text(form.get("employee_id"));
  const password = text(form.get("new_password"));
  const confirmation = text(form.get("new_password_confirmation"));
  if (!employeeId) return { error: "حساب الموظف غير موجود." };
  if (password.length < 8) return { error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل." };
  if (password !== confirmation) return { error: "تأكيد كلمة المرور غير مطابق." };

  const { data: target } = await supabase
    .from("staff_profiles")
    .select("user_id,role,is_active")
    .eq("user_id", employeeId)
    .maybeSingle();
  if (!target || !target.is_active || ["owner", "manager", "shift_manager"].includes(target.role)) {
    return { error: "لا يمكن تغيير كلمة مرور هذا الحساب من هنا." };
  }
  const resetError = await updateStaffAuthPassword(employeeId, password);
  if (resetError) return { error: resetError };
  return { message: "تم تغيير كلمة مرور الموظف. سلّمه الكلمة الجديدة بسرية." };
}

export async function toggleBranchStaffActive(
  _previous: TeamActionState | undefined,
  form: FormData,
): Promise<TeamActionState> {
  const { profile, supabase } = await requireStaff();
  if (profile.role !== "supervisor") {
    return { error: "هذا الإجراء متاح للمشرف فقط." };
  }

  const targetUserId = text(form.get("user_id"));
  const nextActive = text(form.get("next_active")) === "true";
  if (!targetUserId) return { error: "الحساب غير موجود." };

  const { data, error } = await supabase.rpc("set_branch_staff_active", {
    p_target_user_id: targetUserId,
    p_is_active: nextActive,
  });

  const result = (data ?? {}) as Record<string, unknown>;
  if (error || result.ok !== true) {
    if (error) {
      return {
        error:
          error.code === "42501"
            ? "هذا الإجراء متاح للمشرف فقط."
            : "تعذّر تحديث الحساب. حاول مرة أخرى.",
      };
    }
    return { error: rpcError(result, "تعذّر تحديث الحساب. حاول مرة أخرى.") };
  }

  revalidatePath("/staff/team");
  return { message: nextActive ? "تم تفعيل الحساب." : "تم تعطيل الحساب." };
}

/** Manual GPS-fallback: supervisor clocks a same-branch employee in/out with a
 *  mandatory reason. The database enforces branch scope, the reason, and (on
 *  end) task completion. */
export async function overrideBranchShift(
  _previous: TeamActionState | undefined,
  form: FormData,
): Promise<TeamActionState> {
  const { profile, supabase } = await requireStaff();
  if (profile.role !== "supervisor") {
    return { error: "هذا الإجراء متاح للمشرف فقط." };
  }

  const employeeId = text(form.get("employee_id"));
  const action = text(form.get("action"));
  const reason = text(form.get("reason"));
  if (!employeeId || (action !== "start" && action !== "end")) {
    return { error: "بيانات الإجراء غير مكتملة." };
  }
  if (reason.length < 10) {
    return { error: RPC_ERRORS.reason_required };
  }

  const { data, error } = await supabase.rpc("supervisor_override_shift", {
    p_employee_id: employeeId,
    p_action: action,
    p_reason: reason,
  });

  const result = (data ?? {}) as Record<string, unknown>;
  if (error || result.ok !== true) {
    if (error) {
      return {
        error: error.code === "42501"
          ? "هذا الإجراء متاح للمشرف فقط."
          : "تعذّر تنفيذ الإجراء. حاول مرة أخرى.",
      };
    }
    return { error: rpcError(result, "تعذّر تنفيذ الإجراء. حاول مرة أخرى.") };
  }

  revalidatePath("/staff/team");
  return {
    message: action === "start"
      ? "تم تسجيل حضور الموظف يدوياً."
      : "تم تسجيل انصراف الموظف يدوياً.",
  };
}
