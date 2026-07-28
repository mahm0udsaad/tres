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
