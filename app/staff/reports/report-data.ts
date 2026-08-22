import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export const REPORT_CONFIG = {
  cleaning: {
    table: "cleaning_reports",
    label: "تقرير النظافة",
    accent: "cleaning",
  },
  barista: {
    table: "barista_reports",
    label: "تقرير الباريستا",
    accent: "barista",
  },
  kitchen: {
    table: "kitchen_reports",
    label: "تقرير المطبخ",
    accent: "kitchen",
  },
} as const;

export type ReportType = keyof typeof REPORT_CONFIG;
export type ReportStatus = "pending" | "confirmed" | "rejected";

type RawReport = Record<string, unknown> & {
  id: string;
  branch_id: string;
  submitted_by: string;
  report_date: string;
  status: ReportStatus;
  reviewed_by?: string | null;
  review_notes?: string | null;
  reviewed_at?: string | null;
  auto_approved?: boolean;
  photo_paths?: unknown;
  photos?: unknown;
};

export type UnifiedReport = RawReport & {
  type: ReportType;
  title: string;
  submitterName: string;
  reviewerName: string | null;
  employeeNote?: string | null;
  signedPhotos: Array<{ path: string; url: string }>;
};

export type WaterQualityCheck = {
  id: string;
  saltRatio: number;
  notes: string | null;
  createdAt: string;
  recorderName: string;
  signedPhotoUrl: string | null;
};

export type BeverageEmployeeSummary = {
  employeeId: string;
  employeeName: string;
  consumed: boolean;
  recorded: boolean;
};

