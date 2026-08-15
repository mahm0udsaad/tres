"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "../../lib/staff";

export type ReviewActionState = {
  error?: string;
  message?: string;
};

const REPORT_TYPES = new Set(["cleaning", "barista", "kitchen"]);
const DECISIONS = new Set(["confirmed", "rejected"]);

function formText(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

export async function reviewStaffReport(
  _previous: ReviewActionState | undefined,
  form: FormData,
): Promise<ReviewActionState> {
  const { profile, supabase } = await requireStaff();

  // Server actions are public POST endpoints. Never trust the role or branch
  // included in the submitted form.
  if (profile.role !== "owner" && profile.role !== "supervisor") {
    return { error: "هذا الإجراء متاح للمالك والمشرف فقط." };
  }

  const reportType = formText(form, "report_type");
  const reportId = formText(form, "report_id");
  const decision = formText(form, "decision");
  const reviewNotes = formText(form, "review_notes");

  if (!REPORT_TYPES.has(reportType) || !reportId || !DECISIONS.has(decision)) {
    return { error: "بيانات المراجعة غير صالحة." };
  }
  if (decision === "rejected" && !reviewNotes) {
    return { error: "اكتب سبب الرفض قبل إرسال المراجعة." };
  }

  const { data, error } = await supabase.rpc("review_staff_report", {
    p_report_type: reportType,
    p_report_id: reportId,
    p_decision: decision,
    p_review_notes: reviewNotes || null,
  });

  const result =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : null;

  if (error || result?.ok === false) {
    return {
      error:
        error?.message ||
        String(result?.message ?? "تعذّر حفظ المراجعة. حاول مرة أخرى."),
    };
  }

  revalidatePath("/staff/reports");
  return {
    message:
      decision === "confirmed"
        ? "تم تأكيد التقرير."
        : "تم رفض التقرير وإرسال الملاحظات.",
  };
}

const TASK_DECISIONS = new Set(["approved", "rejected"]);

const TASK_REVIEW_ERRORS: Record<string, string> = {
  decision_invalid: "قرار المراجعة غير صالح.",
  review_notes_required: "اكتب سبب الرفض قبل الإرسال.",
  review_notes_invalid: "الملاحظات طويلة جداً.",
  task_not_found: "المهمة غير موجودة.",
  task_not_completed: "لا يمكن مراجعة مهمة لم ينهها الموظف بعد.",
  task_already_reviewed: "تمت مراجعة هذه المهمة من قبل.",
};

export async function reviewTask(
  _previous: ReviewActionState | undefined,
  form: FormData,
): Promise<ReviewActionState> {
  const { profile, supabase } = await requireStaff();

  // Server actions are public POST endpoints — re-check the role server side.
  if (profile.role !== "owner" && profile.role !== "supervisor") {
    return { error: "هذا الإجراء متاح للمالك والمشرف فقط." };
  }

  const taskId = formText(form, "task_id");
  const decision = formText(form, "decision");
  const reviewNotes = formText(form, "review_notes");
  // Rejection is two-sided: reopen the task for a redo, or close it as-is.
  const reopen = formText(form, "reopen") === "redo";

  if (!taskId || !TASK_DECISIONS.has(decision)) {
    return { error: TASK_REVIEW_ERRORS.decision_invalid };
  }
  if (decision === "rejected" && !reviewNotes) {
    return { error: TASK_REVIEW_ERRORS.review_notes_required };
  }

  const { data, error } = await supabase.rpc("review_task", {
    p_task_id: taskId,
    p_decision: decision,
    p_review_notes: reviewNotes || null,
    p_reopen: reopen,
  });

  const result = (data ?? {}) as Record<string, unknown>;
  if (error || result.ok !== true) {
    const code = typeof result.code === "string" ? result.code : "";
    if (error?.code === "42501") return { error: "لا تملك صلاحية مراجعة مهام هذا الفرع." };
    return { error: TASK_REVIEW_ERRORS[code] ?? "تعذّر حفظ المراجعة. حاول مرة أخرى." };
  }

  revalidatePath("/staff/reports");
  revalidatePath("/staff/checklist");
  if (decision === "approved") return { message: "تم اعتماد المهمة وإشعار الموظف." };
  return {
    message: result.reopened === true
      ? "تم رفض المهمة وإعادتها للموظف مع السبب."
      : "تم رفض المهمة وإشعار الموظف.",
  };
}

export async function logoutStaffReports() {
  const { supabase } = await requireStaff();
  await supabase.auth.signOut();
  redirect("/staff/login");
}
