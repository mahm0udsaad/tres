"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "../../lib/staff";
import {
  createStaffAuthUser,
  deleteStaffAuthUser,
} from "../../lib/staff-provisioning";
import {
  NATIONALITY_VALUES,
  PROVISIONABLE_ROLES,
  languageForNationality,
  type ProvisionableRole,
} from "../../lib/staff-shared";

export type TeamActionState = {
  error?: string;
  message?: string;
  /** Shown exactly once after a successful creation — not stored anywhere. */
  credentials?: { fullName: string; email: string; password: string };
};

const EMAIL_PATTERN = /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/;
// No ambiguous characters (0/O, 1/l/I) — these get read out loud on handover.
const PASSWORD_ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";

function text(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
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
  const email = text(form.get("email")).toLowerCase();
  const scheduledStart = text(form.get("scheduled_start"));
  const nationality = text(form.get("nationality")) || "Other";
  let password = text(form.get("password"));

  if (!fullName) return { error: "أدخل اسم الموظف." };
  if (!PROVISIONABLE_ROLES.includes(role)) {
    return { error: RPC_ERRORS.role_not_allowed };
  }
  if (!EMAIL_PATTERN.test(email)) {
    return { error: "أدخل بريدًا إلكترونيًا صالحًا لتسجيل الدخول." };
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
  const created = await createStaffAuthUser(email, password);
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
    credentials: { fullName, email, password },
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
  const email = text(form.get("email")).toLowerCase();
  const scheduledStart = text(form.get("scheduled_start"));
  const nationality = text(form.get("nationality")) || "Other";
  let password = text(form.get("password"));

  if (!fullName) return { error: "أدخل اسم الموظف." };
  if (!OWNER_PROVISIONABLE_ROLES.includes(role)) return { error: "يمكن للمالك إنشاء حسابات المشرفين والموظفين فقط." };
  if (!branchId) return { error: RPC_ERRORS.branch_invalid };
  if (!EMAIL_PATTERN.test(email)) return { error: "أدخل بريدًا إلكترونيًا صالحًا لتسجيل الدخول." };
  if (!NATIONALITY_VALUES.includes(nationality)) return { error: RPC_ERRORS.nationality_invalid };
  if (password && password.length < 8) {
    return { error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل — أو اتركها فارغة لتوليدها تلقائيًا." };
  }
  if (!password) password = generatePassword();

  const created = await createStaffAuthUser(email, password);
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

  revalidatePath("/staff/owner");
  revalidatePath("/staff/owner/team");
  return { message: "تم إنشاء الحساب بنجاح.", credentials: { fullName, email, password } };
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
