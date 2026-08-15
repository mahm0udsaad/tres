/**
 * Lightweight per-user i18n for the employee-facing staff app (ar/bn/en).
 * Each staff member has a `preferred_language`; their `/staff` views render in
 * that language and switch direction (rtl/ltr). Supervisor and owner surfaces
 * stay Arabic-only, so those strings are NOT in this dictionary.
 *
 * A plain dictionary + `t(key, lang, params)` — no framework. Values are either
 * a string or a function of params (for interpolated messages like the geofence
 * distance). RPC failure `code`s map straight to dictionary keys.
 */

import type { StaffLanguage } from "./staff-shared";

export type Lang = StaffLanguage;

export function dirFor(lang: Lang): "rtl" | "ltr" {
  return lang === "ar" ? "rtl" : "ltr";
}

export function localeFor(lang: Lang): string {
  if (lang === "ar") return "ar-SA";
  if (lang === "bn") return "bn-BD";
  return "en-US";
}

type Translation = string | ((params: Record<string, unknown>) => string);
type Entry = Record<"ar" | "en", Translation>;

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
  hour_short: { ar: "ساعة", en: "h" },
  manual_by_supervisor: { ar: "تم التسجيل يدوياً بواسطة المشرف", en: "Manually logged by supervisor" },

  // break
  break: { ar: "استراحة الوردية", en: "Shift break" },
  break_minutes_used: { ar: "دقيقة مستخدمة", en: "minutes used" },
  break_start: { ar: "بدء الاستراحة", en: "Start break" },
  break_end: { ar: "إنهاء الاستراحة", en: "End break" },
  break_done: { ar: "تمت الاستراحة", en: "Break used" },
  break_done_with_minutes: {
    ar: (p) => `تمت الاستراحة · ${p.count} دقيقة`,
    en: (p) => `Break used · ${p.count} min`,
  },
  break_in_progress: { ar: "الاستراحة جارية", en: "Break in progress" },
  break_elapsed: { ar: "مدة الاستراحة الحالية", en: "Current break duration" },
  break_remaining_live: {
    ar: (p) => `متبقي من رصيد الاستراحة: ${p.count} دقيقة`,
    en: (p) => `${p.count} min remaining in your allowance`,
  },
  break_start_with_remaining: {
    ar: (p) => `أخذ استراحة · متبقي ${p.count} دقيقة`,
    en: (p) => `Take a break · ${p.count} min remaining`,
  },
  break_used_and_remaining: {
    ar: (p) => `استخدمت ${p.used} دقيقة · المتبقي ${p.remaining} دقيقة`,
    en: (p) => `${p.used} min used · ${p.remaining} min remaining`,
  },
  break_allowance_finished: { ar: "اكتمل رصيد الاستراحة", en: "Break allowance fully used" },
  break_after_start: { ar: "تتاح بعد بدء الوردية.", en: "Available after the shift starts." },
  break_saving: { ar: "جارٍ حفظ الاستراحة…", en: "Saving your break…" },
  break_offline: {
    ar: "لا يوجد اتصال. تم حفظ طلب الاستراحة وسيُرسل تلقائياً عند عودة الإنترنت.",
    en: "You’re offline. Your break request is saved and will send automatically when you reconnect.",
  },

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
  break_already_active: { ar: "لديك استراحة جارية بالفعل.", en: "You already have an active break." },
  break_allowance_used: { ar: "اكتمل رصيد الاستراحة لهذه الوردية.", en: "Your break allowance is fully used." },
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
  photo_size: { ar: "حجم كل صورة يجب ألا يتجاوز 8 ميجابايت.", en: "Each photo must be under 8 MB." },
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

  // notification bell — the owner's verdict on finished work
  notifications: { ar: "الإشعارات", en: "Notifications" },
  notifications_unread: {
    ar: (p) => `${p.count} إشعار جديد`,
    en: (p) => `${p.count} new notification${Number(p.count) === 1 ? "" : "s"}`,
  },
  notifications_empty: { ar: "لا توجد إشعارات جديدة.", en: "No new notifications." },
  notifications_mark_read: { ar: "تعليم الكل كمقروء", en: "Mark all as read" },
  notif_task_approved: { ar: "تم اعتماد مهمتك", en: "Your task was approved" },
  notif_task_rejected: { ar: "تم رفض مهمتك", en: "Your task was rejected" },
  notif_report_approved: { ar: "تم اعتماد تقريرك", en: "Your report was approved" },
  notif_report_rejected: { ar: "تم رفض تقريرك", en: "Your report was rejected" },
};

