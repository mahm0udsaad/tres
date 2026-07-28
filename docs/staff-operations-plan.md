# Staff Operations Dashboard

## Codebase analysis

The repository is a Next.js 16 App Router application with React 19 and
Supabase/PostgreSQL. It contains:

- An Arabic public café website and menu.
- A PIN-protected owner control panel under `/admin`.
- Supabase tables for menu categories, items, feedback, and site settings.
- A public storage bucket used only for menu images.

Before this work, it did **not** contain staff identities, roles, branches,
attendance, duties, reporting, report review, inventory, water checks,
beverage logs, or gamification.

The original shared admin PIN remains the bootstrap owner login. Staff
authentication now uses Supabase Auth email/password sessions and is isolated
under `/staff`.

## Role access model

| Role | Attendance | Stage 1 access |
| --- | --- | --- |
| owner | No | Branch configuration; owner bootstrap console |
| manager | No | Assigned branch configuration |
| supervisor | Yes | Shift and assigned duties |
| employee | Yes | Shift and assigned duties |
| cleaning_staff | Yes | Shift plus cleaning requirements |
| barista | Yes | Shift plus barista requirements |
| kitchen_manager | Yes | Shift plus kitchen/inventory requirements |
| shift_manager | No | Read-only report area; no attendance data |

Authorization roles are stored in `public.staff_profiles`, not editable Auth
user metadata. All exposed staff tables have RLS enabled. Staff can read only
their own profile, tasks, attendance, and rewards.

## Incremental implementation plan

### Stage 1 — attendance and shift management

Implemented in the first increment:

1. Add Supabase Auth SSR sessions and protected `/staff` routes.
2. Add branches, staff profiles, attendance, tasks, and gamification schema.
3. Add the owner bootstrap screen under `/admin/operations` to:
   - create branches;
   - create Supabase Auth staff accounts with roles;
   - assign daily duties.
4. Add owner/manager branch location and radius configuration.
5. Validate shift start atomically in PostgreSQL using Haversine distance.
6. Reject roles excluded from attendance and reject inaccurate/out-of-range
   GPS readings.
7. Track one active shift, a 60-minute break entitlement, and actual break use.
8. Generate required daily checklist entries by role.
9. Block shift end while a break is active or required tasks are incomplete.
10. Award task-compliance/on-time points, badges, and daily streaks.
11. Show the completed-shift summary and reward animation.

Operational follow-up:

- Apply the Stage 1 migration to the target Supabase project.
- Configure the Supabase URL, publishable/anon key, service-role key, admin PIN,
  and admin session secret.
- Create a branch first, then create staff accounts.
- Replace temporary staff passwords with an invite/reset-password flow before
  broad rollout.

### Stage 2 — cleaning reports

Implemented:

1. `cleaning_reports` with versioned daily submissions and reviewer audit
   fields.
2. Required notes and at least one private proof photo.
3. Role-specific submission/status UI at `/staff/submissions`.
4. Atomic completion of the Stage 1 cleaning report/photo tasks.
5. Pending, confirmed, and rejected states with rejection notes and
   resubmission as a new immutable revision.

### Stage 3 — barista and kitchen reports

Implemented:

1. `barista_reports` with handover notes, optional photos, and required clean-bar
   confirmation.
2. `kitchen_reports` with required cleanliness evidence.
3. Validated structured product/dessert inventory counts.
4. Atomic completion of each role's Stage 1 requirements after a valid report.

### Stage 4 — supervisor verification

Implemented:

1. Unified branch-scoped review queue across cleaning, barista, and kitchen
   reports.
2. Supervisor-only confirmed/rejected-with-notes transitions.
3. Private evidence served through short-lived signed URLs.
4. Immutable review history and rejected-report revision workflow.
5. Shift-manager read-only report, water, and beverage view with no attendance
   queries, fields, policies, or actions.

### Additional modules

Implemented:

1. Water quality checks with salt ratio, timestamp, branch, notes, and private
   photo.
