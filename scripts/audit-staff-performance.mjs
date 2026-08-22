import { createServerClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const managementToken = process.env.SUPABASE_PAT;
const projectRef = process.env.SUPABASE_REF ?? "xajdobfusjtikfymxiuo";
const phone = process.env.STAFF_AUDIT_PHONE;
const password = process.env.STAFF_AUDIT_PASSWORD;
const origin = process.env.STAFF_AUDIT_ORIGIN ?? "https://ops.tres.com.sa";
const iterations = Math.max(1, Math.min(20, Number(process.env.STAFF_AUDIT_ITERATIONS ?? 7)));

if (!supabaseUrl || !supabaseKey || !managementToken || !phone || !password) {
  console.error(
    "Missing Supabase configuration, SUPABASE_PAT, STAFF_AUDIT_PHONE, or STAFF_AUDIT_PASSWORD.",
  );
  process.exit(1);
}

const cookieJar = new Map();
const supabase = createServerClient(supabaseUrl, supabaseKey, {
  cookies: {
    getAll() {
      return [...cookieJar].map(([name, value]) => ({ name, value }));
    },
    setAll(cookies) {
      for (const { name, value } of cookies) cookieJar.set(name, value);
    },
  },
});

const { error: signInError } = await supabase.auth.signInWithPassword({
  phone,
  password,
});
if (signInError) {
  console.error(`Authentication failed: ${signInError.message}`);
  process.exit(1);
}

const cookieHeader = [...cookieJar]
  .map(([name, value]) => `${name}=${value}`)
  .join("; ");

const routes = [
  { path: "/staff/owner", marker: "لوحة المالك" },
  { path: "/staff/reports", marker: "مراجعة تقارير الفريق" },
  { path: "/staff/owner/attendance", marker: "سجل الحضور الشهري" },
  { path: "/staff/owner/team", marker: "أنشئ الحسابات" },
  { path: "/staff/checklist", marker: "مهام ثابتة ومتكررة" },
  { path: "/staff/owner/notes", marker: "سجل ملاحظات الموظفين" },
];

async function requestRoute(route) {
  const startedAt = performance.now();
  const response = await fetch(`${origin}${route.path}`, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      cookie: cookieHeader,
      "user-agent": "tres-authenticated-performance-audit/1.0",
    },
    redirect: "manual",
    cache: "no-store",
  });
  const headersAt = performance.now();
  const body = await response.text();
  const completedAt = performance.now();
  return {
    status: response.status,
    ttfbMs: Math.round(headersAt - startedAt),
    totalMs: Math.round(completedAt - startedAt),
    bytes: Buffer.byteLength(body),
    region: response.headers.get("x-vercel-id")?.split("::").slice(0, 2).join(" -> ") ?? null,
    markerFound: body.includes(route.marker),
    appErrorFound: body.includes("تعذّر تحميل"),
  };
}

const counterSql = `
select
  coalesce(sum(calls) filter (where query like 'SELECT users.aud%'), 0)::bigint as auth_user_reads,
  coalesce(sum(calls) filter (where query like 'SELECT sessions.aal%'), 0)::bigint as auth_session_reads,
  coalesce(sum(calls) filter (
    where query like 'WITH pgrst_source AS ( SELECT "public"."cleaning_reports".*%'
      and query not like '%"branch_id" = $1%'
  ), 0)::bigint as global_cleaning_reads,
  coalesce(sum(calls) filter (
    where query like 'WITH pgrst_source AS ( SELECT "public"."barista_reports".*%'
      and query not like '%"branch_id" = $1%'
  ), 0)::bigint as global_barista_reads,
  coalesce(sum(calls) filter (
    where query like 'WITH pgrst_source AS ( SELECT "public"."kitchen_reports".*%'
      and query not like '%"branch_id" = $1%'
  ), 0)::bigint as global_kitchen_reads,
  coalesce(sum(calls) filter (
    where query like 'WITH pgrst_source AS ( SELECT "public"."cleaning_reports".*%'
      and query like '%"branch_id" = $1%'
  ), 0)::bigint as branch_cleaning_reads,
  coalesce(sum(calls) filter (
    where query like 'WITH pgrst_source AS ( SELECT "public"."barista_reports".*%'
      and query like '%"branch_id" = $1%'
  ), 0)::bigint as branch_barista_reads,
  coalesce(sum(calls) filter (
    where query like 'WITH pgrst_source AS ( SELECT "public"."kitchen_reports".*%'
      and query like '%"branch_id" = $1%'
  ), 0)::bigint as branch_kitchen_reads
from pg_stat_statements;
`;

async function databaseCounters() {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${managementToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ query: counterSql }),
    },
  );
  if (!response.ok) throw new Error(`Counter query failed with HTTP ${response.status}`);
  const rows = await response.json();
  return rows[0];
}

function percentile(values, percentileValue) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * percentileValue) - 1)];
}

// Warm each deployed server-rendered route once. Warm-up results still validate
// status/content, but are kept separate from the timing distribution.
const warmup = {};
for (const route of routes) warmup[route.path] = await requestRoute(route);

const countersBefore = await databaseCounters();
const samples = Object.fromEntries(routes.map((route) => [route.path, []]));
for (let run = 0; run < iterations; run += 1) {
  for (const route of routes) samples[route.path].push(await requestRoute(route));
}
const countersAfter = await databaseCounters();

const summary = Object.fromEntries(
  routes.map((route) => {
    const routeSamples = samples[route.path];
    const ttfb = routeSamples.map((sample) => sample.ttfbMs);
    const total = routeSamples.map((sample) => sample.totalMs);
    return [
      route.path,
      {
        requests: routeSamples.length,
        statuses: [...new Set(routeSamples.map((sample) => sample.status))],
        contentValidated: routeSamples.every(
          (sample) => sample.markerFound && !sample.appErrorFound,
        ),
        ttfbMs: {
          min: Math.min(...ttfb),
          median: percentile(ttfb, 0.5),
          p95: percentile(ttfb, 0.95),
          max: Math.max(...ttfb),
        },
        totalMs: {
          min: Math.min(...total),
          median: percentile(total, 0.5),
          p95: percentile(total, 0.95),
          max: Math.max(...total),
        },
        responseBytes: routeSamples[0]?.bytes ?? 0,
        region: routeSamples[0]?.region ?? null,
      },
    ];
  }),
);

const counterDelta = Object.fromEntries(
  Object.keys(countersAfter).map((key) => [
    key,
    Number(countersAfter[key]) - Number(countersBefore[key]),
  ]),
);

console.log(
  JSON.stringify(
    {
      testedAt: new Date().toISOString(),
      origin,
      iterations,
      warmupValidated: Object.fromEntries(
        Object.entries(warmup).map(([path, result]) => [
          path,
          result.status === 200 && result.markerFound && !result.appErrorFound,
        ]),
      ),
      routes: summary,
      databaseCounterDelta: counterDelta,
    },
    null,
    2,
  ),
);
