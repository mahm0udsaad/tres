/**
 * Lightweight per-user i18n for the employee-facing staff app (Phase 1: ar/en).
 * Each staff member has a `preferred_language`; their `/staff` views render in
 * that language and switch direction (rtl/ltr). Supervisor and owner surfaces
 * stay Arabic-only, so those strings are NOT in this dictionary.
 *
 * A plain dictionary + `t(key, lang, params)` — no framework. Values are either
 * a string or a function of params (for interpolated messages like the geofence
 * distance). RPC failure `code`s map straight to dictionary keys.
 */

export type Lang = "ar" | "en";

export function dirFor(lang: Lang): "rtl" | "ltr" {
  return lang === "ar" ? "rtl" : "ltr";
}

type Entry = Record<Lang, string | ((params: Record<string, unknown>) => string)>;

const DICT: Record<string, Entry> = {
  // dashboard chrome
  panel_title: { ar: "لوحة الموظفين", en: "Staff dashboard" },
  greeting: { ar: (p) => `مرحباً، ${p.name}`, en: (p) => `Welcome, ${p.name}` },
  nav_home: { ar: "الرئيسية", en: "Home" },
  nav_daily_forms: { ar: "النماذج اليومية", en: "Daily forms" },
  nav_reports: { ar: "التقارير", en: "Reports" },
  nav_team: { ar: "فريق الفرع", en: "Branch team" },
  nav_checklist: { ar: "قائمة المهام", en: "Checklist" },
  branch_unassigned: {
    ar: "لم يتم تعيين فرع لهذا الحساب. تواصل مع الإدارة قبل بدء العمل.",
    en: "No branch is assigned to this account. Contact management before starting.",
  },
  logout: { ar: "تسجيل الخروج", en: "Sign out" },

  // shift card
  ready_to_start: { ar: "جاهز لبدء الوردية", en: "Ready to start" },
  shift_running: { ar: "وردية جارية", en: "Shift running" },
  start_shift: { ar: "بدء الوردية", en: "Start shift" },
  end_shift: { ar: "إنهاء الوردية", en: "End shift" },
  start_hint: { ar: "يجب أن تكون داخل نطاق الفرع", en: "Be inside the branch area" },
  end_hint: { ar: "سيتم التحقق من مهام اليوم أولاً", en: "Today's tasks are checked first" },
  hours_since: { ar: "ساعة منذ تسجيل الحضور", en: "hours since clock-in" },
  manual_by_supervisor: { ar: "تم التسجيل يدوياً بواسطة المشرف", en: "Manually logged by supervisor" },

  // break
  break: { ar: "استراحة الوردية", en: "Shift break" },
  break_minutes_used: { ar: "دقيقة مستخدمة", en: "minutes used" },
  break_start: { ar: "بدء الاستراحة", en: "Start break" },
  break_end: { ar: "إنهاء الاستراحة", en: "End break" },
  break_done: { ar: "تمت الاستراحة", en: "Break used" },
  break_after_start: { ar: "تتاح بعد بدء الوردية.", en: "Available after the shift starts." },

  // rewards
  rewards: { ar: "إنجازك", en: "Your rewards" },
  total_points: { ar: "نقطة إجمالية", en: "total points" },
  streak_days: { ar: "أيام متتالية", en: "day streak" },
  first_badge_hint: { ar: "أكمل أول وردية لفتح شارة", en: "Complete your first shift to earn a badge" },

  // role chip — ROLE_LABELS in staff-shared.ts stays Arabic for the management
  // surfaces; an employee sees their own role in their own language.
  role_owner: { ar: "المالك", en: "Owner" },
  role_manager: { ar: "المدير", en: "Manager" },
  role_supervisor: { ar: "المشرف", en: "Supervisor" },
  role_employee: { ar: "موظف", en: "Employee" },
  role_cleaning_staff: { ar: "فريق النظافة", en: "Cleaning team" },
  role_barista: { ar: "باريستا", en: "Barista" },
  role_kitchen_manager: { ar: "مدير المطبخ", en: "Kitchen manager" },
  role_shift_manager: { ar: "مدير الوردية", en: "Shift manager" },

  // tasks
  today_tasks: { ar: "مهام اليوم", en: "Daily tasks" },
  required: { ar: "مطلوبة", en: "Required" },
  photo_required_tag: { ar: "تتطلب صورة", en: "Photo required" },
  photo_attached_tag: { ar: "تم إرفاق صورة", en: "Photo attached" },
  no_tasks: { ar: "لا توجد مهام مخصصة لك اليوم.", en: "You have no tasks assigned today." },
  attach_photo_label: {
    ar: (p) => `إرفاق صورة لإكمال ${p.title}`,
    en: (p) => `Attach a photo to complete ${p.title}`,
  },
  complete_label: {
    ar: (p) => `إكمال ${p.title}`,
    en: (p) => `Complete ${p.title}`,
  },

  // missing-requirements card
  missing_title: { ar: "متطلبات ناقصة", en: "Missing requirements" },
  missing_intro: { ar: "أكمل هذه العناصر قبل إنهاء الوردية:", en: "Complete these before ending your shift:" },
  open_daily_forms: { ar: "فتح النماذج اليومية", en: "Open daily forms" },
  end_active_break: { ar: "إنهاء الاستراحة الجارية", en: "End the active break" },

  // success toasts
  ok_shift_started: { ar: "بدأت الوردية بنجاح.", en: "Shift started." },
  ok_shift_ended: { ar: "أحسنت! اكتملت الوردية.", en: "Great job — shift completed." },
  ok_task_completed: { ar: "تم إكمال المهمة.", en: "Task completed." },
  ok_task_photo: { ar: "تم إكمال المهمة بإثبات مصوّر.", en: "Task completed with photo proof." },
  ok_break_started: { ar: "بدأت الاستراحة.", en: "Break started." },
  ok_break_ended: { ar: "انتهت الاستراحة.", en: "Break ended." },

  // client geolocation errors
  geo_unsupported: { ar: "هذا المتصفح لا يدعم تحديد الموقع.", en: "This browser does not support location." },
  geo_denied: {
    ar: "اسمح بالوصول إلى الموقع لبدء أو إنهاء الوردية.",
    en: "Allow location access to start or end your shift.",
  },
  geo_unavailable: {
    ar: "تعذّر تحديد موقعك بدقة — حاول في مكان مكشوف.",
    en: "Couldn't get an accurate location — try again outdoors.",
  },
  geo_unreadable: {
    ar: "تعذّر قراءة الموقع. فعّل إذن الموقع وحاول مرة أخرى.",
    en: "Couldn't read your location. Enable location and try again.",
  },

  // RPC failure codes (returned by start/end/complete/break RPCs)
  outside_branch: {
    ar: (p) => `أنت خارج نطاق الفرع — تبعد ${round(p.distance_meters)} م والمسموح ${round(p.allowed_radius_meters)} م.`,
    en: (p) => `You are outside the branch area — ${round(p.distance_meters)}m away, allowed ${round(p.allowed_radius_meters)}m.`,
  },
  low_accuracy: {
    ar: "إشارة الموقع ضعيفة — انتقل لمكان مكشوف وحاول مجددًا.",
    en: "Weak GPS signal — move to an open area and retry.",
  },
  no_branch: { ar: "لم يتم تعيين فرع لحسابك.", en: "No branch is assigned to your account." },
  active_shift_exists: { ar: "لديك وردية جارية بالفعل.", en: "You already have an active shift." },
  no_active_shift: { ar: "لا توجد وردية جارية.", en: "No active shift found." },
  break_active: {
    ar: "أنهِ الاستراحة الجارية قبل إنهاء الوردية.",
    en: "End your active break before ending the shift.",
  },
  break_already_used: { ar: "استراحة اليوم مستخدمة بالفعل.", en: "Today's break has already been used." },
  break_not_started: { ar: "لم تبدأ الاستراحة بعد.", en: "Break has not started yet." },
  break_already_ended: { ar: "انتهت الاستراحة بالفعل.", en: "Break has already ended." },
  incomplete_tasks: {
    ar: "أكمل جميع المهام المطلوبة قبل إنهاء الوردية.",
    en: "Complete all required tasks before ending the shift.",
  },
  task_not_found: { ar: "المهمة غير موجودة.", en: "Task not found." },
  task_already_completed: { ar: "هذه المهمة مكتملة بالفعل.", en: "This task is already completed." },
  task_not_manual: {
    ar: "تُكمل هذه المهمة تلقائيًا من نموذجها اليومي.",
    en: "This task completes automatically from its daily form.",
  },
  photo_required: { ar: "هذه المهمة تتطلب صورة إثبات.", en: "This task requires a proof photo." },
  attach_one_photo: { ar: "أرفق صورة واحدة لإثبات إنجاز المهمة.", en: "Attach one photo as proof." },
  generic_error: { ar: "تعذّر تنفيذ الإجراء — حاول مرة أخرى.", en: "Something went wrong — please try again." },

  // photo/upload validation (shared evidence helpers)
  photo_one_min: { ar: "يجب إرفاق صورة واحدة على الأقل.", en: "Attach at least one photo." },
  photo_max: {
    ar: (p) => `يمكن إرفاق ${p.max} صور كحد أقصى.`,
    en: (p) => `Maximum ${p.max} photos.`,
  },
  photo_format: {
    ar: "صيغة الصورة غير مدعومة — استخدم JPG أو PNG أو WebP أو HEIC.",
    en: "Unsupported image format — use JPG, PNG, WebP, or HEIC.",
  },
  photo_size: { ar: "حجم كل صورة يجب ألا يتجاوز 3 ميجابايت.", en: "Each photo must be under 3 MB." },
  photo_upload_failed: {
    ar: "تعذّر رفع الصور. تحقق من الاتصال وحاول مرة أخرى.",
    en: "Photo upload failed. Check your connection and try again.",
  },
  no_branch_account: { ar: "لم يتم تعيين فرع لهذا الحساب.", en: "No branch assigned to this account." },
  branch_check_failed: { ar: "تعذّر التحقق من فرعك.", en: "Couldn't verify your branch." },

  // ── the four steps of a shift ───────────────────────────────────────────
  step_start: { ar: "ابدأ الوردية", en: "Start your shift" },
  step_tasks: { ar: "مهام اليوم", en: "Today's tasks" },
  step_report: { ar: "تقرير اليوم", en: "Today's report" },
  step_finish: { ar: "أنهِ الوردية", en: "Finish your shift" },
  step_state_done: { ar: "تم", en: "Done" },
  step_state_now: { ar: "الآن", en: "Now" },
  step_state_wait: { ar: "لاحقاً", en: "Later" },
  items_left: {
    ar: (p) => (Number(p.count) === 1 ? "بقي عنصر واحد" : `بقي ${p.count} عناصر`),
    en: (p) => (Number(p.count) === 1 ? "1 item left" : `${p.count} items left`),
  },
  all_done: { ar: "كل شيء مكتمل", en: "Everything is done" },
  finish_blocked_hint: {
    ar: "أكمل العناصر أعلاه ثم أنهِ الوردية.",
    en: "Finish the items above, then end your shift.",
  },

  // ── photo capture ───────────────────────────────────────────────────────
  photo_take: { ar: "التقط صورة", en: "Take a photo" },
  photo_take_more: { ar: "أضف صوراً", en: "Add photos" },
  photo_retake: { ar: "إعادة التصوير", en: "Retake" },
  photo_confirm: { ar: "تأكيد الصورة", en: "Use this photo" },
  photo_selected: {
    ar: (p) => (Number(p.count) === 1 ? "صورة واحدة" : `${p.count} صور`),
    en: (p) => (Number(p.count) === 1 ? "1 photo" : `${p.count} photos`),
  },
  photo_optional: { ar: "صورة (اختياري)", en: "Photo (optional)" },

  // ── daily reports (tap-to-answer) ───────────────────────────────────────
  report_cleaning: { ar: "تقرير النظافة", en: "Cleaning report" },
  report_barista: { ar: "تسليم البار", en: "Bar handover" },
  report_kitchen: { ar: "تقرير المطبخ", en: "Kitchen report" },
  report_pick_hint: { ar: "اضغط على ما أنجزته اليوم", en: "Tap what you finished today" },
  report_pick_one: { ar: "اختر عنصراً واحداً على الأقل.", en: "Tap at least one item." },
  report_note_label: { ar: "ملاحظة (اختياري)", en: "Note (optional)" },
  report_note_hint: { ar: "اكتب فقط إذا كان هناك شيء غير عادي.", en: "Only write if something is unusual." },
  report_send: { ar: "إرسال", en: "Send" },
  report_sending: { ar: "جارٍ الإرسال…", en: "Sending…" },
  report_resend: { ar: "إعادة الإرسال", en: "Send again" },
  report_state_pending: { ar: "بانتظار المشرف", en: "Waiting for supervisor" },
  report_state_confirmed: { ar: "معتمد", en: "Approved" },
  report_state_rejected: { ar: "يحتاج تعديل", en: "Needs fixing" },
  report_supervisor_notes: { ar: "ملاحظة المشرف", en: "Supervisor's note" },
  bar_clean_confirm: { ar: "البار نظيف وجاهز للتسليم", en: "The bar is clean and ready to hand over" },
  bar_clean_required: { ar: "أكد أن البار نظيف قبل الإرسال.", en: "Confirm the bar is clean before sending." },

  // ── kitchen stock count ─────────────────────────────────────────────────
  inventory_title: { ar: "جرد اليوم", en: "Today's count" },
  inventory_hint: { ar: "اضبط العدد بزر − و +", en: "Set each count with − and +" },
  inventory_product: { ar: "منتج", en: "Product" },
  inventory_dessert: { ar: "حلوى", en: "Dessert" },
  inventory_decrease: { ar: (p) => `إنقاص ${p.name}`, en: (p) => `Decrease ${p.name}` },
  inventory_increase: { ar: (p) => `زيادة ${p.name}`, en: (p) => `Increase ${p.name}` },
  inventory_invalid: { ar: "تعذّر قراءة الجرد — حاول مرة أخرى.", en: "Couldn't read the count — try again." },

  // ── water check ─────────────────────────────────────────────────────────
  water_title: { ar: "فحص المياه", en: "Water check" },
  water_salt: { ar: "نسبة الملوحة", en: "Salt reading" },
  water_latest: { ar: "آخر قراءة اليوم", en: "Latest reading today" },
  water_send: { ar: "تسجيل الفحص", en: "Log the check" },
  water_sending: { ar: "جارٍ التسجيل…", en: "Logging…" },
  water_invalid: { ar: "أدخل قراءة صحيحة (0 أو أكثر).", en: "Enter a valid reading (0 or more)." },
  water_photo_one: { ar: "أرفق صورة واحدة للقراءة.", en: "Attach one photo of the reading." },
  water_saved: { ar: "تم تسجيل فحص المياه.", en: "Water check logged." },

  // ── daily beverage ──────────────────────────────────────────────────────
  beverage_title: { ar: "مشروبك اليوم", en: "Your drink today" },
  beverage_yes: { ar: "أخذته", en: "I had it" },
  beverage_no: { ar: "لم آخذه", en: "I didn't" },
  beverage_none_yet: { ar: "لم تسجّل بعد", en: "Not logged yet" },
  beverage_saved: { ar: "تم التسجيل.", en: "Saved." },

  // ── report action results ───────────────────────────────────────────────
  report_sent: { ar: "تم إرسال التقرير للمراجعة.", en: "Report sent for review." },
  report_save_failed: { ar: "تعذّر حفظ التقرير — حاول مرة أخرى.", en: "Couldn't save the report — try again." },
  report_wrong_role: { ar: "هذا التقرير ليس مخصصاً لدورك.", en: "This report isn't for your role." },
  report_not_allowed: { ar: "ليس لديك صلاحية لهذا الإجراء.", en: "You are not allowed to do this." },
  note_too_long: { ar: "الملاحظة طويلة جداً.", en: "That note is too long." },

  // submissions chrome
  daily_operations: { ar: "تقارير ومهام اليوم", en: "Today's reports & tasks" },
  submit_report: { ar: "إرسال التقرير", en: "Submit report" },
  attach_photo: { ar: "إرفاق صورة", en: "Attach photo" },
  report_submitted: {
    ar: "تم إرسال تقرير اليوم. ستظهر هنا نتيجة مراجعة المشرف.",
    en: "Today's report was submitted. The supervisor's review will appear here.",
  },
  report_pending: { ar: "تم إرسال تقرير اليوم وهو بانتظار مراجعة المشرف.", en: "Today's report is submitted and awaiting supervisor review." },
  report_confirmed: { ar: "تم اعتماد تقرير اليوم بالفعل.", en: "Today's report is already approved." },
  report_check_failed: { ar: "تعذّر التحقق من تقرير اليوم.", en: "Couldn't check today's report." },
};

