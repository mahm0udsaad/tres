# TRES Operations Performance Verification

**Date:** 22 August 2026  
**Production:** `https://ops.tres.com.sa`  
**Deployed commit:** `e1a5c1b` (`remove staff auth and report waterfalls`)  
**Result:** The deployed fixes work correctly. Median performance is acceptable, but p95 latency still needs improvement.

## Scope and method

- Signed in with the production owner account and created a temporary authenticated session.
- Performed one warm-up request, then seven measured requests against each of six owner routes.
- Kept all requests read-only: no employees, tasks, reports, approvals, notes, or media were changed.
- Required HTTP 200, the expected Arabic page marker, and no application load-error message.
- Sampled `pg_stat_statements` immediately before and after the measured run.
- Rebuilt the production application and ran the staff security/RLS checks.
- Calculated route JavaScript and CSS transfer sizes from the production build manifests using gzip.

This is an authenticated server-response and database audit. It is not a browser Core Web Vitals field test, so LCP, CLS, and INP are outside this report.

## Production route results

All 42 measured authenticated requests returned HTTP 200 and valid page content.

| Route | Median TTFB | p95 TTFB | Median total | p95 total | HTML/RSC response |
|---|---:|---:|---:|---:|---:|
| Owner dashboard | 689 ms | 1,044 ms | 924 ms | 1,279 ms | 57.4 KB |
| Reports | 774 ms | 891 ms | 968 ms | 1,045 ms | 56.8 KB |
| Monthly attendance | 696 ms | 838 ms | 932 ms | 1,035 ms | 121.5 KB |
| Employees and accounts | 683 ms | 1,353 ms | 894 ms | 1,581 ms | 45.2 KB |
| Task management | 683 ms | 929 ms | 729 ms | 933 ms | 41.8 KB |
| Employee notes | 700 ms | 925 ms | 705 ms | 926 ms | 44.2 KB |

The request path observed during testing was `fra1 -> icn1`: Frankfurt ingress to the Seoul application region. Seoul is colocated with the Supabase project, which keeps database calls fast, but the long network path remains a material part of end-user latency.

## Fix verification

### 1. Auth hot-path optimization — PASS

Across the 42 measured page requests:

- Auth user reads added: **0**
- Auth session reads added: **0**
- Every authenticated page still returned the correct owner content.
- Staff RLS and security tests passed.

This confirms protected navigation now verifies the asymmetric JWT through `getClaims()` without reintroducing the old Auth-service `getUser()` call on every request. PostgREST still receives the authenticated JWT and applies RLS.

Supabase documents that `getClaims()` verifies asymmetric JWTs using cached JWKS and is faster than `getUser()`, which always calls the Auth service: <https://supabase.com/docs/reference/javascript/auth-getclaims>.

### 2. Owner report query fan-out — PASS

Seven measured `/staff/reports` loads produced:

- Global cleaning-report queries: **7**
- Global barista-report queries: **7**
- Global kitchen-report queries: **7**
- Branch-scoped cleaning queries: **0**
- Branch-scoped barista queries: **0**
- Branch-scoped kitchen queries: **0**

The result is exactly one query per report table per page load. Query volume no longer multiplies by the number of branches.

### 3. Reports and attendance waterfalls — PASS

- Completed-task review data starts loading concurrently with report data.
- Attendance rows and the owner overview start concurrently.
- Both pages returned correct production content throughout the test.

There was no pre-change authenticated timing capture, so this report does not invent a percentage improvement. The request sequencing and database counters confirm the waterfalls were removed.

### 4. Database execution — PASS

Representative production `pg_stat_statements` results:

| Operation | Mean database time |
|---|---:|
| Owner dashboard overview RPC | 11.26 ms |
| Owner employee table RPC | 14.19 ms |
| Global barista report query | 1.42 ms |
| Global cleaning report query | 0.03 ms |
| Global kitchen report query | 0.03 ms |
| Monthly attendance query | 0.56–0.75 ms |

Postgres execution is not the dominant cause of the remaining 0.7–1.5 second route times. Network round-trips, server orchestration, and occasional cold/outlier execution now dominate.

### 5. Client bundle budget — PASS

- Largest staff route JavaScript: **45.0 KB gzip** (`/staff`)
- Largest staff route CSS: **32.3 KB gzip** (`/staff/checklist`)
- Target budgets: JavaScript below 300 KB and CSS below 100 KB.

The current client bundles are comfortably inside budget and are not the primary performance problem.

### 6. Build and security regression — PASS

- Next.js production build: passed
- TypeScript: passed as part of the production build
- Staff schema/RLS/RPC/storage invariants: passed
- No service-role access in staff routes: passed
- Shift-manager report attendance isolation: passed

## Remaining performance bugs and risks

### P1 — p95 server latency remains above target

All six routes have p95 TTFB above the 800 ms target. The worst route is employees and accounts at 1,353 ms TTFB and 1,581 ms total. Median responses are much better, which indicates intermittent server/network outliers rather than consistently slow SQL.

Recommended next change: consolidate the owner team page's overview, employee metrics, open shifts, and schedules into one owner-team snapshot RPC. It currently performs several parallel Data API requests; parallel calls remove a waterfall but still incur multiple HTTP and PostgREST setup costs.

### P1 — reports still use several services per page

The branch multiplier is fixed, but a report load still combines three report-table calls, profiles, employee notes, task review data, branches, and signed Storage URLs. The SQL itself is fast; service round-trips account for most of the remaining 774 ms median TTFB.

Recommended next change: add a paginated report snapshot RPC for report/task/profile metadata, and generate signed photo URLs only for the visible page or when a report card is opened.

### P2 — monthly attendance response is too large

The attendance page returns approximately 121.5 KB of server-rendered data, more than twice the other tested owner pages. It loads a 31-day dashboard overview plus all staff attendance for the month, even when the owner selects one employee.

Recommended next change: create a dedicated attendance summary RPC and query only the selected employee when a filter is present. Avoid using the full dashboard overview as the employee directory for this page.

### P2 — history pages need pagination before data grows

The notes page permits up to 500 records, while report tables permit up to 100 records per report type. Current production data is small, but rendering and signing evidence for large histories will become progressively slower.

Recommended next change: server-side pagination with 25–50 records per page and explicit date/employee filters.

### P2 — no authenticated Core Web Vitals telemetry

This audit verifies server and database performance but cannot report real-user LCP, INP, or CLS. Add a privacy-conscious Web Vitals endpoint or Vercel Speed Insights for staff routes, tagged only by route and role category—not employee identity.

## Final assessment

The performance fixes in commit `e1a5c1b` are correctly deployed and verified. They removed the duplicate Auth reads, stopped report queries from scaling with branch count, and removed two request waterfalls without breaking authentication or RLS.

The next performance iteration should focus on reducing Data API/service round-trips for the owner team and reports pages, followed by attendance payload reduction and history pagination. Database indexes and client bundle reductions are not the highest-impact work at this point.
