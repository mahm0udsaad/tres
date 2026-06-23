"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "../lib/supabase";
import { uploadImage } from "../lib/admin-data";
import { ADMIN_COOKIE, SESSION_MAX_AGE, checkPin, signSession } from "../lib/auth";

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
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
  redirect("/admin/login");
}

// ── categories ────────────────────────────────────────────────────────────────
export async function saveCategory(form: FormData) {
  const sb = supabaseAdmin();
  const id = str(form.get("id"));
  const file = form.get("image") as File | null;
  let image_url = str(form.get("image_url"));
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
    ...(image_url ? { image_url } : {}),
  };
  if (id) await sb.from("categories").update(row).eq("id", id);
  else await sb.from("categories").insert(row);
  refreshPublic();
}

export async function deleteCategory(form: FormData) {
  const id = str(form.get("id"));
  if (id) await supabaseAdmin().from("categories").delete().eq("id", id);
  refreshPublic();
}

// ── items ──────────────────────────────────────────────────────────────────────
export async function saveItem(form: FormData) {
  const sb = supabaseAdmin();
  const id = str(form.get("id"));
  const file = form.get("image") as File | null;
  let image_url = str(form.get("image_url"));
  if (file && file.size > 0) image_url = await uploadImage(file, "items");

  const emblemFile = form.get("emblem") as File | null;
  let emblem_url = str(form.get("emblem_url"));
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
    emblem_url,
    emblem_fit: str(form.get("emblem_fit")) as "cover" | "contain" | null,
    notes,
    variety: str(form.get("variety")),
    altitude: str(form.get("altitude")),
    process: str(form.get("process")),
    is_available: bool(form.get("is_available")),
    sort_order: num(form.get("sort_order")) ?? 0,
    ...(image_url ? { image_url } : {}),
  };
  if (id) await sb.from("items").update(row).eq("id", id);
  else await sb.from("items").insert(row);
  refreshPublic();
}

export async function deleteItem(form: FormData) {
  const id = str(form.get("id"));
  if (id) await supabaseAdmin().from("items").delete().eq("id", id);
  refreshPublic();
}

/** One-tap toggles used directly from the item list. */
export async function toggleAvailable(form: FormData) {
  const id = str(form.get("id"));
  const next = bool(form.get("value"));
  if (id) await supabaseAdmin().from("items").update({ is_available: next }).eq("id", id);
  refreshPublic();
}

export async function toggleFeatured(form: FormData) {
  const id = str(form.get("id"));
  const next = bool(form.get("value"));
  if (id) await supabaseAdmin().from("items").update({ is_featured: next }).eq("id", id);
  refreshPublic();
}

// ── feedback ──────────────────────────────────────────────────────────────────
export async function setFeedbackStatus(form: FormData) {
  const id = str(form.get("id"));
  const status = str(form.get("status"));
  if (id && status) await supabaseAdmin().from("feedback").update({ status }).eq("id", id);
  revalidatePath("/admin/feedback");
  revalidatePath("/admin", "layout");
}

// ── homepage sections ─────────────────────────────────────────────────────────
export async function saveHome(form: FormData) {
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
