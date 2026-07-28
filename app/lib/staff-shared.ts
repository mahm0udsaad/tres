export const STAFF_ROLES = [
  "owner",
  "manager",
  "supervisor",
  "employee",
  "cleaning_staff",
  "barista",
  "kitchen_manager",
  "shift_manager",
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export type StaffProfile = {
  user_id: string;
  full_name: string;
  role: StaffRole;
  branch_id: string | null;
  scheduled_start: string | null;
  is_active: boolean;
};

export type Branch = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  timezone: string;
};

export type AttendanceRecord = {
  id: string;
  shift_date: string;
  start_time: string;
  end_time: string | null;
  break_started_at: string | null;
  break_ended_at: string | null;
  break_duration_minutes: number;
  break_entitlement_minutes: number;
  status: "active" | "completed";
  on_time: boolean;
  points_earned: number;
  tasks_completed: number;
};

export type StaffTask = {
  id: string;
  title: string;
  task_type: string;
  completed: boolean;
  completed_at: string | null;
  is_required: boolean;
  requires_photo: boolean;
  photo_path: string | null;
  sort_order: number;
};

export type ChecklistTemplate = {
  id: string;
  branch_id: string;
  role: StaffRole | null;
  title: string;
  requires_photo: boolean;
  is_required: boolean;
  sort_order: number;
  is_active: boolean;
};

export type Gamification = {
  points: number;
  badges: string[];
  streak_count: number;
};

/** Roles a supervisor may provision for their own branch. Mirrors the
 *  allowlist enforced by `private.register_branch_staff_impl` in Postgres. */
export const PROVISIONABLE_ROLES = [
  "employee",
  "cleaning_staff",
  "barista",
  "kitchen_manager",
] as const;

export type ProvisionableRole = (typeof PROVISIONABLE_ROLES)[number];

/** Domain used for suggested staff login emails. These addresses are login
 *  identifiers handed over with a temporary password — no mail is sent. */
export const STAFF_EMAIL_DOMAIN = "tres-staff.com";

const ARABIC_TO_LATIN: Record<string, string> = {
  ا: "a", أ: "a", إ: "e", آ: "a", ب: "b", ت: "t", ث: "th", ج: "j", ح: "h",
  خ: "kh", د: "d", ذ: "th", ر: "r", ز: "z", س: "s", ش: "sh", ص: "s", ض: "d",
  ط: "t", ظ: "z", ع: "a", غ: "gh", ف: "f", ق: "q", ك: "k", ل: "l", م: "m",
  ن: "n", ه: "h", و: "w", ي: "y", ى: "a", ئ: "e", ء: "", ؤ: "o", ة: "a",
};

/** Suggest a unique-ish login email from a (possibly Arabic) staff name. */
export function suggestStaffEmail(fullName: string): string {
  const slug = fullName
    .trim()
    .toLowerCase()
    .split("")
    .map((char) => ARABIC_TO_LATIN[char] ?? char)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  const digits = String(Math.floor(1000 + Math.random() * 9000));
  return `${slug || "staff"}-${digits}@${STAFF_EMAIL_DOMAIN}`;
}

/**
 * Bilingual (Arabic · English) operations messages for the employee-facing
 * staff app. Branch staff speak Arabic, Bengali, and English (Kenyan), so
 * every shift/task message pairs both languages. The database RPCs return
 * stable `code` values; these maps turn them into user-facing text.
 */
export type StaffErrorParams = {
  distance_meters?: unknown;
  allowed_radius_meters?: unknown;
};

const STAFF_ERRORS: Record<string, string | ((params: StaffErrorParams) => string)> = {
  outside_branch: (params) => {
    const distance = Math.round(Number(params.distance_meters ?? 0));
    const allowed = Math.round(Number(params.allowed_radius_meters ?? 0));
    return `أنت خارج نطاق الفرع — تبعد ${distance} م والمسموح ${allowed} م. · You are outside the branch area — ${distance}m away, allowed ${allowed}m.`;
  },
  low_accuracy:
    "إشارة الموقع ضعيفة — انتقل لمكان مكشوف وحاول مجددًا. · Weak GPS signal — move to an open area and retry.",
  no_branch:
    "لم يتم تعيين فرع لحسابك. · No branch is assigned to your account.",
  active_shift_exists:
    "لديك وردية جارية بالفعل. · You already have an active shift.",
  no_active_shift: "لا توجد وردية جارية. · No active shift found.",
  break_active:
    "أنهِ الاستراحة الجارية قبل إنهاء الوردية. · End your active break before ending the shift.",
  break_already_used:
    "استراحة اليوم مستخدمة بالفعل. · Today's break has already been used.",
  break_not_started: "لم تبدأ الاستراحة بعد. · Break has not started yet.",
  break_already_ended: "انتهت الاستراحة بالفعل. · Break has already ended.",
  incomplete_tasks:
    "أكمل جميع المهام المطلوبة قبل إنهاء الوردية. · Complete all required tasks before ending the shift.",
  task_not_found: "المهمة غير موجودة. · Task not found.",
  task_already_completed:
    "هذه المهمة مكتملة بالفعل. · This task is already completed.",
  task_not_manual:
    "تُكمل هذه المهمة تلقائيًا من نموذجها اليومي. · This task completes automatically from its daily form.",
  photo_required:
    "هذه المهمة تتطلب صورة إثبات. · This task requires a proof photo.",
};

const SQLSTATE_ERRORS: Record<string, string> = {
  "42501": "ليس لديك صلاحية لهذا الإجراء. · You are not allowed to perform this action.",
  "22023": "بيانات غير صالحة — حاول مرة أخرى. · Invalid data — please try again.",
  "28000": "انتهت الجلسة — سجّل الدخول مجددًا. · Session expired — sign in again.",
};

export const STAFF_GENERIC_ERROR =
  "تعذّر تنفيذ الإجراء — حاول مرة أخرى. · Something went wrong — please try again.";

/** Bilingual message for an RPC soft-failure result ({code, ...params}). */
export function staffErrorMessage(result: Record<string, unknown> | null | undefined): string {
  const code = typeof result?.code === "string" ? result.code : "";
  const entry = STAFF_ERRORS[code];
  if (typeof entry === "function") return entry(result as StaffErrorParams);
  if (entry) return entry;
  return STAFF_GENERIC_ERROR;
}

/** Bilingual message for a thrown Postgres error (by SQLSTATE). */
export function staffSqlErrorMessage(code: string | undefined | null): string {
  return (code && SQLSTATE_ERRORS[code]) || STAFF_GENERIC_ERROR;
}

export const ROLE_LABELS: Record<StaffRole, string> = {
  owner: "المالك",
  manager: "المدير",
  supervisor: "المشرف",
  employee: "موظف",
  cleaning_staff: "فريق النظافة",
  barista: "باريستا",
  kitchen_manager: "مدير المطبخ",
  shift_manager: "مدير الوردية",
};
