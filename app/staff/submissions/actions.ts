"use server";

import { revalidatePath } from "next/cache";
import { dashboardLang, type StaffRole } from "../../lib/staff-shared";
import { requireStaff } from "../../lib/staff";
import { staffSqlErrorMessage, t, type Lang } from "../../lib/staff-i18n";
import {
  BARISTA_CHECKS,
  CLEANING_CHECKS,
  KITCHEN_CHECKS,
  buildNotes,
  type CheckItem,
} from "../../lib/staff-checks";
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

const MAX_NOTE = 1000;

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

type Tapped =
  | { ok: true; keys: string[]; notes: string }
  | { ok: false; error: string };

/**
 * Read the tapped answers and turn them into the Arabic notes string the
 * supervisor queue reads. Employees no longer type a required paragraph; the
 * only free text is an optional note appended at the end.
 */
function tappedNotes(form: FormData, items: CheckItem[], lang: Lang): Tapped {
  const keys = form
    .getAll("checks")
    .map((value) => String(value))
    .filter((value) => items.some((item) => item.key === value));
  if (!keys.length) return { ok: false, error: t("report_pick_one", lang) };
  const note = text(form.get("note"));
  if (note.length > MAX_NOTE) return { ok: false, error: t("note_too_long", lang) };
  return { ok: true, keys, notes: buildNotes(items, keys, note) };
}