2. Kitchen condition reports and structured product/dessert inventory.
3. Daily beverage allocation state per employee.
4. Secure generated daily beverage report, including employees who have not
   recorded a state.

### Stage 5 — supervisor delegation and checklist templates

Implemented:

1. Supervisor-scoped staff provisioning at `/staff/team`: the service role
   creates only the bare auth user (isolated in `app/lib/staff-provisioning.ts`),
   while `register_branch_staff` runs under the supervisor's session so
   Postgres enforces the branch scope and the non-privileged role allowlist
   (employee, cleaning_staff, barista, kitchen_manager). Generated login
   email suggestion plus a one-time temporary password handover, and
   activate/deactivate for own-branch staff.
2. Reusable branch checklist templates at `/staff/checklist` (per-item target
   role, required flag, photo requirement, ordering). Active items seed as
   tasks at shift start. `complete_task(p_task_id, p_photo_path)` validates
   photo evidence in Postgres; a CHECK constraint makes photo-less completion
   of photo items impossible, and cited photos become immutable in storage.
3. Bilingual (Arabic · English) employee-facing operations messages — staff
   speak Arabic, Bengali, and English — driven by stable `code` values from
   the RPCs (`outside_branch` with live distance, `low_accuracy`,
   `incomplete_tasks` with typed missing items, break codes). Seeded task
   titles are bilingual; the missing-requirements card links to the daily
   forms. Supervisor/owner surfaces remain Arabic.

### Stage 6 — nationality, per-user language, GPS override

Implemented:

1. `nationality` and `preferred_language` (`ar`/`en`) on every staff profile,
   set by owner and supervisor at creation (nationality dropdown auto-suggests
   the dashboard language — Arabic for Saudi Arabia, English otherwise).
2. Owner creates staff for any branch/role at `/admin/operations`; supervisors
   stay branch- and role-scoped at `/staff/team` (both gained nationality +
   language fields).
3. Per-user i18n for the **employee dashboard** (`app/lib/staff-i18n.ts`,
   `t(key, lang)`): `/staff` renders in the member's language and flips
   direction (rtl/ar, ltr/en). Seeded role task titles are single-language.
   RPC failure `code`s map to localized text; the 100 m geofence rejection
   shows live distance vs. allowed radius. Admin/owner/supervisor/shift-manager
   surfaces stay Arabic.
4. Supervisor GPS-override fallback: from `/staff/team`, a supervisor manually
   clocks a same-branch employee in/out with a mandatory reason (≥10 chars),
   bypassing GPS but still enforcing task completion on end. Recorded on
   `attendance_records.supervisor_override_*` and badged on the employee's
   shift card. Shared shift logic refactored into `private.seed_shift_tasks`
   and `private.close_shift_impl` so the geofenced and override paths cannot
   diverge.
5. Branch geofence default set to 100 m.

Phase-1 boundary: the daily-report **forms** at `/staff/submissions`
(`SubmissionForms.tsx` field labels) remain Arabic; their action-level errors
and the layout direction are already language-aware. Full form-field
translation is a follow-up.

Future enhancement:

- Owner analytics for compliance trends, labor hours, and approval rates.
- Translate the submission report forms; add Bengali if two languages prove
  insufficient.

## Data and security notes

- Geofencing is enforced by an authenticated database function; the browser
  only supplies GPS coordinates.
- Attendance mutation implementations live in an unexposed `private` schema.
  Public RPC wrappers use caller identity and cannot accept another user ID.
- Managers, owners, and shift managers are rejected by attendance functions.
- The service-role key is used only by server-side owner bootstrap actions.
- Report photos use the private `staff-evidence` bucket and short-lived signed
  URLs. The public `menu` bucket is never used for staff evidence.

## Validation status

Passed in this checkout:

- TypeScript strict check.
- Next.js production build.
- Static RLS/RPC/storage and shift-manager isolation checks.
- Unauthenticated route and owner authentication-redirect smoke tests.

Requires a configured Supabase target or a running local Docker/Supabase stack:

- Applying both staff migrations.
- Database lint/advisor output.
- Authenticated multi-role end-to-end flows with real Storage uploads.
