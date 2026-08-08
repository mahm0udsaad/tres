// Seeds a realistic two-week operations history so the owner panel has
// something to show before the real branch goes live.
//
//   node scripts/seed-demo-ops.mjs            # seed (idempotent — re-runs replace)
//   node scripts/seed-demo-ops.mjs --clean    # remove every demo row and account
//
// Everything it creates is tagged: accounts use the `demo.*@tres-staff.com`
// prefix and evidence lives under `<user id>/demo/`. Nothing else is touched,
// so the real `Tres primary` branch and the owner account survive --clean.
//
// Uses the service-role key on purpose: this is an operator script, never
// imported by the app. App code under app/staff/ must stay RLS-only.

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(
  readFileSync(join(root, ".env.local"), "utf8")
    .split("\n")
    .map((line) => line.match(/^([A-Z_]+)\s*=\s*(.*)$/))
    .filter(Boolean)
    .map((match) => [match[1], match[2].trim()]),
);

const URL_BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_BASE || !SERVICE_KEY) {
  console.error("✗ NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be in .env.local");
  process.exit(1);
}

const HEADERS = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

const BRANCH_NAME = "Tres primary";
const DEMO_PASSWORD = "Demo-1234-pass";
const DAYS = 14;
const TZ_OFFSET_HOURS = 3; // Asia/Riyadh, no DST