// SQLSTATE fallbacks for thrown (non-soft) DB errors.
const SQLSTATE: Record<string, Entry> = {
  "42501": {
    ar: "ليس لديك صلاحية لهذا الإجراء.",
    en: "You are not allowed to perform this action.",
  },
  "22023": { ar: "بيانات غير صالحة — حاول مرة أخرى.", en: "Invalid data — please try again." },
  "28000": { ar: "انتهت الجلسة — سجّل الدخول مجددًا.", en: "Session expired — sign in again." },
};

function round(value: unknown): number {
  return Math.round(Number(value ?? 0));
}

function resolve(entry: Entry | undefined, lang: Lang, params: Record<string, unknown>): string | null {
  if (!entry) return null;
  const value = entry[lang] ?? entry.en;
  return typeof value === "function" ? value(params) : value;
}

/** Translate a dictionary key. Unknown keys fall back to the generic error. */
export function t(key: string, lang: Lang, params: Record<string, unknown> = {}): string {
  return resolve(DICT[key], lang, params) ?? resolve(DICT.generic_error, lang, params) ?? key;
}

/** Translate an RPC soft-failure result ({code, ...params}) in the member's language. */
export function staffErrorMessage(result: Record<string, unknown> | null | undefined, lang: Lang): string {
  const code = typeof result?.code === "string" ? result.code : "";
  return resolve(DICT[code], lang, result ?? {}) ?? resolve(DICT.generic_error, lang, {})!;
}

/** Translate a thrown Postgres error (by SQLSTATE) in the member's language. */
export function staffSqlErrorMessage(code: string | undefined | null, lang: Lang): string {
  return resolve(code ? SQLSTATE[code] : undefined, lang, {}) ?? resolve(DICT.generic_error, lang, {})!;
}
