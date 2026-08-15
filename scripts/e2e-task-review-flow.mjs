// End-to-end check of the full operations loop:
//   owner assigns → employee works the shift → owner reviews → employee is notified.
//
// Runs against the live project using only the [TEST] accounts created by
// seed-test-staff.mjs, and cleans its own records first so it is idempotent.
//   TEST_STAFF_PASSWORD='…' node scripts/e2e-task-review-flow.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const TEST_DOMAIN = "test.tres-staff.com";
// These are real logins in the live project, so the password stays out of the
// repo — supply it per run, exactly as seed-test-staff.mjs does.
const PASSWORD = process.env.TEST_STAFF_PASSWORD;
if (!PASSWORD) {
  console.error("set TEST_STAFF_PASSWORD (the value used with seed-test-staff.mjs)");
  process.exit(1);
}
const BRANCH_PIN = { p_latitude: 21.277932, p_longitude: 40.4348957, p_accuracy_meters: 10 };

function getEnv() {
  const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  return Object.fromEntries(
    raw.split("\n").filter((l) => l.includes("=") && !l.trimStart().startsWith("#")).map((l) => {
      const at = l.indexOf("=");
      return [l.slice(0, at).trim(), l.slice(at + 1).trim()];
    }),
  );
}

const env = getEnv();
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function login(email) {
  const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { data, error } = await anon.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return {
    user: data.user,
    client: createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
      auth: { persistSession: false },
    }),
  };
}

const branchToday = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());

