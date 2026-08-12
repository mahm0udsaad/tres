import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { StaffRole } from "../../lib/staff-shared";

/**
 * Everything the owner panel shows comes from one RPC (`get_owner_overview`),
 * so the page stays a dumb renderer and the numbers are computed once, inside
 * Postgres, under the owner's own session.
 */

export type StaffStatusToday = "working" | "finished" | "absent" | "admin";

export type OwnerBranch = {
  id: string;
  name: string;
  timezone: string;
  today: string;
  staff: number;
  working_now: number;
  attended_today: number;
  late_today: number;
  pending_reports: number;
  reports_today: number;
  water_ratio_today: number | null;
  drinks_taken_today: number;
};

export type OwnerStaffRow = {
  user_id: string;
  name: string;
  role: StaffRole;
  branch_name: string | null;
  is_active: boolean;
  uses_attendance: boolean;
  scheduled_start: string | null;
  scheduled_end: string | null;
  status_today: StaffStatusToday;
  started_at: string | null;
  on_time_today: boolean | null;
  shifts: number;
  on_time_shifts: number;
  last_shift: string | null;
  points: number;
  streak: number;
  pending_reports: number;
};

export type OwnerTrendDay = {
  date: string;
  attended: number;
  on_time: number;
  hours: number;
  reports: number;
};

export type OwnerPendingReport = {
  id: string;
  type: "cleaning" | "barista" | "kitchen";
  report_date: string;
  created_at: string;
  branch_name: string | null;
  staff_name: string;
};

export type OwnerOverview = {
  ok: true;
  today: string;
  days: number;
  totals: {
    branches: number;
    staff: number;
    inactive_staff: number;
    field_staff: number;
  };
  today_stats: {
    working_now: number;
    finished: number;
    attended: number;
    on_time: number;
    late: number;
    absent: number;
    tasks_done: number;
    tasks_total: number;
    reports_today: number;
    reports_pending: number;
    points_today: number;
  };
  branches: OwnerBranch[];
  trend: OwnerTrendDay[];
  staff: OwnerStaffRow[];
  pending_reports: OwnerPendingReport[];
};

export const REPORT_TYPE_LABELS: Record<OwnerPendingReport["type"], string> = {
  cleaning: "تقرير النظافة",
  barista: "تقرير الباريستا",
  kitchen: "تقرير المطبخ",
};

export async function loadOwnerOverview(
  supabase: SupabaseClient,
  days = 14,
): Promise<{ overview: OwnerOverview | null; error: string | null }> {
  const { data, error } = await supabase.rpc("get_owner_overview", { p_days: days });

  if (error) return { overview: null, error: error.message };
  if (!data || typeof data !== "object") {
    return { overview: null, error: "تعذّر تحميل بيانات اللوحة." };
  }

  return { overview: data as OwnerOverview, error: null };
}
