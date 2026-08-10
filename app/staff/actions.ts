"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getStaffContext, requireStaff } from "../lib/staff";
import { supabaseServer } from "../lib/supabase-server";
import {
  branchDay,
  imageFiles,
  removeEvidence,
  uploadEvidence,
  validateImages,
} from "./evidence";
import { staffErrorMessage, staffSqlErrorMessage, t } from "../lib/staff-i18n";
import { dashboardLang } from "../lib/staff-shared";
import { resolveShareLink } from "../lib/geo-link";

export type StaffActionState = {
  error?: string;
  message?: string;
  operation?: string;
  result?: Record<string, unknown>;
};

function text(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function number(value: FormDataEntryValue | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function loginStaff(
  _previous: StaffActionState | undefined,
  form: FormData,
): Promise<StaffActionState> {
  const countryCode = text(form.get("phone_country")) || "+966";
  const phoneNumber = text(form.get("phone_number"));
  const identifier = phoneNumber ? `${countryCode}${phoneNumber}` : text(form.get("phone"));
  const password = text(form.get("password"));
  if (!identifier || !password) return { error: "أدخل رقم الجوال وكلمة المرور." };

  let supabase;
  try {
    supabase = await supabaseServer();
  } catch {
    return { error: "لم يتم إعداد اتصال Supabase بعد." };
  }

  const normalized = identifier.replace(/[\s()-]/g, "").replace(/^00/, "+");
  const credentials = normalized.startsWith("+")
    ? { phone: normalized, password }
    : { email: normalized.toLowerCase(), password };
  const { error } = await supabase.auth.signInWithPassword(credentials);
  if (error) return { error: "بيانات الدخول غير صحيحة." };

  const next = text(form.get("next"));
  redirect(next.startsWith("/staff") && next !== "/staff/login" ? next : "/staff");
}

export async function logoutStaff() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect("/staff/login");
}

export async function staffOperation(
  _previous: StaffActionState | undefined,
  form: FormData,
): Promise<StaffActionState> {
  const { supabase, profile } = await requireStaff();
  const lang = dashboardLang(profile);
  const operation = text(form.get("operation"));
  let rpc:
    | "start_shift"
    | "end_shift"
    | "set_break"
    | "complete_task"
    | "update_own_branch";
  let args: Record<string, string | number>;

  if (operation === "start_shift" || operation === "end_shift") {
    const latitude = number(form.get("latitude"));
    const longitude = number(form.get("longitude"));
    const accuracy = number(form.get("accuracy"));
    if (latitude == null || longitude == null || accuracy == null) {
      return { error: t("geo_unreadable", lang), operation };
    }
    rpc = operation;
    args = {
      p_latitude: latitude,
      p_longitude: longitude,
      p_accuracy_meters: accuracy,
    };
  } else if (operation === "start_break" || operation === "end_break") {
    rpc = "set_break";
    args = { p_action: operation === "start_break" ? "start" : "end" };
  } else if (operation === "complete_task") {
    const taskId = text(form.get("task_id"));
    if (!taskId) return { error: t("task_not_found", lang), operation };
    rpc = "complete_task";
    const answer = text(form.get("task_yes_no_answer"));
    args = { p_task_id: taskId, p_note: text(form.get("task_note")) };
    if (answer === "true" || answer === "false") args.p_yes_no_answer = answer;
  } else {
    return { error: t("generic_error", lang), operation };
  }

  const { data, error } = await supabase.rpc(rpc, args);
  if (error) {
    return { error: staffSqlErrorMessage(error.code, lang), operation };
  }

  const result = (data ?? {}) as Record<string, unknown>;
  if (result.ok !== true) {
    return { error: staffErrorMessage(result, lang), operation, result };
  }

  revalidatePath("/staff");
  return {
    message: t(
      operation === "start_shift"
        ? "ok_shift_started"
        : operation === "end_shift"
          ? "ok_shift_ended"
          : operation === "complete_task"
            ? "ok_task_completed"
            : operation === "start_break"
              ? "ok_break_started"
              : "ok_break_ended",
      lang,
    ),
    operation,
    result,
  };
}

/** Complete a photo-required checklist task: upload the proof photo to the
 *  private bucket under the caller's folder, then complete via RPC — Postgres
 *  re-validates the photo and refuses completion without it. */
export async function completeChecklistTask(
  _previous: StaffActionState | undefined,
  form: FormData,
): Promise<StaffActionState> {
  const context = await requireStaff();
  const lang = dashboardLang(context.profile);
  const operation = "complete_task";

  const taskId = text(form.get("task_id"));
  if (!taskId) {
    return { error: t("task_not_found", lang), operation };
  }

  const files = imageFiles(form, "photo");
  const imageError = validateImages(files, true, lang);
  if (imageError) return { error: imageError, operation };
  if (files.length !== 1) {
    return { error: t("attach_one_photo", lang), operation };
  }

  const day = await branchDay(context);
  if ("error" in day) return { error: day.error, operation };

  const uploaded = await uploadEvidence(
    context,
    "checklist",
    `${day.reportDate}/${taskId}`,
    files,
  );
  if ("error" in uploaded) return { error: uploaded.error, operation };

  const { data, error } = await context.supabase.rpc("complete_task", {
    p_task_id: taskId,
    p_photo_path: uploaded.paths[0],
  });
  const result = (data ?? {}) as Record<string, unknown>;
  if (error || result.ok !== true) {
    await removeEvidence(context, uploaded.paths);
    return {
      error: error ? staffSqlErrorMessage(error.code, lang) : staffErrorMessage(result, lang),
      operation,
      result,
    };
  }

  revalidatePath("/staff");
  return { message: t("ok_task_photo", lang), operation, result };
}

/** Short Google Maps share links carry no coordinates until they are followed. */
export async function resolveOwnBranchLocation(
  link: string,
): Promise<{ latitude: number; longitude: number } | { error: string }> {
  const context = await getStaffContext();
  if (!context?.user || !context.profile) redirect("/staff/login");
  if (!["owner", "manager"].includes(context.profile.role)) {
    return { error: "ليس لديك صلاحية تعديل الفرع." };
  }
  const found = await resolveShareLink(link);
  if (!found) return { error: "تعذّر قراءة الموقع من الرابط — افتح الرابط في الخرائط وانسخ الرابط الكامل." };
  return found;
}

export async function updateOwnBranch(
  _previous: StaffActionState | undefined,
  form: FormData,
): Promise<StaffActionState> {
  const context = await getStaffContext();
  if (!context?.user || !context.profile) redirect("/staff/login");
  if (!["owner", "manager"].includes(context.profile.role)) {
    return { error: "ليس لديك صلاحية تعديل الفرع." };
  }

  const name = text(form.get("name"));
  const latitude = number(form.get("latitude"));
  const longitude = number(form.get("longitude"));
  const radius = number(form.get("radius_meters"));
  if (!name || latitude == null || longitude == null || radius == null) {
    return { error: "أكمل جميع بيانات موقع الفرع." };
  }

  const { data, error } = await context.supabase.rpc("update_own_branch", {
    p_name: name,
    p_latitude: latitude,
    p_longitude: longitude,
    p_radius_meters: radius,
  });
  const result = (data ?? {}) as Record<string, unknown>;
  if (error || result.ok !== true) {
    // Owner/manager branch settings are an Arabic-only administrative surface.
    return {
      error: error ? staffSqlErrorMessage(error.code, "ar") : "تعذّر حفظ الفرع. حاول مرة أخرى.",
    };
  }
  revalidatePath("/staff");
  return { message: "تم تحديث موقع الفرع.", result };
}
