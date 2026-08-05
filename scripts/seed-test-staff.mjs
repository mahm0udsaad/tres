// Test fixtures for the operations system.
//
//   node scripts/seed-test-staff.mjs            # create branch + accounts
//   node scripts/seed-test-staff.mjs --cleanup  # remove everything it created
//
// Every account lives on the TEST_DOMAIN below and the branch name carries a
// [TEST] marker, so --cleanup can find and remove them without touching real
// data. Uses the service-role key from .env.local — never import this from the
// app; it is a local operator script.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const TEST_DOMAIN = "test.tres-staff.com";
const TEST_BRANCH = "فرع الاختبار [TEST]";

// These accounts are real logins in the live project, so the password is never
// committed — supply it per run:
//   TEST_STAFF_PASSWORD='…' node scripts/seed-test-staff.mjs
const PASSWORD = process.env.TEST_STAFF_PASSWORD;

// The real TRES pin, read from the branch's Google Maps link.
const BRANCH_LOCATION = { latitude: 21.277932, longitude: 40.4348957, radius_meters: 150 };

const ACCOUNTS = [
  // Owner/manager see the branch-location screen; the rest exercise the shift flow.
  { email: `owner@${TEST_DOMAIN}`, full_name: "محمود المالك [TEST]", role: "owner", nationality: "Saudi Arabia", preferred_language: "ar", scheduled_start: null },
  { email: `supervisor@${TEST_DOMAIN}`, full_name: "سلمان المشرف [TEST]", role: "supervisor", nationality: "Saudi Arabia", preferred_language: "ar", scheduled_start: "08:00" },
  { email: `shift@${TEST_DOMAIN}`, full_name: "فهد مدير الوردية [TEST]", role: "shift_manager", nationality: "Saudi Arabia", preferred_language: "ar", scheduled_start: "08:00" },
  { email: `barista@${TEST_DOMAIN}`, full_name: "ماجد الباريستا [TEST]", role: "barista", nationality: "Saudi Arabia", preferred_language: "ar", scheduled_start: "09:00" },
  { email: `kitchen@${TEST_DOMAIN}`, full_name: "Rahim Kitchen [TEST]", role: "kitchen_manager", nationality: "Bangladesh", preferred_language: "en", scheduled_start: "07:00" },
  { email: `cleaner@${TEST_DOMAIN}`, full_name: "Joseph Cleaning [TEST]", role: "cleaning_staff", nationality: "Kenya", preferred_language: "en", scheduled_start: "06:00" },
  { email: `employee@${TEST_DOMAIN}`, full_name: "Amina Employee [TEST]", role: "employee", nationality: "Kenya", preferred_language: "en", scheduled_start: "10:00" },
];

function env() {
  const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  return Object.fromEntries(
    raw
      .split("\n")
      .filter((line) => line.includes("=") && !line.trimStart().startsWith("#"))
      .map((line) => {
        const at = line.indexOf("=");
        return [line.slice(0, at).trim(), line.slice(at + 1).trim()];
      }),
  );
}

const config = env();
const sb = createClient(config.NEXT_PUBLIC_SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findTestUsers() {
  const found = [];
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    found.push(...data.users.filter((user) => (user.email ?? "").endsWith(`@${TEST_DOMAIN}`)));
    if (data.users.length < 200) break;
  }
  return found;
}

async function cleanup() {
  const users = await findTestUsers();
  for (const user of users) {
    // staff_profiles/gamification/attendance cascade from auth.users.
    const { error } = await sb.auth.admin.deleteUser(user.id);
    console.log(error ? `✗ ${user.email}: ${error.message}` : `✓ removed ${user.email}`);
  }
  const { data: branches } = await sb.from("branches").select("id,name").like("name", "%[TEST]%");
  for (const branch of branches ?? []) {
    const { error } = await sb.from("branches").delete().eq("id", branch.id);
    console.log(error ? `✗ ${branch.name}: ${error.message}` : `✓ removed ${branch.name}`);
  }
  console.log(`\nRemoved ${users.length} test account(s).`);
}

async function seed() {
  if (!PASSWORD || PASSWORD.length < 8) {
    console.error("Set TEST_STAFF_PASSWORD (8+ chars) before seeding.");
    process.exit(1);
  }

  // 1. Branch — reused if a previous run already made it.
  const { data: existing } = await sb.from("branches").select("id").eq("name", TEST_BRANCH).maybeSingle();
  let branchId = existing?.id;
  if (branchId) {
    await sb.from("branches").update(BRANCH_LOCATION).eq("id", branchId);
  } else {
    const { data, error } = await sb
      .from("branches")
      .insert({ name: TEST_BRANCH, ...BRANCH_LOCATION })
      .select("id")
      .single();
    if (error) throw new Error(`branch: ${error.message}`);
    branchId = data.id;
  }
  console.log(`✓ branch ${TEST_BRANCH} (${branchId})`);
  console.log(`  ${BRANCH_LOCATION.latitude}, ${BRANCH_LOCATION.longitude} · ${BRANCH_LOCATION.radius_meters}m\n`);

  // 2. Accounts. Existing test users are reset to the known password so the
  //    fixture stays usable across runs.
  const already = new Map((await findTestUsers()).map((user) => [user.email, user.id]));

  for (const account of ACCOUNTS) {
    let userId = already.get(account.email);
    if (userId) {
      const { error } = await sb.auth.admin.updateUserById(userId, { password: PASSWORD });
      if (error) {
        console.log(`✗ ${account.email}: ${error.message}`);
        continue;
      }
    } else {
      const { data, error } = await sb.auth.admin.createUser({
        email: account.email,
        password: PASSWORD,
        email_confirm: true,
      });
      if (error) {
        console.log(`✗ ${account.email}: ${error.message}`);
        continue;
      }
      userId = data.user.id;
    }

    const { error: profileError } = await sb.from("staff_profiles").upsert(
      {
        user_id: userId,
        full_name: account.full_name,
        role: account.role,
        branch_id: branchId,
        scheduled_start: account.scheduled_start,
        is_active: true,
        nationality: account.nationality,
        preferred_language: account.preferred_language,
      },
      { onConflict: "user_id" },
    );
    if (profileError) {
      console.log(`✗ ${account.email} profile: ${profileError.message}`);
      continue;
    }

    await sb.from("gamification").upsert({ user_id: userId }, { onConflict: "user_id" });
    console.log(`✓ ${account.role.padEnd(15)} ${account.email}`);
  }

  console.log("\nEvery account uses the TEST_STAFF_PASSWORD you supplied.");
  console.log("Sign in at /staff/login — remove with: node scripts/seed-test-staff.mjs --cleanup");
}

if (process.argv.includes("--cleanup")) await cleanup();
else await seed();
