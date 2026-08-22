import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { supabaseServer } from "./supabase-server";
import type { StaffProfile, StaffRole } from "./staff-shared";
export type {
  AttendanceRecord,
  Branch,
  Gamification,
  StaffProfile,
  StaffRole,
  StaffTask,
} from "./staff-shared";
export { ROLE_LABELS } from "./staff-shared";

type VerifiedStaffUser = {
  id: string;
};

export const getStaffContext = cache(async () => {
  const supabase = await supabaseServer();
  // Identity is established from a cryptographically verified JWT claim.
  // With the project's asymmetric signing key this avoids the Auth network
  // request made by getUser(), while PostgREST continues to enforce the same
  // authenticated JWT and RLS policies for the profile query below.
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) return null;

  const user: VerifiedStaffUser = { id: userId };

  const { data: rawProfile, error } = await supabase
    .from("staff_profiles")
    .select("user_id,full_name,role,branch_id,scheduled_start,scheduled_end,is_active,nationality,preferred_language")
    .eq("user_id", userId)
    .single();

  if (error || !rawProfile) {
    return { user, profile: null, supabase };
  }

  return {
    user,
    profile: rawProfile as StaffProfile,
    supabase,
  };
});

export async function requireStaff() {
  const context = await getStaffContext();
  if (!context?.user) redirect("/staff/login");
  if (!context.profile?.is_active) redirect("/staff/login?error=profile");
  return { ...context, profile: context.profile };
}

export function usesAttendance(role: StaffRole) {
  return !["owner", "manager", "shift_manager"].includes(role);
}