async function maySubmitReport(context: StaffContext, table: ReportTable, reportDate: string, lang: Lang) {
  const { data, error } = await context.supabase
    .from(table)
    .select("status")
    .eq("submitted_by", context.user.id)
    .eq("report_date", reportDate)
    .order("revision", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { error: t("report_check_failed", lang) } as const;
  if (data?.status === "pending") return { error: t("report_pending", lang) } as const;
  if (data?.status === "confirmed") return { error: t("report_confirmed", lang) } as const;
  return { ok: true } as const;
}

function finish(operation: string, message: string): SubmissionActionState {
  revalidatePath("/staff");
  revalidatePath("/staff/submissions");
  return { operation, message };
}

async function submitCleaning(context: StaffContext, form: FormData): Promise<SubmissionActionState> {
  const lang = dashboardLang(context.profile);
  const operation = "cleaning";
  if (context.profile.role !== "cleaning_staff") {
    return { operation, error: t("report_wrong_role", lang) };
  }
  const tapped = tappedNotes(form, CLEANING_CHECKS, lang);
  if (!tapped.ok) return { operation, error: tapped.error };

  const files = imageFiles(form, "photos");
  const imageError = validateImages(files, true, lang);
  if (imageError) return { operation, error: imageError };

  const day = await branchDay(context);
  if ("error" in day) return { operation, error: day.error };
  const allowed = await maySubmitReport(context, "cleaning_reports", day.reportDate, lang);
  if ("error" in allowed) return { operation, error: allowed.error };
  const uploaded = await uploadEvidence(context, "cleaning", day.reportDate, files);
  if ("error" in uploaded) return { operation, error: uploaded.error };

  const { data, error } = await context.supabase.rpc("submit_cleaning_report", {
    p_cleanliness_notes: tapped.notes,
    p_report_data: { checks: tapped.keys },
    p_photo_paths: uploaded.paths,
  });
  const result = (data ?? {}) as Record<string, unknown>;
  if (error || result.ok !== true) {
    await removeEvidence(context, uploaded.paths);
    return {
      operation,
      error: error ? staffSqlErrorMessage(error.code, lang) : t("report_save_failed", lang),
    };
  }
  return finish(operation, t("report_sent", lang));
}

async function submitBarista(context: StaffContext, form: FormData): Promise<SubmissionActionState> {
  const lang = dashboardLang(context.profile);
  const operation = "barista";
  if (context.profile.role !== "barista") {
    return { operation, error: t("report_wrong_role", lang) };
  }
  const tapped = tappedNotes(form, BARISTA_CHECKS, lang);
  if (!tapped.ok) return { operation, error: tapped.error };
  if (text(form.get("bar_clean_confirmed")) !== "on") {
    return { operation, error: t("bar_clean_required", lang) };
  }

  const files = imageFiles(form, "photos");
  const imageError = validateImages(files, false, lang);
  if (imageError) return { operation, error: imageError };

  const day = await branchDay(context);
  if ("error" in day) return { operation, error: day.error };
  const allowed = await maySubmitReport(context, "barista_reports", day.reportDate, lang);
  if ("error" in allowed) return { operation, error: allowed.error };
  const uploaded = await uploadEvidence(context, "barista", day.reportDate, files);
  if ("error" in uploaded) return { operation, error: uploaded.error };

  const { data, error } = await context.supabase.rpc("submit_barista_report", {
    p_handover_notes: tapped.notes,
    p_report_data: { checks: tapped.keys },
    p_bar_clean_confirmed: true,
    p_photo_paths: uploaded.paths,
  });
  const result = (data ?? {}) as Record<string, unknown>;
  if (error || result.ok !== true) {
    await removeEvidence(context, uploaded.paths);
    return {
      operation,
      error: error ? staffSqlErrorMessage(error.code, lang) : t("report_save_failed", lang),
    };
  }
  return finish(operation, t("report_sent", lang));
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

async function submitKitchen(context: StaffContext, form: FormData): Promise<SubmissionActionState> {
  const lang = dashboardLang(context.profile);
  const operation = "kitchen";
  if (context.profile.role !== "kitchen_manager") {
    return { operation, error: t("report_wrong_role", lang) };
  }
  const tapped = tappedNotes(form, KITCHEN_CHECKS, lang);
  if (!tapped.ok) return { operation, error: tapped.error };
  const inventory = parseInventory(text(form.get("inventory_json")));
  if (!inventory) return { operation, error: t("inventory_invalid", lang) };

  const files = imageFiles(form, "photos");
  const imageError = validateImages(files, true, lang);
  if (imageError) return { operation, error: imageError };

  const day = await branchDay(context);
  if ("error" in day) return { operation, error: day.error };
  const allowed = await maySubmitReport(context, "kitchen_reports", day.reportDate, lang);
  if ("error" in allowed) return { operation, error: allowed.error };
  const uploaded = await uploadEvidence(context, "kitchen", day.reportDate, files);
  if ("error" in uploaded) return { operation, error: uploaded.error };

  const { data, error } = await context.supabase.rpc("submit_kitchen_report", {
    p_cleanliness_notes: tapped.notes,
    p_inventory_counts: inventory,
    p_photo_paths: uploaded.paths,
  });
  const result = (data ?? {}) as Record<string, unknown>;
  if (error || result.ok !== true) {
    await removeEvidence(context, uploaded.paths);
    return {
      operation,
      error: error ? staffSqlErrorMessage(error.code, lang) : t("report_save_failed", lang),
    };
  }
  return finish(operation, t("report_sent", lang));
}

async function submitWater(context: StaffContext, form: FormData): Promise<SubmissionActionState> {
  const lang = dashboardLang(context.profile);
  const operation = "water";
  if (!WATER_ROLES.has(context.profile.role)) {
    return { operation, error: t("report_not_allowed", lang) };
  }
  const saltRatio = number(form.get("salt_ratio"));
  if (saltRatio == null || saltRatio < 0 || saltRatio > 1_000_000) {
    return { operation, error: t("water_invalid", lang) };
  }
  const files = imageFiles(form, "photo");
  const imageError = validateImages(files, true, lang);
  if (imageError) return { operation, error: imageError };
  if (files.length !== 1) return { operation, error: t("water_photo_one", lang) };

  const day = await branchDay(context);
  if ("error" in day) return { operation, error: day.error };

  // Accept both field names: the inline card posts `note`, the older
  // Arabic admin form on /staff/submissions posts `notes`.
  const notes = text(form.get("note")) || text(form.get("notes"));
  if (notes.length > MAX_NOTE) return { operation, error: t("note_too_long", lang) };

  const uploaded = await uploadEvidence(context, "water-quality", day.reportDate, files);
  if ("error" in uploaded) return { operation, error: uploaded.error };

  const { data, error } = await context.supabase.rpc("record_water_quality_check", {
    p_salt_ratio: saltRatio,
    p_photo_path: uploaded.paths[0],
    p_notes: notes || null,
  });
  const result = (data ?? {}) as Record<string, unknown>;
  if (error || result.ok !== true) {
    await removeEvidence(context, uploaded.paths);
    return {
      operation,
      error: error ? staffSqlErrorMessage(error.code, lang) : t("report_save_failed", lang),
    };
  }
  return finish(operation, t("water_saved", lang));
}

async function submitBeverage(context: StaffContext, form: FormData): Promise<SubmissionActionState> {
  const lang = dashboardLang(context.profile);
  const operation = "beverage";
  if (!BEVERAGE_ROLES.has(context.profile.role)) {
    return { operation, error: t("report_not_allowed", lang) };
  }
  const consumed = form.get("consumed") === "true";
  const { data, error } = await context.supabase.rpc("log_daily_beverage", {
    p_employee_id: context.user.id,
    p_consumed: consumed,
  });
  const result = (data ?? {}) as Record<string, unknown>;
  if (error || result.ok !== true) {
    return {
      operation,
      error: error ? staffSqlErrorMessage(error.code, lang) : t("report_save_failed", lang),
    };
  }
  return finish(operation, t("beverage_saved", lang));
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
  return { operation, error: t("generic_error", dashboardLang(context.profile)) };
}
