import "server-only";
import type { requireStaff } from "../lib/staff";
import { dashboardLang } from "../lib/staff-shared";
import { t, type Lang } from "../lib/staff-i18n";

/**
 * Shared photo-evidence helpers for the staff app. Uploads always go to the
 * private `staff-evidence` bucket under the caller's own folder
 * (`<uid>/<module>/...`) — the storage RLS policies reject anything else.
 */

export const EVIDENCE_BUCKET = "staff-evidence";
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
export const MAX_REPORT_IMAGES = 3;
export const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};
export const IMAGE_ACCEPT = Object.keys(IMAGE_EXTENSIONS).join(",");

export type StaffContext = Awaited<ReturnType<typeof requireStaff>>;

export function imageFiles(form: FormData, field: string) {
  return form
    .getAll(field)
    .filter((entry): entry is File => typeof entry !== "string" && entry.size > 0);
}

export function validateImages(files: File[], required: boolean, lang: Lang) {
  if (required && files.length === 0) return t("photo_one_min", lang);
  if (files.length > MAX_REPORT_IMAGES) return t("photo_max", lang, { max: MAX_REPORT_IMAGES });
  for (const file of files) {
    if (!IMAGE_EXTENSIONS[file.type]) return t("photo_format", lang);
    if (file.size > MAX_IMAGE_BYTES) return t("photo_size", lang);
  }
  return null;
}

export function dateInTimeZone(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function branchDay(context: StaffContext) {
  const lang = dashboardLang(context.profile);
  if (!context.profile.branch_id) {
    return { error: t("no_branch_account", lang) } as const;
  }
  const { data, error } = await context.supabase
    .from("branches")
    .select("timezone")
    .eq("id", context.profile.branch_id)
    .single();
  if (error || !data) {
    return { error: t("branch_check_failed", lang) } as const;
  }
  return {
    branchId: context.profile.branch_id,
    reportDate: dateInTimeZone(String(data.timezone || "Asia/Riyadh")),
  } as const;
}

/** Upload files to `<uid>/<module>/<subpath>/<uuid>.<ext>`; all-or-nothing. */
export async function uploadEvidence(
  context: StaffContext,
  module: string,
  subpath: string,
  files: File[],
): Promise<{ paths: string[] } | { error: string }> {
  const uploads = await Promise.all(
    files.map(async (file) => {
      const extension = IMAGE_EXTENSIONS[file.type];
      const path =
        `${context.user.id}/${module}/${subpath}/${crypto.randomUUID()}.${extension}`;
      const { error } = await context.supabase.storage
        .from(EVIDENCE_BUCKET)
        .upload(path, file, {
          cacheControl: "3600",
          contentType: file.type,
          upsert: false,
        });
      return { path, error };
    }),
  );

  const successfulPaths = uploads
    .filter((upload) => !upload.error)
    .map((upload) => upload.path);
  if (uploads.some((upload) => upload.error)) {
    if (successfulPaths.length) {
      await context.supabase.storage.from(EVIDENCE_BUCKET).remove(successfulPaths);
    }
    return { error: t("photo_upload_failed", dashboardLang(context.profile)) };
  }
  return { paths: successfulPaths };
}

export async function removeEvidence(context: StaffContext, paths: string[]) {
  if (paths.length) {
    await context.supabase.storage.from(EVIDENCE_BUCKET).remove(paths);
  }
}
