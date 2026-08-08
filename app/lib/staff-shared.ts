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

export const STAFF_LANGUAGES = ["ar", "bn", "en"] as const;
export type StaffLanguage = (typeof STAFF_LANGUAGES)[number];

export type StaffProfile = {
  user_id: string;
  full_name: string;
  role: StaffRole;
  branch_id: string | null;
  scheduled_start: string | null;
  is_active: boolean;
  nationality: string;
  preferred_language: StaffLanguage;
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
  supervisor_override_by: string | null;
};

export type StaffTask = {
  id: string;
  title: string;
  notes: string | null;
  task_type: string;
  completed: boolean;
  completed_at: string | null;
  is_required: boolean;
  requires_photo: boolean;
  requires_note: boolean;
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

/** Supabase Auth phone identifiers must be E.164. We accept common display
 * punctuation and international dialing prefix 00 in management forms. */
export function normalizeStaffPhone(value: string): string {
  return value.trim().replace(/[\s()-]/g, "").replace(/^00/, "+");
}

export function isStaffPhone(value: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(normalizeStaffPhone(value));
}

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

/** Allowed staff nationalities (value stored in DB = English canonical, matches
 *  the `staff_profiles_nationality_check` constraint). Labels are Arabic since
 *  the creation panels are Arabic. Saudi first, "Other" last. */
export const NATIONALITIES: { value: string; label: string }[] = [
  { value: "Saudi Arabia", label: "السعودية" },
  { value: "Egypt", label: "مصر" },
  { value: "Yemen", label: "اليمن" },
  { value: "Sudan", label: "السودان" },
  { value: "Jordan", label: "الأردن" },
  { value: "Kenya", label: "كينيا" },
  { value: "Bangladesh", label: "بنغلاديش" },
  { value: "India", label: "الهند" },
  { value: "Pakistan", label: "باكستان" },
  { value: "Philippines", label: "الفلبين" },
  { value: "Ethiopia", label: "إثيوبيا" },
  { value: "Nepal", label: "نيبال" },
  { value: "Sri Lanka", label: "سريلانكا" },
  { value: "Indonesia", label: "إندونيسيا" },
  { value: "Uganda", label: "أوغندا" },
  { value: "Tanzania", label: "تنزانيا" },
  { value: "Other", label: "أخرى" },
];

export const NATIONALITY_VALUES = NATIONALITIES.map((n) => n.value);

export const LANGUAGE_LABELS: Record<StaffLanguage, string> = {
  ar: "العربية",
  bn: "বাংলা · البنغالية",
  en: "الإنجليزية",
};

/** Employee language follows nationality. TRES currently supports the three
 *  languages used by its team: Arabic, Bengali, and English. */
export function languageForNationality(nationality: string): StaffLanguage {
  if (["Saudi Arabia", "Egypt", "Yemen", "Sudan", "Jordan"].includes(nationality)) {
    return "ar";
  }
  if (nationality === "Bangladesh") return "bn";
  return "en";
}

/** Roles whose surfaces stay Arabic-only: they read the review queue, branch
 *  settings, and team panels, which are written for management. */
export const ADMIN_ROLES: StaffRole[] = ["owner", "manager", "supervisor", "shift_manager"];

export function isAdminRole(role: StaffRole): boolean {
  return ADMIN_ROLES.includes(role);
}

/** The language a signed-in member's dashboard renders in. Single source of
 *  truth for the layout direction and every page under /staff. */
export function dashboardLang(
  profile: Pick<StaffProfile, "role" | "preferred_language">,
): StaffLanguage {
  return isAdminRole(profile.role) ? "ar" : profile.preferred_language;
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