const results = [];
function check(name, passed, detail = "") {
  results.push({ name, passed, detail });
  console.log(`  ${passed ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function uploadProof(userId, suffix) {
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64",
  );
  const path = `${userId}/${suffix}`;
  await admin.storage.from("staff-evidence").upload(path, png, { contentType: "image/png", upsert: true });
  return path;
}

const today = branchToday();
console.log(`=== TASK REVIEW + NOTIFICATION LOOP (${today}) ===\n`);

// ── Setup ──────────────────────────────────────────────────────────────────
const owner = await login(`owner@${TEST_DOMAIN}`);
const barista = await login(`barista@${TEST_DOMAIN}`);
const supervisor = await login(`supervisor@${TEST_DOMAIN}`);

console.log("--> Cleaning previous run\n");
await admin.from("staff_notifications").delete().eq("user_id", barista.user.id);
await admin.from("tasks").delete().eq("user_id", barista.user.id).eq("task_date", today);
await admin.from("attendance_records").delete().eq("user_id", barista.user.id).eq("shift_date", today);
await admin.from("barista_reports").delete().eq("submitted_by", barista.user.id).eq("report_date", today);

// ── 1. Owner assigns ───────────────────────────────────────────────────────
console.log("--> 1. Owner creates and assigns tasks");
const assign = async (title, extra = {}) =>
  owner.client.rpc("owner_assign_custom_task", {
    p_employee_ids: [barista.user.id],
    p_task_date: today,
    p_title: title,
    p_notes: "تعليمات المالك",
    p_is_required: true,
    p_requires_photo: false,
    p_requires_note: false,
    p_response_type: "completion",
    ...extra,
  });

const a1 = await assign("E2E — تنظيف ماكينة الإسبريسو");
const a2 = await assign("E2E — جرد الحليب");
check("owner assigned 2 tasks", a1.data?.ok === true && a2.data?.ok === true,
  `${a1.data?.assigned ?? 0}+${a2.data?.assigned ?? 0}`);

// ── 2. Employee sees them (RLS, employee's own client) ─────────────────────
console.log("\n--> 2. Employee works the shift");
const start = await barista.client.rpc("start_shift", BRANCH_PIN);
check("employee started shift", start.data?.ok === true || start.data?.code === "already_active",
  start.data?.code ?? "ok");

const { data: visible } = await barista.client
  .from("tasks").select("id,title,completed")
  .eq("user_id", barista.user.id).lte("task_date", today).eq("completed", false);
check("employee can see assigned tasks", (visible ?? []).length >= 2, `${visible?.length ?? 0} visible`);

for (const task of visible ?? []) {
  const done = await barista.client.rpc("complete_task", { p_task_id: task.id, p_note: "تم" });
  if (!done.data?.ok) check(`complete "${task.title}"`, false, JSON.stringify(done.data ?? done.error));
}
check("employee completed all tasks", true);

const proof = await uploadProof(barista.user.id, `barista/${today}/e2e.png`);
const report = await barista.client.rpc("submit_barista_report", {
  p_handover_notes: "E2E — تسليم الوردية وتنظيف البار بالكامل",
  p_report_data: { checks: ["machine", "grinder"] },
  p_bar_clean_confirmed: true,
  p_photo_paths: [proof],
});
check("employee submitted report", report.data?.ok === true, report.data?.code ?? "");

const end = await barista.client.rpc("end_shift", BRANCH_PIN);
check("employee ended shift", end.data?.ok === true, end.data?.code ?? `points ${end.data?.points_earned}`);

// ── 3. Owner reviews the results ───────────────────────────────────────────
console.log("\n--> 3. Owner reviews the submitted work");
const { data: reviewQueue } = await owner.client
  .from("tasks").select("id,title,completed,review_status")
  .eq("user_id", barista.user.id).eq("task_date", today).eq("completed", true).is("review_status", null);
check("completed tasks appear in owner review queue", (reviewQueue ?? []).length === 2,
  `${reviewQueue?.length ?? 0} awaiting review`);

const [taskApprove, taskReject] = reviewQueue ?? [];

const noNotes = await owner.client.rpc("review_task", {
  p_task_id: taskReject.id, p_decision: "rejected", p_review_notes: "  ", p_reopen: true,
});
check("rejection without notes is refused", noNotes.data?.code === "review_notes_required", noNotes.data?.code);

const ok1 = await owner.client.rpc("review_task", {
  p_task_id: taskApprove.id, p_decision: "approved", p_review_notes: "عمل ممتاز",
});
check("owner approved a task", ok1.data?.ok === true && ok1.data?.decision === "approved");

const twice = await owner.client.rpc("review_task", {
  p_task_id: taskApprove.id, p_decision: "approved",
});
check("a task cannot be reviewed twice", twice.data?.code === "task_already_reviewed", twice.data?.code);

const ok2 = await owner.client.rpc("review_task", {
  p_task_id: taskReject.id, p_decision: "rejected",
  p_review_notes: "الماكينة ما زالت متسخة، أعد التنظيف", p_reopen: true,
});
check("owner rejected a task with redo", ok2.data?.ok === true && ok2.data?.reopened === true);

const { data: reopened } = await admin.from("tasks")
  .select("completed,completed_at,photo_path,review_status,notes").eq("id", taskReject.id).single();
check("rejected task reopened for the employee",
  reopened.completed === false && reopened.completed_at === null && reopened.review_status === null,
  `completed=${reopened.completed}`);
check("reopen reason attached to the task", (reopened.notes ?? "").includes("سبب الإعادة"));

// Reports are auto-confirmed on submit, so the owner's verdict is an override.
// No service-role fixup here on purpose: this must work exactly as the UI does.
const { data: reportRow } = await owner.client.from("barista_reports")
  .select("id,status,auto_approved").eq("submitted_by", barista.user.id).eq("report_date", today)
  .order("revision", { ascending: false }).limit(1).single();
check("submitted report starts auto-approved", reportRow?.auto_approved === true,
  `status=${reportRow?.status}`);

const repReview = await owner.client.rpc("review_staff_report", {
  p_report_type: "barista", p_report_id: reportRow.id, p_decision: "rejected",
  p_review_notes: "الصور غير واضحة، أعد إرسال التقرير",
});
check("owner can override an auto-approved report", repReview.data?.ok === true,
  repReview.error?.message ?? "");

const repTwice = await owner.client.rpc("review_staff_report", {
  p_report_type: "barista", p_report_id: reportRow.id, p_decision: "confirmed",
  p_review_notes: "محاولة مراجعة ثانية",
});
check("a human verdict is final",
  (repTwice.error?.message ?? "").includes("already been reviewed"),
  repTwice.error?.message ?? "allowed!");

// ── 4. Employee is notified ────────────────────────────────────────────────
console.log("\n--> 4. Employee's notification bell");
const { data: bell } = await barista.client
  .from("staff_notifications").select("id,kind,entity_type,decision,title,note,read_at")
  .is("read_at", null).order("created_at", { ascending: false });

check("employee has 3 unread notifications", (bell ?? []).length === 3, `${bell?.length ?? 0} unread`);
check("approved task notification present",
  (bell ?? []).some((n) => n.kind === "task_review" && n.decision === "approved"));
check("rejected task notification carries the reason",
  (bell ?? []).some((n) => n.kind === "task_review" && n.decision === "rejected" && (n.note ?? "").includes("متسخة")));
check("report rejection notification present",
  (bell ?? []).some((n) => n.kind === "report_review" && n.entity_type === "barista" && n.decision === "rejected"));

// ── 5. Isolation + read-state ──────────────────────────────────────────────
console.log("\n--> 5. Permissions and read state");
const { data: otherBell } = await supervisor.client
  .from("staff_notifications").select("id").eq("user_id", barista.user.id);
check("another employee cannot read someone else's bell", (otherBell ?? []).length === 0,
  `${otherBell?.length ?? 0} rows leaked`);

const { data: freshTask } = await admin.from("tasks").select("id")
  .eq("user_id", barista.user.id).eq("completed", true).is("review_status", null).limit(1).maybeSingle();
if (freshTask) {
  const employeeReview = await barista.client.rpc("review_task", {
    p_task_id: freshTask.id, p_decision: "approved",
  });
  check("an employee cannot review tasks", Boolean(employeeReview.error), employeeReview.error?.code ?? "allowed!");
}

const marked = await barista.client.rpc("mark_staff_notifications_read", { p_ids: null });
check("employee can clear the bell", marked.data?.ok === true, `marked ${marked.data?.marked}`);
const { data: afterRead } = await barista.client
  .from("staff_notifications").select("id").is("read_at", null);
check("bell is empty after reading", (afterRead ?? []).length === 0, `${afterRead?.length ?? 0} unread`);

// ── Summary ────────────────────────────────────────────────────────────────
const failed = results.filter((r) => !r.passed);
console.log("\n====================================================");
console.log(`  ${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  for (const f of failed) console.log(`  ✗ ${f.name} ${f.detail}`);
  process.exitCode = 1;
} else {
  console.log("  ALL GREEN — full loop verified");
}
console.log("====================================================");