// ── tiny helpers ─────────────────────────────────────────────────────────────
async function rest(method, path, body, prefer = "return=representation") {
  const response = await fetch(`${URL_BASE}/rest/v1/${path}`, {
    method,
    headers: prefer ? { ...HEADERS, Prefer: prefer } : HEADERS,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${path} → ${response.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

async function auth(method, path, body) {
  const response = await fetch(`${URL_BASE}/auth/v1/${path}`, {
    method,
    headers: HEADERS,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${path} → ${response.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

/** Deterministic PRNG so repeated runs produce the same history. */
let seed = 20260805;
function random() {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
}
const pick = (list) => list[Math.floor(random() * list.length)];

const isoDate = (date) => date.toISOString().slice(0, 10);
/** Branch-local wall clock → UTC instant (minutes may overflow past 59). */
const atLocal = (day, hour, minute = 0) =>
  new Date(
    new Date(`${day}T00:00:00Z`).getTime() +
      ((hour - TZ_OFFSET_HOURS) * 60 + minute) * 60_000,
  );

// ── placeholder evidence images ──────────────────────────────────────────────
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}
/** A 64×64 solid-colour PNG — enough for the report thumbnails to resolve. */
function solidPng([r, g, b]) {
  const size = 64;
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // truecolour
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 3 + 1);
    raw[rowStart] = 0;
    for (let x = 0; x < size; x++) {
      const p = rowStart + 1 + x * 3;
      raw[p] = r;
      raw[p + 1] = g;
      raw[p + 2] = b;
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

async function uploadEvidence(path, colour) {
  const response = await fetch(`${URL_BASE}/storage/v1/object/staff-evidence/${path}`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "image/png",
      "x-upsert": "true",
    },
    body: solidPng(colour),
  });
  if (!response.ok && response.status !== 409) {
    throw new Error(`upload ${path} → ${response.status} ${await response.text()}`);
  }
  return path;
}

// ── the demo crew ────────────────────────────────────────────────────────────
const CREW = [
  { key: "saud", name: "سعود العتيبي", role: "supervisor", start: "07:00", nationality: "Saudi Arabia", lang: "ar", reliability: 0.98, punctual: 0.95 },
  { key: "rahim", name: "رحيم الإسلام", role: "barista", start: "07:00", nationality: "Bangladesh", lang: "bn", reliability: 0.93, punctual: 0.8 },
  { key: "joseph", name: "جوزيف كيبيت", role: "cleaning_staff", start: "06:30", nationality: "Kenya", lang: "en", reliability: 0.9, punctual: 0.85 },
  { key: "hassan", name: "محمد حسن", role: "kitchen_manager", start: "08:00", nationality: "Egypt", lang: "ar", reliability: 0.88, punctual: 0.7 },
  { key: "anita", name: "أنيتا واتشيرا", role: "employee", start: "09:00", nationality: "Kenya", lang: "en", reliability: 0.82, punctual: 0.75 },
  { key: "fahad", name: "فهد الشهري", role: "shift_manager", start: null, nationality: "Saudi Arabia", lang: "ar", reliability: 0, punctual: 0 },
  // Deliberately never attends: reliability 0 leaves this account with a clean
  // slate so the geofenced start-shift flow is always testable.
  { key: "test", name: "حساب تجربة بدء الوردية", role: "employee", start: "09:00", nationality: "Saudi Arabia", lang: "ar", reliability: 0, punctual: 0 },
];
const email = (key) => `demo.${key}@tres-staff.com`;

const REPORT_BY_ROLE = {
  cleaning_staff: "cleaning_reports",
  barista: "barista_reports",
  kitchen_manager: "kitchen_reports",
};

const CHECKLIST = [
  { role: null, title: "التأكد من نظافة دورات المياه", requires_photo: true, sort_order: 1 },
  { role: "barista", title: "تنظيف ماكينة الإسبريسو", requires_photo: true, sort_order: 2 },
  { role: "cleaning_staff", title: "مسح الأرضيات وتعقيم الطاولات", requires_photo: true, sort_order: 3 },
  { role: "kitchen_manager", title: "قياس حرارة الثلاجات", requires_photo: false, sort_order: 4 },
];

async function listDemoUsers() {
  const { users } = await auth("GET", "admin/users?per_page=200");
  return (users ?? []).filter((user) => (user.email ?? "").startsWith("demo."));
}

async function clean() {
  const users = await listDemoUsers();
  const ids = users.map((user) => user.id);
  if (!ids.length) {
    console.log("nothing to clean");
    return ids;
  }
  const list = `(${ids.join(",")})`;
  // Child rows first — reports reference profiles with `on delete restrict`.
  for (const table of ["cleaning_reports", "barista_reports", "kitchen_reports"]) {
    await rest("DELETE", `${table}?submitted_by=in.${list}`, undefined, null);
  }
  await rest("DELETE", `water_quality_checks?recorded_by=in.${list}`, undefined, null);
  await rest("DELETE", `daily_beverage_logs?employee_id=in.${list}`, undefined, null);
  await rest("DELETE", `daily_beverage_logs?recorded_by=in.${list}`, undefined, null);
  await rest("DELETE", `checklist_templates?created_by=in.${list}`, undefined, null);
  await rest("DELETE", `tasks?user_id=in.${list}`, undefined, null);
  await rest("DELETE", `attendance_records?user_id=in.${list}`, undefined, null);
  await rest("DELETE", `gamification?user_id=in.${list}`, undefined, null);
  await rest("DELETE", `staff_profiles?user_id=in.${list}`, undefined, null);
  for (const user of users) {
    await fetch(`${URL_BASE}/storage/v1/object/list/staff-evidence`, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({ prefix: `${user.id}/demo`, limit: 100 }),
    })
      .then((response) => response.json())
      .then((objects) =>
        Promise.all(
          (Array.isArray(objects) ? objects : []).map((object) =>
            fetch(`${URL_BASE}/storage/v1/object/staff-evidence/${user.id}/demo/${object.name}`, {
              method: "DELETE",
              headers: HEADERS,
            }),
          ),
        ),
      )
      .catch(() => {});
    await auth("DELETE", `admin/users/${user.id}`);
  }
  console.log(`✓ removed ${ids.length} demo accounts and their data`);
  return ids;
}

async function seedCrew(branch) {
  const existing = await listDemoUsers();
  const byEmail = new Map(existing.map((user) => [user.email, user.id]));
  const crew = [];

  for (const member of CREW) {
    const address = email(member.key);
    let userId = byEmail.get(address);
    if (!userId) {
      const created = await auth("POST", "admin/users", {
        email: address,
        password: DEMO_PASSWORD,
        email_confirm: true,
      });
      userId = created.id;
    }
    await rest(
      "POST",
      "staff_profiles",
      {
        user_id: userId,
        full_name: member.name,
        role: member.role,
        branch_id: branch.id,
        scheduled_start: member.start,
        is_active: true,
        nationality: member.nationality,
        preferred_language: member.lang,
      },
      "resolution=merge-duplicates",
    );
    crew.push({ ...member, userId, email: address });
  }
  console.log(`✓ ${crew.length} demo staff on ${branch.name}`);
  return crew;
}

async function seedHistory(branch, crew) {
  const supervisor = crew.find((member) => member.role === "supervisor");
  const attendees = crew.filter((member) => member.start);
  const today = isoDate(new Date(Date.now() + TZ_OFFSET_HOURS * 3600 * 1000));
  const days = Array.from({ length: DAYS }, (_, index) => {
    const date = new Date(`${today}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - (DAYS - 1 - index));
    return isoDate(date);
  });

  const attendance = [];
  const tasks = [];
  const reports = { cleaning_reports: [], barista_reports: [], kitchen_reports: [] };
  const water = [];
  const drinks = [];
  const points = new Map(crew.map((member) => [member.userId, { points: 0, streak: 0 }]));

  for (const day of days) {
    const isToday = day === today;
    for (const member of attendees) {
      // Today is staged by hand so the panel has a live, readable moment:
      // two people mid-shift, one finished, one still absent.
      const showsUp = isToday
        ? member.role !== "employee"
        : random() < member.reliability;
      if (!showsUp) continue;

      const [hour, minute] = member.start.split(":").map(Number);
      const onTime = isToday ? member.role !== "kitchen_manager" : random() < member.punctual;
      const delay = onTime ? Math.floor(random() * 12) : 22 + Math.floor(random() * 35);
      const startTime = atLocal(day, hour, minute + delay);
      const stillWorking = isToday && ["barista", "cleaning_staff", "supervisor"].includes(member.role);
      const endTime = stillWorking ? null : new Date(startTime.getTime() + 8 * 3600 * 1000);
      const done = 2 + Math.floor(random() * 3);
      const earned = (onTime ? 10 : 4) + done * 2;

      attendance.push({
        user_id: member.userId,
        branch_id: branch.id,
        shift_date: day,
        start_time: startTime.toISOString(),
        end_time: endTime ? endTime.toISOString() : null,
        start_location: {
          latitude: branch.latitude + (random() - 0.5) / 5000,
          longitude: branch.longitude + (random() - 0.5) / 5000,
          accuracy_meters: 8 + Math.round(random() * 12),
          distance_meters: Math.round(random() * 40),
        },
        end_location: endTime
          ? { latitude: branch.latitude, longitude: branch.longitude, accuracy_meters: 10, distance_meters: 12 }
          : null,
        break_duration_minutes: endTime ? 30 + Math.floor(random() * 25) : 0,
        status: endTime ? "completed" : "active",
        on_time: onTime,
        points_earned: endTime ? earned : 0,
        tasks_completed: endTime ? done : 0,
      });

      const bucket = points.get(member.userId);
      bucket.points += endTime ? earned : 0;
      bucket.streak = onTime ? bucket.streak + 1 : 0;

      const checklist = CHECKLIST.filter((item) => !item.role || item.role === member.role);
      checklist.forEach((item, index) => {
        // On the live day the last item is deliberately left open, so the
        // owner's "tasks today" bar is not a flat 100%.
        const complete = !isToday || index < checklist.length - 1;
        tasks.push({
          user_id: member.userId,
          task_date: day,
          task_type: "general_duty",
          title: item.title,
          is_required: true,
          requires_photo: false,
          completed: complete,
          completed_at: complete ? new Date(startTime.getTime() + 3600 * 1000).toISOString() : null,
          sort_order: item.sort_order,
        });
      });

      const table = REPORT_BY_ROLE[member.role];
      if (table && endTime) {
        // The two most recent days stay pending so the owner sees a real queue.
        const pending = days.indexOf(day) >= DAYS - 2;
        const reviewedAt = new Date(endTime.getTime() + 1800 * 1000).toISOString();
        const base = {
          branch_id: branch.id,
          report_date: day,
          revision: 1,
          submitted_by: member.userId,
          status: pending ? "pending" : "confirmed",
          reviewed_by: pending ? null : supervisor.userId,
          reviewed_at: pending ? null : reviewedAt,
          created_at: endTime.toISOString(),
        };
        const photo = `${member.userId}/demo/${table}-${day}.png`;
        if (table === "cleaning_reports") {
          reports[table].push({
            ...base,
            cleanliness_notes: pick([
              "تم تنظيف الصالة ودورات المياه وتعقيم الطاولات.",
              "نظافة كاملة للصالة، وتم تغيير أكياس النفايات.",
              "تنظيف الأرضيات والواجهة الزجاجية بالكامل.",
            ]),
            photo_paths: [photo],
          });
        } else if (table === "barista_reports") {
          reports[table].push({
            ...base,
            handover_notes: pick([
              "تم تسليم البار نظيفًا، ومخزون الحليب كافٍ ليوم غد.",
              "تنظيف الماكينة والمطحنة، ونقص في أكواب ١٢ أونصة.",
              "البار جاهز، وتمت معايرة الإسبريسو صباحًا.",
            ]),
            bar_clean_confirmed: true,
            photo_paths: [photo],
          });
        } else {
          reports[table].push({
            ...base,
            cleanliness_notes: "تم تنظيف المطبخ وفحص درجات حرارة الثلاجات.",
            photo_paths: [photo],
            inventory_counts: [
              { name: "حليب طازج", category: "product", count: 18 + Math.floor(random() * 10) },
              { name: "حبوب بن", category: "product", count: 6 + Math.floor(random() * 6) },
              { name: "تشيز كيك", category: "dessert", count: 4 + Math.floor(random() * 8) },
              { name: "كوكيز", category: "dessert", count: 10 + Math.floor(random() * 14) },
            ],
          });
        }
      }

      if (member.role !== "supervisor") {
        drinks.push({
          branch_id: branch.id,
          log_date: day,
          employee_id: member.userId,
          consumed: random() < 0.72,
          recorded_by: supervisor.userId,
        });
      }
    }

    water.push({
      branch_id: branch.id,
      check_date: day,
      salt_ratio: Number((0.32 + random() * 0.3).toFixed(2)),
      photo_path: `${supervisor.userId}/demo/water-${day}.png`,
      notes: random() < 0.25 ? "النسبة أعلى من المعتاد — أُعيد الفحص بعد ساعة." : null,
      recorded_by: supervisor.userId,
    });
  }

  const evidence = [
    ...Object.values(reports).flat().flatMap((report) => report.photo_paths ?? []),
    ...water.map((check) => check.photo_path),
  ];
  const palette = { cleaning_reports: [96, 150, 120], barista_reports: [150, 110, 80], kitchen_reports: [120, 120, 160] };
  for (const path of evidence) {
    const kind = Object.keys(palette).find((key) => path.includes(key));
    await uploadEvidence(path, palette[kind] ?? [90, 130, 170]);
  }

  await rest("POST", "attendance_records", attendance, "return=minimal");
  await rest("POST", "tasks", tasks, "return=minimal,resolution=merge-duplicates");
  let skipped = 0;
  for (const [table, rows] of Object.entries(reports)) {
    if (!rows.length) continue;
    try {
      await rest("POST", table, rows, "return=minimal");
    } catch (error) {
      // kitchen_reports is guarded by a check constraint that calls a private
      // helper; service_role only gained execute on it in the owner-overview
      // migration. Skip rather than abort if that migration is not applied yet.
      if (!String(error.message).includes("42501")) throw error;
      skipped += rows.length;
      console.warn(`! skipped ${rows.length} ${table} — apply the latest migration, then re-run`);
    }
  }
  await rest("POST", "water_quality_checks", water, "return=minimal");
  await rest("POST", "daily_beverage_logs", drinks, "return=minimal,resolution=merge-duplicates");
  await rest(
    "POST",
    "gamification",
    crew
      .filter((member) => member.start)
      .map((member) => ({
        user_id: member.userId,
        points: points.get(member.userId).points,
        streak_count: points.get(member.userId).streak,
        badges: points.get(member.userId).points > 180 ? ["punctual", "team_player"] : ["punctual"],
        last_completed_date: today,
      })),
    "return=minimal,resolution=merge-duplicates",
  );
  await rest(
    "POST",
    "checklist_templates",
    CHECKLIST.map((item) => ({ ...item, branch_id: branch.id, created_by: supervisor.userId })),
    "return=minimal",
  );

  console.log(
    `✓ ${attendance.length} shifts · ${tasks.length} tasks · ` +
      `${Object.values(reports).flat().length - skipped} reports · ${water.length} water checks · ` +
      `${drinks.length} drink logs · ${evidence.length} evidence photos`,
  );
}

// ── run ──────────────────────────────────────────────────────────────────────
const cleanOnly = process.argv.includes("--clean");
await clean();
if (cleanOnly) process.exit(0);

const [branch] = await rest("GET", `branches?name=eq.${encodeURIComponent(BRANCH_NAME)}&select=*`);
if (!branch) {
  console.error(`✗ branch "${BRANCH_NAME}" not found — create it first`);
  process.exit(1);
}
const crew = await seedCrew(branch);
await seedHistory(branch, crew);
console.log(`\n✓ demo data ready on ${branch.name}. Demo logins use password ${DEMO_PASSWORD}`);
