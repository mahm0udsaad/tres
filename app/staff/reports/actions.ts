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

export async function logoutStaffReports() {
  const { supabase } = await requireStaff();
  await supabase.auth.signOut();
  redirect("/staff/login");
}
