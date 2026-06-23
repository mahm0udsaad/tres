import "server-only";
import { supabaseAdmin } from "./supabase";
import { normalizeTheme, type DbCategory, type DbItem, type ThemeId } from "./data";

export type AdminCategory = DbCategory;
export type AdminItem = DbItem;

export type Feedback = {
  id: string;
  name: string | null;
  contact: string | null;
  type: string;
  message: string;
  status: "new" | "read" | "resolved";
  created_at: string;
};

export type Settings = {
  id: number;
  hours: { day: string; open?: string; close?: string; closed?: boolean }[];
  announcement: string | null;
  announcement_active: boolean;
  phone: string | null;
  address: string | null;
  instagram: string | null;
  tiktok: string | null;
  snapchat: string | null;
  theme: ThemeId;
};

// ── reads ────────────────────────────────────────────────────────────────────
export async function adminMenu(): Promise<{ category: AdminCategory; items: AdminItem[] }[]> {
  const sb = supabaseAdmin();
  const [{ data: cats }, { data: items }] = await Promise.all([
    sb.from("categories").select("*").order("sort_order"),
    sb.from("items").select("*").order("sort_order"),
  ]);
  const grouped = (cats ?? []).map((c) => ({
    category: c as AdminCategory,
    items: ((items ?? []) as AdminItem[]).filter((i) => i.category_id === c.id),
  }));
  return grouped;
}

export async function overview() {
  const sb = supabaseAdmin();
  const [cats, items, avail, newFb, settings] = await Promise.all([
    sb.from("categories").select("id", { count: "exact", head: true }),
    sb.from("items").select("id", { count: "exact", head: true }),
    sb.from("items").select("id", { count: "exact", head: true }).eq("is_available", false),
    sb.from("feedback").select("id", { count: "exact", head: true }).eq("status", "new"),
    getSettings(),
  ]);
  return {
    categories: cats.count ?? 0,
    items: items.count ?? 0,
    soldOut: avail.count ?? 0,
    newFeedback: newFb.count ?? 0,
    announcementActive: settings.announcement_active,
  };
}

export async function listFeedback(status?: string): Promise<Feedback[]> {
  const sb = supabaseAdmin();
  let q = sb.from("feedback").select("*").order("created_at", { ascending: false });
  if (status && status !== "all") q = q.eq("status", status);
  const { data } = await q;
  return (data ?? []) as Feedback[];
}

export async function getSettings(): Promise<Settings> {
  const sb = supabaseAdmin();
  const { data } = await sb.from("settings").select("*").eq("id", 1).single();
  const base = (data ?? {
    id: 1, hours: [], announcement: null, announcement_active: false,
    phone: null, address: null, instagram: null, tiktok: null, snapchat: null,
  }) as Omit<Settings, "theme"> & { theme?: unknown };
  return { ...base, theme: normalizeTheme(base.theme) } as Settings;
}

// ── image upload ───────────────────────────────────────────────────────────
export async function uploadImage(file: File, folder = "items"): Promise<string> {
  const sb = supabaseAdmin();
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const buf = new Uint8Array(await file.arrayBuffer());
  const { error } = await sb.storage.from("menu").upload(path, buf, {
    contentType: file.type || "image/jpeg",
    upsert: false,
  });
  if (error) throw error;
  return sb.storage.from("menu").getPublicUrl(path).data.publicUrl;
}