function photoPaths(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const paths = value.flatMap((item) => {
    if (typeof item === "string") return [item];
    if (item && typeof item === "object") {
      const path = (item as Record<string, unknown>).path;
      return typeof path === "string" ? [path] : [];
    }
    return [];
  });

  // Evidence must always be a bucket-relative object path. Silently discard
  // public/remote URLs so they cannot bypass private Storage access controls.
  return [
    ...new Set(
      paths.filter((path) => path && !/^(?:https?:)?\/\//i.test(path)),
    ),
  ];
}

export async function loadBranchReports(
  supabase: SupabaseClient,
  branchId: string | null,
) {
  const entries = Object.entries(REPORT_CONFIG) as Array<
    [ReportType, (typeof REPORT_CONFIG)[ReportType]]
  >;

  const queryResults = await Promise.all(
    entries.map(async ([type, config]) => {
      let query = supabase
        .from(config.table)
        .select("*")
        .order("report_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(100);
      if (branchId) query = query.eq("branch_id", branchId);
      const { data, error } = await query;
      return { type, config, data: (data ?? []) as RawReport[], error };
    }),
  );

  const errors = queryResults
    .filter(({ error }) => error)
    .map(({ config, error }) => `${config.label}: ${error?.message}`);
  const rows = queryResults.flatMap(({ type, config, data }) =>
    data.map((row) => ({ ...row, type, title: config.label })),
  );

  const profileIds = [
    ...new Set(
      rows.flatMap((row) =>
        [row.submitted_by, row.reviewed_by].filter(
          (value): value is string => typeof value === "string" && value.length > 0,
        ),
      ),
    ),
  ];

  const allPhotoPaths = [
    ...new Set(
      rows.flatMap((row) => photoPaths(row.photo_paths ?? row.photos)),
    ),
  ];
  const [profilesResult, signedUrlsResult] = await Promise.all([
    profileIds.length
      ? supabase
          .from("staff_profiles")
          .select("user_id,full_name")
          .in("user_id", profileIds)
      : Promise.resolve({ data: [], error: null }),
    allPhotoPaths.length
      ? supabase.storage
          .from("staff-evidence")
          .createSignedUrls(allPhotoPaths, 10 * 60)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const { data: profiles, error: profilesError } = profilesResult;
  if (profilesError) errors.push(`أسماء الموظفين: ${profilesError.message}`);

  const names = new Map(
    (profiles ?? []).map((profile) => [profile.user_id, profile.full_name]),
  );
  const signedUrlByPath = new Map(
    (signedUrlsResult.data ?? []).flatMap((item) =>
      item.path && item.signedUrl ? [[item.path, item.signedUrl] as const] : [],
    ),
  );

  const reports = rows.map(
    (row): UnifiedReport => ({
      ...row,
      submitterName: names.get(row.submitted_by) ?? "موظف",
      reviewerName: row.reviewed_by
        ? names.get(row.reviewed_by) ?? "المشرف"
        : null,
      signedPhotos: photoPaths(row.photo_paths ?? row.photos).flatMap((path) => {
        const url = signedUrlByPath.get(path);
        return url ? [{ path, url }] : [];
      }),
    }),
  );

  return { reports, errors };
}

/**
 * Tasks the employee has finished but nobody has judged yet.
 *
 * `branchId` is null for the owner, who reviews every branch; a supervisor
 * passes their own branch and RLS keeps the rest out of reach anyway.
 */
export async function loadTasksAwaitingReview(
  supabase: SupabaseClient,
  branchId: string | null,
) {
  const errors: string[] = [];
  const { data, error } = await supabase
    .from("tasks")
    .select("id,user_id,title,notes,task_date,response_type,yes_no_answer,completed_at,photo_path")
    .eq("completed", true)
    .is("review_status", null)
    .order("task_date", { ascending: false })
    .order("completed_at", { ascending: false })
    .limit(100);
  if (error) errors.push(`مهام بانتظار المراجعة: ${error.message}`);

  const rows = data ?? [];
  if (!rows.length) return { tasks: [], errors };

  const userIds = [...new Set(rows.map((row) => row.user_id))];
  const photoPathList = [
    ...new Set(rows.map((row) => row.photo_path).filter((path): path is string => Boolean(path))),
  ];

  const [profilesResult, branchesResult, signedResult] = await Promise.all([
    supabase.from("staff_profiles").select("user_id,full_name,branch_id").in("user_id", userIds),
    supabase.from("branches").select("id,name"),
    photoPathList.length
      ? supabase.storage.from("staff-evidence").createSignedUrls(photoPathList, 10 * 60)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (profilesResult.error) errors.push(`أسماء الموظفين: ${profilesResult.error.message}`);

  const profiles = new Map((profilesResult.data ?? []).map((row) => [row.user_id, row]));
  const branchNames = new Map((branchesResult.data ?? []).map((row) => [row.id, row.name]));
  const signedUrls = new Map(
    (signedResult.data ?? []).flatMap((item) =>
      item.path && item.signedUrl ? [[item.path, item.signedUrl] as const] : [],
    ),
  );

  const tasks = rows
    .filter((row) => !branchId || profiles.get(row.user_id)?.branch_id === branchId)
    .map((row) => {
      const profile = profiles.get(row.user_id);
      return {
        id: row.id,
        title: row.title,
        notes: row.notes,
        task_date: row.task_date,
        employeeName: profile?.full_name ?? "موظف",
        branchName: profile?.branch_id ? branchNames.get(profile.branch_id) ?? null : null,
        response_type: (row.response_type === "yes_no" ? "yes_no" : "completion") as
          | "completion"
          | "yes_no",
        yes_no_answer: row.yes_no_answer,
        completed_at: row.completed_at,
        photoUrl: row.photo_path ? signedUrls.get(row.photo_path) ?? null : null,
      };
    });

  return { tasks, errors };
}

export async function loadBranchDailyOperations(
  supabase: SupabaseClient,
  branchId: string,
  reportDate: string,
) {
  const [waterResult, beverageResult] = await Promise.all([
    supabase
      .from("water_quality_checks")
      .select("*")
      .eq("branch_id", branchId)
      .eq("check_date", reportDate)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.rpc("get_daily_beverage_report", {
      p_report_date: reportDate,
    }),
  ]);

  const errors: string[] = [];
  if (waterResult.error) {
    errors.push(`فحوص المياه: ${waterResult.error.message}`);
  }
  if (beverageResult.error) {
    errors.push(`المشروبات اليومية: ${beverageResult.error.message}`);
  }

  const rawWater = (waterResult.data ?? []) as Array<Record<string, unknown>>;
  const beveragePayload =
    beverageResult.data &&
    typeof beverageResult.data === "object" &&
    !Array.isArray(beverageResult.data)
      ? (beverageResult.data as Record<string, unknown>)
      : null;
  if (!beverageResult.error && beveragePayload?.ok === false) {
    errors.push("تعذّر إنشاء ملخص المشروبات اليومية.");
  }
  const rawBeverages = Array.isArray(beveragePayload?.employees)
    ? (beveragePayload.employees as Array<Record<string, unknown>>)
    : [];
  const profileIds = [
    ...new Set(
      [
        ...rawWater.map((row) => row.recorded_by ?? row.checked_by),
      ].filter(
        (value): value is string =>
          typeof value === "string" && value.length > 0,
      ),
    ),
  ];
  const waterPhotoPaths = [
    ...new Set(
      rawWater
        .map((row) => row.photo_path)
        .filter(
          (value): value is string =>
            typeof value === "string" &&
            value.length > 0 &&
            !/^(?:https?:)?\/\//i.test(value),
        ),
    ),
  ];

  const [profilesResult, signedUrlsResult] = await Promise.all([
    profileIds.length
      ? supabase
          .from("staff_profiles")
          .select("user_id,full_name")
          .in("user_id", profileIds)
      : Promise.resolve({ data: [], error: null }),
    waterPhotoPaths.length
      ? supabase.storage
          .from("staff-evidence")
          .createSignedUrls(waterPhotoPaths, 10 * 60)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (profilesResult.error) {
    errors.push(`أسماء الموظفين: ${profilesResult.error.message}`);
  }

  const names = new Map(
    (profilesResult.data ?? []).map((profile) => [
      profile.user_id,
      profile.full_name,
    ]),
  );
  const signedUrlByPath = new Map(
    (signedUrlsResult.data ?? []).flatMap((item) =>
      item.path && item.signedUrl ? [[item.path, item.signedUrl] as const] : [],
    ),
  );

  const waterChecks: WaterQualityCheck[] = rawWater.map((row) => {
    const recorderId =
      typeof row.recorded_by === "string"
        ? row.recorded_by
        : typeof row.checked_by === "string"
          ? row.checked_by
          : null;
    const photoPath =
      typeof row.photo_path === "string" ? row.photo_path : null;
    return {
      id: String(row.id),
      saltRatio: Number(row.salt_ratio),
      notes: typeof row.notes === "string" && row.notes ? row.notes : null,
      createdAt: String(row.created_at),
      recorderName: recorderId
        ? names.get(recorderId) ?? "موظف"
        : "موظف",
      signedPhotoUrl: photoPath
        ? signedUrlByPath.get(photoPath) ?? null
        : null,
    };
  });

  const beverages = rawBeverages.flatMap(
    (row): BeverageEmployeeSummary[] =>
      typeof row.employee_id === "string"
        ? [
            {
              employeeId: row.employee_id,
              employeeName:
                typeof row.full_name === "string" && row.full_name
                  ? row.full_name
                  : "موظف",
              consumed: row.consumed === true,
              recorded: row.recorded === true,
            },
          ]
        : [],
  );

  return {
    waterChecks,
    beverages,
    errors,
  };
}
