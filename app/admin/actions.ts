"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "../lib/supabase";
import { uploadImage } from "../lib/admin-data";
import { ADMIN_COOKIE, SESSION_MAX_AGE, checkPin, signSession, verifySession } from "../lib/auth";
import { resolveShareLink } from "../lib/geo-link";
import {
  NATIONALITY_VALUES,
  STAFF_ROLES,
  languageForNationality,
  type StaffRole,
} from "../lib/staff-shared";

function refreshPublic() {
  // Public menu + homepage reflect owner edits.
  revalidatePath("/");
  revalidatePath("/menu");
  revalidatePath("/menu/[category]", "page");
  revalidatePath("/admin", "layout");
}

function str(v: FormDataEntryValue | null): string | null {
  const s = (v == null ? "" : String(v)).trim();
  return s.length ? s : null;
}
function num(v: FormDataEntryValue | null): number | null {
  const s = str(v);
  if (s == null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
function bool(v: FormDataEntryValue | null): boolean {
  return v === "on" || v === "true" || v === "1";
}
function imageField(form: FormData, key: string): string | null {
  return bool(form.get(`${key}_clear`)) ? "" : str(form.get(key));
}

async function requireAdmin() {
  const jar = await cookies();
  const ok = await verifySession(jar.get(ADMIN_COOKIE)?.value);
  if (!ok) redirect("/admin/login");
}

export type OperationsActionState = {
  error?: string;
  message?: string;
  operation?: string;
};

// ── auth ─────────────────────────────────────────────────────────────────────
export async function login(_prev: { error?: string } | undefined, form: FormData) {
  const pin = String(form.get("pin") ?? "");
  if (!checkPin(pin)) return { error: "الرمز غير صحيح" };
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, await signSession(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  const next = String(form.get("next") ?? "/admin");
  redirect(next.startsWith("/admin") ? next : "/admin");
}

export async function logout() {
  await requireAdmin();
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
  redirect("/admin/login");
}

// ── categories ────────────────────────────────────────────────────────────────
export async function saveCategory(form: FormData) {
  await requireAdmin();
  const sb = supabaseAdmin();
  const id = str(form.get("id"));
  const file = form.get("image") as File | null;
  let image_url = imageField(form, "image_url");
  if (file && file.size > 0) image_url = await uploadImage(file, "categories");

  const row = {
    slug: str(form.get("slug")) ?? crypto.randomUUID().slice(0, 8),
    number: str(form.get("number")),
    name_ar: str(form.get("name_ar")) ?? "",
    name_en: str(form.get("name_en")),
    tagline: str(form.get("tagline")),
    glyph: str(form.get("glyph")),
    note: str(form.get("note")),
    template: (str(form.get("template")) as "simple" | "coffee" | "dessert" | null) ?? "simple",
    sort_order: num(form.get("sort_order")) ?? 0,
    is_active: bool(form.get("is_active")),
    image_url,
  };
  if (id) await sb.from("categories").update(row).eq("id", id);
  else await sb.from("categories").insert(row);
  refreshPublic();
}

export async function deleteCategory(form: FormData) {
  await requireAdmin();
  const id = str(form.get("id"));
  if (id) await supabaseAdmin().from("categories").delete().eq("id", id);
  refreshPublic();
}

// ── items ──────────────────────────────────────────────────────────────────────
export async function saveItem(form: FormData) {
  await requireAdmin();
  const sb = supabaseAdmin();
  const id = str(form.get("id"));
  const file = form.get("image") as File | null;
  let image_url = imageField(form, "image_url");
  if (file && file.size > 0) image_url = await uploadImage(file, "items");

  const emblemFile = form.get("emblem") as File | null;
  let emblem_url = imageField(form, "emblem_url");
  if (emblemFile && emblemFile.size > 0) emblem_url = await uploadImage(emblemFile, "emblems");

  const notesRaw = str(form.get("notes"));
  const notes = notesRaw ? notesRaw.split(/[,\n،]/).map((s) => s.trim()).filter(Boolean) : [];

  const row = {
    category_id: str(form.get("category_id")),
    slug: str(form.get("slug")),
    name_ar: str(form.get("name_ar")) ?? "",
    name_en: str(form.get("name_en")),
    price: num(form.get("price")),
    badge: str(form.get("badge")),
    cal: str(form.get("cal")),
    description: str(form.get("description")),
    image_url,
    emblem_url,
    emblem_fit: str(form.get("emblem_fit")) as "cover" | "contain" | null,
    notes,
    variety: str(form.get("variety")),
    altitude: str(form.get("altitude")),
    process: str(form.get("process")),
    is_available: bool(form.get("is_available")),
    sort_order: num(form.get("sort_order")) ?? 0,
  };
  if (id) await sb.from("items").update(row).eq("id", id);
  else await sb.from("items").insert(row);
  refreshPublic();
}

export async function deleteItem(form: FormData) {
  await requireAdmin();
  const id = str(form.get("id"));
  if (id) await supabaseAdmin().from("items").delete().eq("id", id);
  refreshPublic();
}

/** One-tap toggles used directly from the item list. */
export async function toggleAvailable(form: FormData) {
  await requireAdmin();
  const id = str(form.get("id"));
  const next = bool(form.get("value"));
  if (id) await supabaseAdmin().from("items").update({ is_available: next }).eq("id", id);
  refreshPublic();
}

export async function toggleFeatured(form: FormData) {
  await requireAdmin();
  const id = str(form.get("id"));
  const next = bool(form.get("value"));
  if (id) await supabaseAdmin().from("items").update({ is_featured: next }).eq("id", id);
  refreshPublic();
}

// ── feedback ──────────────────────────────────────────────────────────────────
export async function setFeedbackStatus(form: FormData) {
  await requireAdmin();
  const id = str(form.get("id"));
  const status = str(form.get("status"));
  if (id && status) await supabaseAdmin().from("feedback").update({ status }).eq("id", id);
  revalidatePath("/admin/feedback");
  revalidatePath("/admin", "layout");
}

// ── homepage sections ─────────────────────────────────────────────────────────
export async function saveHome(form: FormData) {
  await requireAdmin();
  const sb = supabaseAdmin();
  const section = (k: string) => ({
    kicker: str(form.get(`${k}_kicker`)) ?? "",
    title: str(form.get(`${k}_title`)) ?? "",
    desc: str(form.get(`${k}_desc`)) ?? "",
    items: (str(form.get(`${k}_items`)) ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  });
  const home = { today: section("today"), best: section("best") };
  await sb.from("settings").update({ home }).eq("id", 1);
  refreshPublic();
}

// ── settings ──────────────────────────────────────────────────────────────────
export async function saveSettings(form: FormData) {
  await requireAdmin();
  const sb = supabaseAdmin();
  // hours arrive as parallel arrays day[]/open[]/close[]/closed[]
  const days = form.getAll("hour_day").map(String);
  const opens = form.getAll("hour_open").map(String);
  const closes = form.getAll("hour_close").map(String);
  const closedSet = new Set(form.getAll("hour_closed").map(String));
  const hours = days.map((day, i) => ({
    day,
    open: opens[i] || "",
    close: closes[i] || "",
    closed: closedSet.has(String(i)),
  }));

  const theme = str(form.get("theme")) === "summer" ? "summer" : "classic";
  const base = {
    announcement: str(form.get("announcement")),
    announcement_active: bool(form.get("announcement_active")),
    phone: str(form.get("phone")),
    address: str(form.get("address")),
    instagram: str(form.get("instagram")),
    tiktok: str(form.get("tiktok")),
    snapchat: str(form.get("snapchat")),
    hours,
  };
  // `theme` may not exist yet if the 0006 migration hasn't been applied — fall
  // back to saving the rest so the panel never hard-fails on an older schema.
  const { error } = await sb.from("settings").update({ ...base, theme }).eq("id", 1);
  if (error) await sb.from("settings").update(base).eq("id", 1);
  refreshPublic();
}

// ── staff operations bootstrap ───────────────────────────────────────────────

/**
 * Resolves a short Google Maps share link (maps.app.goo.gl/…) into coordinates.
 * Full links are parsed in the browser; only the short form needs a server hop,
 * and `resolveShareLink` restricts that hop to known map hosts.
 */
export async function resolveBranchLocation(
  link: string,
): Promise<{ latitude: number; longitude: number } | { error: string }> {
  await requireAdmin();
  const found = await resolveShareLink(link);
  if (!found) return { error: "تعذّر قراءة الموقع من الرابط — افتح الرابط في الخرائط وانسخ الرابط الكامل." };
  return found;
}

export async function saveOperations(
  _previous: OperationsActionState | undefined,
  form: FormData,
): Promise<OperationsActionState> {
  await requireAdmin();
  const operation = str(form.get("operation"));
  const sb = supabaseAdmin();

  if (operation === "save_branch") {
    const id = str(form.get("id"));
    const name = str(form.get("name"));
    const latitude = num(form.get("latitude"));
    const longitude = num(form.get("longitude"));
    const radius_meters = num(form.get("radius_meters"));
    if (!name || latitude == null || longitude == null || radius_meters == null) {
      return { error: "أكمل جميع بيانات الفرع.", operation };
    }
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return { error: "إحداثيات الفرع غير صحيحة.", operation };
    }
    if (radius_meters < 10 || radius_meters > 5000) {
      return { error: "نصف القطر يجب أن يكون بين 10 و5000 متر.", operation };
    }

    const row = { name, latitude, longitude, radius_meters };
    const result = id
      ? await sb.from("branches").update(row).eq("id", id)
      : await sb.from("branches").insert(row);
    if (result.error) return { error: result.error.message, operation };
    revalidatePath("/admin/operations");
    return { message: id ? "تم تحديث الفرع." : "تم إنشاء الفرع.", operation };
  }

  if (operation === "create_staff") {
    const full_name = str(form.get("full_name"));
    const email = str(form.get("email"))?.toLowerCase();
    const password = str(form.get("password"));
    const roleValue = str(form.get("role"));
    const branch_id = str(form.get("branch_id"));
    const scheduled_start = str(form.get("scheduled_start"));
    const nationality = str(form.get("nationality")) ?? "Other";
    if (!full_name || !email || !password || !roleValue) {
      return { error: "أكمل بيانات الموظف.", operation };
    }
    if (password.length < 8) {
      return { error: "كلمة المرور يجب ألا تقل عن 8 أحرف.", operation };
    }
    if (!STAFF_ROLES.includes(roleValue as StaffRole)) {
      return { error: "الدور الوظيفي غير صحيح.", operation };
    }
    if (!NATIONALITY_VALUES.includes(nationality)) {
      return { error: "الجنسية غير صحيحة.", operation };
    }
    const preferred_language = languageForNationality(nationality);

    const { data: created, error: authError } = await sb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });
    if (authError || !created.user) {
      return { error: authError?.message ?? "تعذّر إنشاء حساب الدخول.", operation };
    }

    const { error: profileError } = await sb.from("staff_profiles").insert({
      user_id: created.user.id,
      full_name,
      role: roleValue,
      branch_id,
      scheduled_start,
      nationality,
      preferred_language,
    });
    if (profileError) {
      await sb.auth.admin.deleteUser(created.user.id);
      return { error: profileError.message, operation };
    }

    revalidatePath("/admin/operations");
    return { message: `تم إنشاء حساب ${full_name}.`, operation };
  }

  if (operation === "assign_task") {
    const user_id = str(form.get("user_id"));
    const task_date = str(form.get("task_date"));
    const title = str(form.get("title"));
    if (!user_id || !task_date || !title) {
      return { error: "اختر الموظف والتاريخ واكتب المهمة.", operation };
    }
    const { error } = await sb.from("tasks").insert({
      user_id,
      task_date,
      title,
      task_type: "general_duty",
      is_required: true,
    });
    if (error) return { error: error.message, operation };
    revalidatePath("/admin/operations");
    return { message: "تم إسناد المهمة.", operation };
  }

  return { error: "الإجراء غير مدعوم.", operation: operation ?? undefined };
}
