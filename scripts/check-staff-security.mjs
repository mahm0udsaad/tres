import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const migrationsDir = join(root, "supabase", "migrations");
const migrations = readdirSync(migrationsDir)
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .map((name) => readFileSync(join(migrationsDir, name), "utf8"))
  .join("\n");

const reportsDir = join(root, "app", "staff", "reports");
const reportSource = readdirSync(reportsDir)
  .filter((name) => /\.(ts|tsx)$/.test(name))
  .map((name) => readFileSync(join(reportsDir, name), "utf8"))
  .join("\n");
const staffSource = readdirSync(join(root, "app", "staff"), {
  recursive: true,
  withFileTypes: true,
})
  .filter((entry) => entry.isFile() && /\.(ts|tsx)$/.test(entry.name))
  .map((entry) => readFileSync(join(entry.parentPath, entry.name), "utf8"))
  .join("\n");

const failures = [];
function requirePattern(label, pattern, source = migrations) {
  if (!pattern.test(source)) failures.push(`missing: ${label}`);
}
function forbidPattern(label, pattern, source) {
  if (pattern.test(source)) failures.push(`forbidden: ${label}`);
}

for (const table of [
  "branches",
  "staff_profiles",
  "attendance_records",
  "tasks",
  "gamification",
  "cleaning_reports",
  "barista_reports",
  "kitchen_reports",
  "water_quality_checks",
  "daily_beverage_logs",
  "checklist_templates",
]) {
  requirePattern(
    `RLS enabled for ${table}`,
    new RegExp(`alter table public\\.${table} enable row level security`, "i"),
  );
}

for (const rpc of [
  "start_shift",
  "end_shift",
  "submit_cleaning_report",
  "submit_barista_report",
  "submit_kitchen_report",
  "review_staff_report",
  "record_water_quality_check",
  "log_daily_beverage",
  "get_daily_beverage_report",
  "register_branch_staff",
  "set_branch_staff_active",
  "save_checklist_template",
  "set_checklist_template_active",
  "supervisor_override_shift",
  "get_branch_shift_status",
  "get_owner_overview",
]) {
  requirePattern(
    `anonymous execute revoked for ${rpc}`,
    new RegExp(`revoke all on function public\\.${rpc}\\([^;]+from public, anon;`, "i"),
  );
  requirePattern(
    `authenticated execute granted for ${rpc}`,
    new RegExp(`grant execute on function public\\.${rpc}\\([^;]+to authenticated;`, "i"),
  );
}

requirePattern(
  "private evidence bucket",
  /values\s*\(\s*'staff-evidence'\s*,\s*'staff-evidence'\s*,\s*false\s*\)/i,
);
requirePattern(
  "proof tasks cannot be manually checked",
  /task_type\s*=\s*'general_duty'/i,
);
requirePattern(
  "attendance excludes management/read-only roles",
  /role\s+in\s*\(\s*'owner'\s*,\s*'manager'\s*,\s*'shift_manager'\s*\)/i,
);
forbidPattern(
  "shift-manager reports importing or querying attendance",
  /\b(attendance_records|points_earned|break_duration_minutes|start_location|end_location)\b/i,
  reportSource,
);
forbidPattern(
  "service-role key referenced by staff client code",
  /SUPABASE_SERVICE_ROLE_KEY|supabaseAdmin\s*\(/,
  staffSource,
);
forbidPattern(
  "auth admin API referenced by staff client code",
  /auth\.admin\./,
  staffSource,
);
requirePattern(
  "staff registration limited to non-privileged roles",
  /p_role not in \('employee', 'cleaning_staff', 'barista', 'kitchen_manager'\)/i,
);
requirePattern(
  "staff registration scoped to the supervisor branch",
  /values \(p_new_user_id, v_name, p_role, v_profile\.branch_id, p_scheduled_start\)/i,
);
requirePattern(
  "photo-required tasks cannot complete without a stored photo",
  /not completed or not requires_photo or photo_path is not null/i,
);
requirePattern(
  "checklist photo evidence validated inside Postgres",
  /perform private\.assert_staff_evidence\(p_user_id, array\[p_photo_path\], true\)/i,
);
requirePattern(
  "owner report page is not blocked by a missing branch",
  /const hasReportScope = allowed && \(isOwner \|\| Boolean\(profile\.branch_id\)\)/,
  reportSource,
);
requirePattern(
  "owner report review is authorized by the server action",
  /profile\.role !== "owner" && profile\.role !== "supervisor"/,
  reportSource,
);
requirePattern(
  "owner report review bypasses only the supervisor branch restriction",
  /v_profile\.role <> 'owner' and v_branch_id <> v_profile\.branch_id/i,
);

if (failures.length) {
  console.error(failures.map((failure) => `✗ ${failure}`).join("\n"));
  process.exit(1);
}

console.log("✓ staff schema/RLS/RPC/storage invariants");
console.log("✓ shift-manager report source contains no attendance fields");
console.log("✓ staff routes contain no service-role access");