/** Bengali employee pack. Arabic and English remain inline above because they
 *  are the management and fallback languages; nationality selects this pack
 *  automatically for Bangladeshi employees. */
const BENGALI: Record<string, Translation> = {
  panel_title: "কর্মীদের ড্যাশবোর্ড",
  greeting: (p) => `স্বাগতম, ${p.name}`,
  nav_home: "হোম",
  nav_daily_forms: "দৈনিক ফর্ম",
  nav_reports: "রিপোর্ট",
  nav_team: "শাখার দল",
  nav_checklist: "চেকলিস্ট",
  branch_unassigned: "এই অ্যাকাউন্টে কোনো শাখা নির্ধারিত নেই। কাজ শুরু করার আগে ব্যবস্থাপনার সাথে যোগাযোগ করুন।",
  logout: "সাইন আউট",
  ready_to_start: "শিফট শুরু করতে প্রস্তুত",
  shift_running: "শিফট চলছে",
  start_shift: "শিফট শুরু করুন",
  end_shift: "শিফট শেষ করুন",
  start_hint: "শাখার নির্ধারিত এলাকার ভেতরে থাকুন",
  end_hint: "প্রথমে আজকের কাজগুলো যাচাই করা হবে",
  hours_since: "ঘণ্টা আগে উপস্থিতি নথিভুক্ত হয়েছে",
  hour_short: "ঘণ্টা",
  manual_by_supervisor: "সুপারভাইজার ম্যানুয়ালি নথিভুক্ত করেছেন",
  break: "শিফটের বিরতি",
  break_minutes_used: "মিনিট ব্যবহার হয়েছে",
  break_start: "বিরতি শুরু করুন",
  break_end: "বিরতি শেষ করুন",
  break_done: "বিরতি নেওয়া হয়েছে",
  break_done_with_minutes: (p) => `বিরতি নেওয়া হয়েছে · ${p.count} মিনিট`,
  break_in_progress: "বিরতি চলছে",
  break_elapsed: "বর্তমান বিরতির সময়কাল",
  break_remaining_live: (p) => `বিরতির ${p.count} মিনিট বাকি`,
  break_start_with_remaining: (p) => `বিরতি নিন · ${p.count} মিনিট বাকি`,
  break_used_and_remaining: (p) => `${p.used} মিনিট ব্যবহার · ${p.remaining} মিনিট বাকি`,
  break_allowance_finished: "বিরতির সম্পূর্ণ সময় ব্যবহার হয়েছে",
  break_after_start: "শিফট শুরু করার পর পাওয়া যাবে।",
  break_saving: "বিরতির তথ্য সংরক্ষণ করা হচ্ছে…",
  break_offline: "ইন্টারনেট সংযোগ নেই। বিরতির অনুরোধ সংরক্ষিত আছে এবং সংযোগ ফিরলে স্বয়ংক্রিয়ভাবে পাঠানো হবে।",
  rewards: "আপনার অর্জন",
  total_points: "মোট পয়েন্ট",
  streak_days: "টানা দিনের ধারা",
  first_badge_hint: "প্রথম ব্যাজ পেতে আপনার প্রথম শিফট শেষ করুন",
  role_owner: "মালিক",
  role_manager: "ম্যানেজার",
  role_supervisor: "সুপারভাইজার",
  role_employee: "কর্মী",
  role_cleaning_staff: "পরিচ্ছন্নতা দল",
  role_barista: "বারিস্তা",
  role_kitchen_manager: "রান্নাঘর ব্যবস্থাপক",
  role_shift_manager: "শিফট ম্যানেজার",
  today_tasks: "আজকের কাজ",
  required: "আবশ্যক",
  photo_required_tag: "ছবি আবশ্যক",
  photo_attached_tag: "ছবি সংযুক্ত হয়েছে",
  no_tasks: "আজ আপনার জন্য কোনো কাজ নির্ধারিত নেই।",
  attach_photo_label: (p) => `${p.title} সম্পন্ন করতে ছবি সংযুক্ত করুন`,
  complete_label: (p) => `${p.title} সম্পন্ন করুন`,
  missing_title: "অসম্পূর্ণ প্রয়োজনীয়তা",
  missing_intro: "শিফট শেষ করার আগে এগুলো সম্পন্ন করুন:",
  open_daily_forms: "দৈনিক ফর্ম খুলুন",
  end_active_break: "চলমান বিরতি শেষ করুন",
  ok_shift_started: "শিফট শুরু হয়েছে।",
  ok_shift_ended: "দারুণ! শিফট সম্পন্ন হয়েছে।",
  ok_task_completed: "কাজটি সম্পন্ন হয়েছে।",
  ok_task_photo: "ছবির প্রমাণসহ কাজটি সম্পন্ন হয়েছে।",
  ok_break_started: "বিরতি শুরু হয়েছে।",
  ok_break_ended: "বিরতি শেষ হয়েছে।",
  geo_unsupported: "এই ব্রাউজার অবস্থান শনাক্তকরণ সমর্থন করে না।",
  geo_denied: "শিফট শুরু বা শেষ করতে অবস্থান ব্যবহারের অনুমতি দিন।",
  geo_unavailable: "সঠিক অবস্থান পাওয়া যায়নি—খোলা জায়গায় গিয়ে আবার চেষ্টা করুন।",
  geo_unreadable: "অবস্থান পড়া যায়নি। অবস্থানের অনুমতি চালু করে আবার চেষ্টা করুন।",
  outside_branch: (p) => `আপনি শাখার এলাকার বাইরে—দূরত্ব ${round(p.distance_meters)} মিটার, অনুমোদিত ${round(p.allowed_radius_meters)} মিটার।`,
  low_accuracy: "GPS সংকেত দুর্বল—খোলা জায়গায় গিয়ে আবার চেষ্টা করুন।",
  no_branch: "আপনার অ্যাকাউন্টে কোনো শাখা নির্ধারিত নেই।",
  active_shift_exists: "আপনার একটি শিফট ইতিমধ্যে চলছে।",
  no_active_shift: "কোনো চলমান শিফট পাওয়া যায়নি।",
  break_active: "শিফট শেষ করার আগে চলমান বিরতি শেষ করুন।",
  break_already_active: "আপনার বিরতি ইতিমধ্যে চলছে।",
  break_allowance_used: "এই শিফটের বিরতির সম্পূর্ণ সময় ব্যবহার হয়েছে।",
  break_not_started: "বিরতি এখনো শুরু হয়নি।",
  break_already_ended: "বিরতি ইতিমধ্যে শেষ হয়েছে।",
  incomplete_tasks: "শিফট শেষ করার আগে সব আবশ্যক কাজ সম্পন্ন করুন।",
  task_not_found: "কাজটি পাওয়া যায়নি।",
  task_already_completed: "এই কাজটি ইতিমধ্যে সম্পন্ন হয়েছে।",
  task_not_manual: "এই কাজটি দৈনিক ফর্ম জমা দিলে স্বয়ংক্রিয়ভাবে সম্পন্ন হবে।",
  photo_required: "এই কাজের জন্য প্রমাণের ছবি আবশ্যক।",
  attach_one_photo: "কাজ সম্পন্নের প্রমাণ হিসেবে একটি ছবি সংযুক্ত করুন।",
  generic_error: "কিছু ভুল হয়েছে—আবার চেষ্টা করুন।",
  photo_one_min: "অন্তত একটি ছবি সংযুক্ত করুন।",
  photo_max: (p) => `সর্বোচ্চ ${p.max}টি ছবি সংযুক্ত করা যাবে।`,
  photo_format: "ছবির ধরন সমর্থিত নয়—JPG, PNG, WebP অথবা HEIC ব্যবহার করুন।",
  photo_size: "প্রতিটি ছবির আকার ৮ মেগাবাইটের কম হতে হবে।",
  photo_upload_failed: "ছবি আপলোড করা যায়নি। সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।",
  no_branch_account: "এই অ্যাকাউন্টে কোনো শাখা নির্ধারিত নেই।",
  branch_check_failed: "আপনার শাখা যাচাই করা যায়নি।",
  step_start: "শিফট শুরু করুন",
  step_tasks: "আজকের কাজ",
  step_report: "আজকের রিপোর্ট",
  step_finish: "শিফট শেষ করুন",
  step_state_done: "সম্পন্ন",
  step_state_now: "এখন",
  step_state_wait: "পরে",
  items_left: (p) => `${p.count}টি বাকি`,
  all_done: "সব কাজ সম্পন্ন",
  finish_blocked_hint: "উপরের কাজগুলো শেষ করে শিফট শেষ করুন।",
  photo_take: "ছবি তুলুন",
  photo_take_more: "আরও ছবি যোগ করুন",
  photo_retake: "আবার তুলুন",
  photo_confirm: "এই ছবি ব্যবহার করুন",
  photo_selected: (p) => `${p.count}টি ছবি`,
  photo_optional: "ছবি (ঐচ্ছিক)",
  report_cleaning: "পরিচ্ছন্নতার রিপোর্ট",
  report_barista: "বার হস্তান্তর",
  report_kitchen: "রান্নাঘরের রিপোর্ট",
  report_pick_hint: "আজ যা সম্পন্ন করেছেন সেগুলো নির্বাচন করুন",
  report_pick_one: "অন্তত একটি বিষয় নির্বাচন করুন।",
  report_note_label: "নোট (ঐচ্ছিক)",
  report_note_hint: "অস্বাভাবিক কিছু থাকলেই শুধু লিখুন।",
  report_send: "পাঠান",
  report_sending: "পাঠানো হচ্ছে…",
  report_resend: "আবার পাঠান",
  report_state_pending: "সুপারভাইজারের অপেক্ষায়",
  report_state_confirmed: "অনুমোদিত",
  report_state_rejected: "সংশোধন প্রয়োজন",
  report_supervisor_notes: "সুপারভাইজারের নোট",
  bar_clean_confirm: "বার পরিষ্কার এবং হস্তান্তরের জন্য প্রস্তুত",
  bar_clean_required: "পাঠানোর আগে বার পরিষ্কার আছে নিশ্চিত করুন।",
  inventory_title: "আজকের মজুত গণনা",
  inventory_hint: "− এবং + বোতাম দিয়ে সংখ্যা ঠিক করুন",
  inventory_product: "পণ্য",
  inventory_dessert: "মিষ্টান্ন",
  inventory_decrease: (p) => `${p.name} কমান`,
  inventory_increase: (p) => `${p.name} বাড়ান`,
  inventory_invalid: "মজুতের সংখ্যা পড়া যায়নি—আবার চেষ্টা করুন।",
  water_title: "পানি পরীক্ষা",
  water_salt: "লবণাক্ততার মাত্রা",
  water_latest: "আজকের সর্বশেষ মাপ",
  water_send: "পরীক্ষা নথিভুক্ত করুন",
  water_sending: "নথিভুক্ত হচ্ছে…",
  water_invalid: "সঠিক মান লিখুন (০ বা তার বেশি)।",
  water_photo_one: "মাপের একটি ছবি সংযুক্ত করুন।",
  water_saved: "পানি পরীক্ষা নথিভুক্ত হয়েছে।",
  beverage_title: "আজকের আপনার পানীয়",
  beverage_yes: "নিয়েছি",
  beverage_no: "নিইনি",
  beverage_none_yet: "এখনো নথিভুক্ত হয়নি",
  beverage_saved: "সংরক্ষিত হয়েছে।",
  report_sent: "রিপোর্ট পর্যালোচনার জন্য পাঠানো হয়েছে।",
  report_save_failed: "রিপোর্ট সংরক্ষণ করা যায়নি—আবার চেষ্টা করুন।",
  report_wrong_role: "এই রিপোর্টটি আপনার ভূমিকার জন্য নয়।",
  report_not_allowed: "এই কাজের অনুমতি আপনার নেই।",
  note_too_long: "নোটটি অনেক বড়।",
  daily_operations: "আজকের রিপোর্ট ও কাজ",
  submit_report: "রিপোর্ট জমা দিন",
  attach_photo: "ছবি সংযুক্ত করুন",
  report_submitted: "আজকের রিপোর্ট পাঠানো হয়েছে। সুপারভাইজারের সিদ্ধান্ত এখানে দেখা যাবে।",
  report_pending: "আজকের রিপোর্ট পাঠানো হয়েছে এবং সুপারভাইজারের পর্যালোচনার অপেক্ষায় আছে।",
  report_confirmed: "আজকের রিপোর্ট ইতিমধ্যে অনুমোদিত।",
  report_check_failed: "আজকের রিপোর্ট যাচাই করা যায়নি।",
  notifications: "বিজ্ঞপ্তি",
  notifications_unread: (p) => `${p.count}টি নতুন বিজ্ঞপ্তি`,
  notifications_empty: "নতুন কোনো বিজ্ঞপ্তি নেই।",
  notifications_mark_read: "সব পঠিত হিসেবে চিহ্নিত করুন",
  notif_task_approved: "আপনার কাজ অনুমোদিত হয়েছে",
  notif_task_rejected: "আপনার কাজ প্রত্যাখ্যাত হয়েছে",
  notif_report_approved: "আপনার রিপোর্ট অনুমোদিত হয়েছে",
  notif_report_rejected: "আপনার রিপোর্ট প্রত্যাখ্যাত হয়েছে",
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

function resolve(
  key: string,
  entry: Entry | undefined,
  lang: Lang,
  params: Record<string, unknown>,
): string | null {
  if (!entry) return null;
  const value = lang === "bn" ? BENGALI[key] ?? entry.en : entry[lang];
  return typeof value === "function" ? value(params) : value;
}

/** Translate a dictionary key. Unknown keys fall back to the generic error. */
export function t(key: string, lang: Lang, params: Record<string, unknown> = {}): string {
  return resolve(key, DICT[key], lang, params) ?? resolve("generic_error", DICT.generic_error, lang, params) ?? key;
}

/** Translate an RPC soft-failure result ({code, ...params}) in the member's language. */
export function staffErrorMessage(result: Record<string, unknown> | null | undefined, lang: Lang): string {
  const code = typeof result?.code === "string" ? result.code : "";
  return resolve(code, DICT[code], lang, result ?? {}) ?? resolve("generic_error", DICT.generic_error, lang, {})!;
}

/** Translate a thrown Postgres error (by SQLSTATE) in the member's language. */
export function staffSqlErrorMessage(code: string | undefined | null, lang: Lang): string {
  if (lang === "bn") {
    const messages: Record<string, string> = {
      "42501": "এই কাজ করার অনুমতি আপনার নেই।",
      "22023": "তথ্য সঠিক নয়—আবার চেষ্টা করুন।",
      "28000": "সেশনের মেয়াদ শেষ—আবার সাইন ইন করুন।",
    };
    return (code ? messages[code] : null) ?? String(BENGALI.generic_error);
  }
  return resolve(code ?? "", code ? SQLSTATE[code] : undefined, lang, {})
    ?? resolve("generic_error", DICT.generic_error, lang, {})!;
}
