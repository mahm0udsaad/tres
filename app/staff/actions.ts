"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getStaffContext, requireStaff } from "../lib/staff";
import { supabaseServer } from "../lib/supabase-server";

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
  const email = text(form.get("email")).toLowerCase();
  const password = text(form.get("password"));
  if (!email || !password) return { error: "أدخل البريد الإلكتروني وكلمة المرور." };

  let supabase;
  try {
    supabase = await supabaseServer();
  } catch {
    return { error: "لم يتم إعداد اتصال Supabase بعد." };
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
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
  const { supabase } = await requireStaff();
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
      return { error: "تعذّر قراءة الموقع. فعّل إذن الموقع وحاول مرة أخرى.", operation };
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
    if (!taskId) return { error: "المهمة غير موجودة.", operation };
    rpc = "complete_task";
    args = { p_task_id: taskId };
  } else {
    return { error: "الإجراء غير مدعوم.", operation };
  }

  const { data, error } = await supabase.rpc(rpc, args);
  if (error) {
    return { error: error.message || "تعذّر تنفيذ الإجراء.", operation };
  }

  const result = (data ?? {}) as Record<string, unknown>;
  if (result.ok !== true) {
    return {
      error: String(result.message ?? "تعذّر تنفيذ الإجراء."),
      operation,
      result,
    };
  }

  revalidatePath("/staff");
  return {
    message:
      operation === "start_shift"
        ? "بدأت الوردية بنجاح."
        : operation === "end_shift"
          ? "أحسنت! اكتملت الوردية."
          : operation === "complete_task"
            ? "تم إكمال المهمة."
            : operation === "start_break"
              ? "بدأت الاستراحة."
              : "انتهت الاستراحة.",
    operation,
    result,
  };
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
    return { error: error?.message ?? String(result.message ?? "تعذّر حفظ الفرع.") };
  }
  revalidatePath("/staff");
  return { message: "تم تحديث موقع الفرع.", result };
}
