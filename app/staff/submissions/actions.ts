"use server";

import { revalidatePath } from "next/cache";
import type { StaffRole } from "../../lib/staff-shared";
import { requireStaff } from "../../lib/staff";
import { staffSqlErrorMessage, t } from "../../lib/staff-i18n";
import {
  branchDay,
  imageFiles,
  removeEvidence,
  uploadEvidence,
  validateImages,
  type StaffContext,
} from "../evidence";

const WATER_ROLES = new Set<StaffRole>([
  "owner",
  "manager",
  "supervisor",
  "kitchen_manager",
]);
const BEVERAGE_ROLES = new Set<StaffRole>([
  "owner",
  "manager",
  "supervisor",
  "employee",
  "cleaning_staff",
  "barista",
  "kitchen_manager",
]);

export type SubmissionActionState = {
  error?: string;
  message?: string;
  operation?: string;
};

type ReportTable = "cleaning_reports" | "barista_reports" | "kitchen_reports";
type InventoryItem = {
  name: string;
  category: "product" | "dessert";
  count: number;
};

function text(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function number(value: FormDataEntryValue | null) {
  const raw = text(value);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

async function maySubmitReport(
  context: StaffContext,
  table: ReportTable,
  reportDate: string,
) {
  const { data, error } = await context.supabase
    .from(table)
    .select("status")
    .eq("submitted_by", context.user.id)
    .eq("report_date", reportDate)
    .order("revision", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { error: t("report_check_failed", context.profile.preferred_language) } as const;
  if (data?.status === "pending") {
    return { error: t("report_pending", context.profile.preferred_language) } as const;
  }
  if (data?.status === "confirmed") {
    return { error: t("report_confirmed", context.profile.preferred_language) } as const;
  }
  return { ok: true } as const;
}

function finish(operation: string, message: string): SubmissionActionState {
  revalidatePath("/staff");
  revalidatePath("/staff/submissions");
  return { operation, message };
}

async function submitCleaning(
  context: StaffContext,
  form: FormData,
): Promise<SubmissionActionState> {
  if (context.profile.role !== "cleaning_staff") {
    return { operation: "cleaning", error: "هذا النموذج مخصص لفريق النظافة." };
  }
  const notes = text(form.get("notes"));
  if (notes.length < 10 || notes.length > 3000) {
    return { operation: "cleaning", error: "اكتب ملاحظات واضحة من 10 إلى 3000 حرف." };
  }
  const files = imageFiles(form, "photos");
  const imageError = validateImages(files, true, context.profile.preferred_language);
  if (imageError) return { operation: "cleaning", error: imageError };

  const day = await branchDay(context);
  if ("error" in day) return { operation: "cleaning", error: day.error };
  const allowed = await maySubmitReport(context, "cleaning_reports", day.reportDate);
  if ("error" in allowed) return { operation: "cleaning", error: allowed.error };
  const uploaded = await uploadEvidence(context, "cleaning", day.reportDate, files);
  if ("error" in uploaded) return { operation: "cleaning", error: uploaded.error };

  const { data, error } = await context.supabase.rpc("submit_cleaning_report", {
    p_cleanliness_notes: notes,
    p_report_data: {},
    p_photo_paths: uploaded.paths,
  });
  const result = (data ?? {}) as Record<string, unknown>;
  if (error || result.ok !== true) {
    await removeEvidence(context, uploaded.paths);
    return {
      operation: "cleaning",
      error: error ? staffSqlErrorMessage(error.code, context.profile.preferred_language) : "تعذّر حفظ تقرير النظافة.",
    };
  }
  return finish("cleaning", "تم إرسال تقرير النظافة للمراجعة.");
}

async function submitBarista(
  context: StaffContext,
  form: FormData,
): Promise<SubmissionActionState> {
  if (context.profile.role !== "barista") {
    return { operation: "barista", error: "هذا النموذج مخصص لفريق البار." };
  }
  const notes = text(form.get("notes"));
  if (notes.length < 10 || notes.length > 3000) {
    return { operation: "barista", error: "اكتب ملاحظات واضحة من 10 إلى 3000 حرف." };
  }
  if (form.get("bar_clean_confirmed") !== "on") {
    return { operation: "barista", error: "يجب تأكيد نظافة البار قبل التسليم." };
  }
  const files = imageFiles(form, "photos");
  const imageError = validateImages(files, false, context.profile.preferred_language);
  if (imageError) return { operation: "barista", error: imageError };

  const day = await branchDay(context);
  if ("error" in day) return { operation: "barista", error: day.error };
  const allowed = await maySubmitReport(context, "barista_reports", day.reportDate);
  if ("error" in allowed) return { operation: "barista", error: allowed.error };
  const uploaded = await uploadEvidence(context, "barista", day.reportDate, files);
  if ("error" in uploaded) return { operation: "barista", error: uploaded.error };

  const { data, error } = await context.supabase.rpc("submit_barista_report", {
    p_handover_notes: notes,
    p_report_data: {},
    p_bar_clean_confirmed: true,
    p_photo_paths: uploaded.paths,
  });
  const result = (data ?? {}) as Record<string, unknown>;
  if (error || result.ok !== true) {
    await removeEvidence(context, uploaded.paths);
    return {
      operation: "barista",
      error: error ? staffSqlErrorMessage(error.code, context.profile.preferred_language) : "تعذّر حفظ تقرير البار.",
    };
  }
  return finish("barista", "تم إرسال تقرير البار للمراجعة.");
}

function parseInventory(raw: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length < 2 || parsed.length > 100) return null;
  const items: InventoryItem[] = [];
  for (const value of parsed) {
    if (!value || typeof value !== "object") return null;
    const item = value as Record<string, unknown>;
    const name = typeof item.name === "string" ? item.name.trim() : "";
    const category = item.category;
    const count = Number(item.count);
    if (
      !name ||
      name.length > 120 ||
      (category !== "product" && category !== "dessert") ||
      !Number.isInteger(count) ||
      count < 0 ||
      count > 100_000
    ) {
      return null;
    }
    items.push({ name, category, count });
  }
  if (!items.some((item) => item.category === "product")) return null;
  if (!items.some((item) => item.category === "dessert")) return null;
  return items;
}

async function submitKitchen(
  context: StaffContext,
  form: FormData,
): Promise<SubmissionActionState> {
  if (context.profile.role !== "kitchen_manager") {
    return { operation: "kitchen", error: "هذا النموذج مخصص لمدير المطبخ." };
  }
  const cleanlinessNotes = text(form.get("cleanliness_notes"));
  if (cleanlinessNotes.length < 10 || cleanlinessNotes.length > 3000) {
    return { operation: "kitchen", error: "اكتب ملاحظات واضحة من 10 إلى 3000 حرف." };
  }
  const inventory = parseInventory(text(form.get("inventory_json")));
  if (!inventory) {
    return {
      operation: "kitchen",
      error: "أدخل جرداً صالحاً يشمل منتجاً وحلوى واحدة على الأقل.",
    };
  }
  const files = imageFiles(form, "photos");
  const imageError = validateImages(files, true, context.profile.preferred_language);
  if (imageError) return { operation: "kitchen", error: imageError };

  const day = await branchDay(context);
  if ("error" in day) return { operation: "kitchen", error: day.error };
  const allowed = await maySubmitReport(context, "kitchen_reports", day.reportDate);
  if ("error" in allowed) return { operation: "kitchen", error: allowed.error };
  const uploaded = await uploadEvidence(context, "kitchen", day.reportDate, files);
  if ("error" in uploaded) return { operation: "kitchen", error: uploaded.error };

  const { data, error } = await context.supabase.rpc("submit_kitchen_report", {
    p_cleanliness_notes: cleanlinessNotes,
    p_inventory_counts: inventory,
    p_photo_paths: uploaded.paths,
  });
  const result = (data ?? {}) as Record<string, unknown>;
  if (error || result.ok !== true) {
    await removeEvidence(context, uploaded.paths);
    return {
      operation: "kitchen",
      error: error ? staffSqlErrorMessage(error.code, context.profile.preferred_language) : "تعذّر حفظ تقرير المطبخ.",
    };
  }
  return finish("kitchen", "تم إرسال تقرير المطبخ والجرد للمراجعة.");
}

async function submitWater(
  context: StaffContext,
  form: FormData,
): Promise<SubmissionActionState> {
  if (!WATER_ROLES.has(context.profile.role)) {
    return { operation: "water", error: "ليس لديك صلاحية تسجيل فحص المياه." };
  }
  const saltRatio = number(form.get("salt_ratio"));
  if (saltRatio == null || saltRatio < 0 || saltRatio > 1_000_000) {
    return { operation: "water", error: "أدخل قراءة ملوحة صحيحة أكبر من أو تساوي صفر." };
  }
  const files = imageFiles(form, "photo");
  const imageError = validateImages(files, true, context.profile.preferred_language);
  if (imageError) return { operation: "water", error: imageError };
  if (files.length !== 1) {
    return { operation: "water", error: "أرفق صورة واحدة لقراءة فحص المياه." };
  }

  const day = await branchDay(context);
  if ("error" in day) return { operation: "water", error: day.error };
  const uploaded = await uploadEvidence(context, "water-quality", day.reportDate, files);
  if ("error" in uploaded) return { operation: "water", error: uploaded.error };

  const notes = text(form.get("notes"));
  if (notes.length > 1000) {
    await removeEvidence(context, uploaded.paths);
    return { operation: "water", error: "ملاحظات المياه يجب ألا تتجاوز 1000 حرف." };
  }
  const { data, error } = await context.supabase.rpc("record_water_quality_check", {
    p_salt_ratio: saltRatio,
    p_photo_path: uploaded.paths[0],
    p_notes: notes || null,
  });
  const result = (data ?? {}) as Record<string, unknown>;
  if (error || result.ok !== true) {
    await removeEvidence(context, uploaded.paths);
    return {
      operation: "water",
      error: error ? staffSqlErrorMessage(error.code, context.profile.preferred_language) : "تعذّر حفظ فحص المياه.",
    };
  }
  return finish("water", "تم تسجيل فحص جودة المياه.");
}

async function submitBeverage(
  context: StaffContext,
  form: FormData,
): Promise<SubmissionActionState> {
  if (!BEVERAGE_ROLES.has(context.profile.role)) {
    return { operation: "beverage", error: "ليس لديك صلاحية تسجيل استهلاك المشروبات." };
  }
  if (context.profile.role === "shift_manager") {
    return { operation: "beverage", error: "حساب مدير الوردية للعرض فقط." };
  }
  const consumed = form.get("consumed") === "true";
  const { data, error } = await context.supabase.rpc("log_daily_beverage", {
    p_employee_id: context.user.id,
    p_consumed: consumed,
  });
  const result = (data ?? {}) as Record<string, unknown>;
  if (error || result.ok !== true) {
    return {
      operation: "beverage",
      error: error ? staffSqlErrorMessage(error.code, context.profile.preferred_language) : "تعذّر حفظ استهلاك المشروبات.",
    };
  }
  return finish("beverage", "تم تحديث استهلاك مشروبات اليوم.");
}

export async function submitStaffModule(
  _previous: SubmissionActionState | undefined,
  form: FormData,
): Promise<SubmissionActionState> {
  const context = await requireStaff();
  const operation = text(form.get("operation"));
  if (operation === "cleaning") return submitCleaning(context, form);
  if (operation === "barista") return submitBarista(context, form);
  if (operation === "kitchen") return submitKitchen(context, form);
  if (operation === "water") return submitWater(context, form);
  if (operation === "beverage") return submitBeverage(context, form);
  return { operation, error: "النموذج غير مدعوم." };
}
