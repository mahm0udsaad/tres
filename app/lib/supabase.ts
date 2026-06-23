import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** True when Supabase env is configured. When false, the site falls back to the
 *  static menu so it keeps working before the database is wired up. */
export const supabaseConfigured = Boolean(URL && ANON);

/** Public client — anon/publishable key. Subject to RLS: can read the menu and
 *  insert feedback only. Safe to use in server components for reads. */
export function supabasePublic() {
  if (!URL || !ANON) throw new Error("Supabase public env not configured");
  return createClient(URL, ANON, { auth: { persistSession: false } });
}

/** Admin client — service-role key. Server-only, bypasses RLS. Never import
 *  this into client components. */
export function supabaseAdmin() {
  if (!URL || !SERVICE) throw new Error("Supabase service env not configured");
  return createClient(URL, SERVICE, { auth: { persistSession: false } });
}
