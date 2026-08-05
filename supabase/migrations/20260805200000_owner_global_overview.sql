-- Owner = the company account, not a branch account.
--
-- Every read path so far is branch-scoped: a viewer only sees rows whose
-- branch_id equals their own `staff_profiles.branch_id`. That leaves the owner
-- blind, because the owner belongs to no single branch — they own all of them,
-- including branches created after their account. This migration adds one
-- helper, `private.is_global_owner()`, and threads it through the read paths so
-- an active `owner` profile sees every branch automatically.
--
-- Read-only by design: no write, review, or provisioning path is widened here.

-- ── 1. the global-owner test ────────────────────────────────────────────────
create or replace function private.is_global_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_profiles viewer
    where viewer.user_id = (select auth.uid())
      and viewer.is_active
      and viewer.role = 'owner'
  );
$$;

revoke all on function private.is_global_owner() from public, anon;
grant execute on function private.is_global_owner() to authenticated;

-- ── 2. core tables: owner sees every row ────────────────────────────────────
drop policy if exists branches_read_assigned on public.branches;
create policy branches_read_assigned
  on public.branches for select
  to authenticated
  using (
    (select private.is_global_owner())
    or id in (
      select p.branch_id
      from public.staff_profiles p
      where p.user_id = (select auth.uid())
    )
  );

drop policy if exists staff_profiles_read_global_owner on public.staff_profiles;
create policy staff_profiles_read_global_owner
  on public.staff_profiles for select
  to authenticated
  using ((select private.is_global_owner()));

drop policy if exists attendance_read_global_owner on public.attendance_records;
create policy attendance_read_global_owner
  on public.attendance_records for select
  to authenticated
  using ((select private.is_global_owner()));

drop policy if exists tasks_read_global_owner on public.tasks;
create policy tasks_read_global_owner
  on public.tasks for select
  to authenticated
  using ((select private.is_global_owner()));

drop policy if exists gamification_read_global_owner on public.gamification;
create policy gamification_read_global_owner
  on public.gamification for select
  to authenticated
  using ((select private.is_global_owner()));

-- ── 3. reports, logs and evidence ───────────────────────────────────────────
-- Same bodies as the reporting foundation, with the global-owner branch added.
-- `checklist_templates` reads go through can_read_branch_report() too.
create or replace function private.can_read_branch_report(
  p_branch_id uuid,
  p_submitted_by uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and (
      (select private.is_global_owner())
      or exists (
        select 1
        from public.staff_profiles viewer
        where viewer.user_id = (select auth.uid())
          and viewer.is_active
          and (
            viewer.user_id = p_submitted_by
            or (
              viewer.branch_id = p_branch_id
              and viewer.role in ('owner', 'manager', 'supervisor', 'shift_manager')
            )
          )
      )
    );
$$;

create or replace function private.can_read_branch_log(
  p_branch_id uuid,
  p_subject_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and (
      (select private.is_global_owner())
      or exists (
        select 1
        from public.staff_profiles viewer
        where viewer.user_id = (select auth.uid())
          and viewer.is_active
          and (
            viewer.user_id = p_subject_id
            or (
              viewer.branch_id = p_branch_id
              and viewer.role in ('owner', 'manager', 'supervisor', 'shift_manager')
            )
          )
      )
    );
$$;

-- Photo evidence: the owner may view any active staff member's objects. Upload
-- and mutation rules are untouched — can_mutate_staff_evidence() still requires
-- the caller to own the object path.
create or replace function private.can_read_staff_evidence(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and (
      split_part(p_object_name, '/', 1) = (select auth.uid())::text
      or (
        (select private.is_global_owner())
        and exists (
          select 1
          from public.staff_profiles uploader
          where uploader.user_id::text = split_part(p_object_name, '/', 1)
        )
      )
      or exists (
        select 1
        from public.staff_profiles viewer
        join public.staff_profiles uploader
          on uploader.user_id::text = split_part(p_object_name, '/', 1)
        where viewer.user_id = (select auth.uid())
          and viewer.is_active
          and uploader.is_active
          and viewer.role in ('owner', 'manager', 'supervisor', 'shift_manager')
          and viewer.branch_id = uploader.branch_id
      )
    );
$$;

-- ── 4. one-call company overview ────────────────────────────────────────────
-- The owner panel is meant to be readable by a non-technical owner, so every
-- number it shows is computed here instead of being stitched together from a
-- dozen client queries.
create or replace function private.get_owner_overview_impl(
  p_user_id uuid,
  p_days integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.staff_profiles;
  v_days integer := least(greatest(coalesce(p_days, 14), 1), 90);
  v_today date := (now() at time zone 'Asia/Riyadh')::date;
  v_from date;
  v_result jsonb;
begin
  v_profile := private.require_staff(p_user_id);
  if v_profile.role <> 'owner' then
    raise exception 'Only owners can read the company overview' using errcode = '42501';
  end if;
  v_from := v_today - (v_days - 1);

  with reports as (
    select 'cleaning'::text as report_type, r.id, r.branch_id, r.submitted_by,
           r.report_date, r.status::text as status, r.created_at
      from public.cleaning_reports r
    union all
    select 'barista', r.id, r.branch_id, r.submitted_by,
           r.report_date, r.status::text, r.created_at
      from public.barista_reports r
    union all
    select 'kitchen', r.id, r.branch_id, r.submitted_by,
           r.report_date, r.status::text, r.created_at
      from public.kitchen_reports r
  ),
  -- "Today" is branch-local: a branch in another timezone rolls over on its
  -- own clock, not on the owner's.
  branch_day as (
    select b.id, b.name, b.timezone, (now() at time zone b.timezone)::date as today
    from public.branches b
  ),
  staff as (
    select
      p.user_id,
      p.full_name,
      p.role::text as role,
      p.branch_id,
      p.is_active,
      p.scheduled_start,
      bd.name as branch_name,
      coalesce(bd.today, v_today) as branch_today
    from public.staff_profiles p
    left join branch_day bd on bd.id = p.branch_id
  ),
  today_attendance as (
    select a.*
    from public.attendance_records a
    join staff s on s.user_id = a.user_id
    where a.shift_date = s.branch_today
  ),
  window_attendance as (
    select a.*
    from public.attendance_records a
    where a.shift_date between v_from and v_today
  ),
  staff_window as (
    select
      a.user_id,
      count(*) as shifts,
      count(*) filter (where a.on_time) as on_time_shifts,
      coalesce(sum(a.points_earned), 0) as points_window,
      max(a.shift_date) as last_shift
    from window_attendance a
    group by a.user_id
  )
  select jsonb_build_object(
    'ok', true,
    'today', v_today::text,
    'days', v_days,
    'totals', jsonb_build_object(
      'branches', (select count(*) from public.branches),
      'staff', (select count(*) from staff where is_active),
      'inactive_staff', (select count(*) from staff where not is_active),
      'field_staff', (select count(*) from staff
                      where is_active and role not in ('owner', 'manager', 'shift_manager'))
    ),
    'today_stats', jsonb_build_object(
      'working_now', (select count(*) from today_attendance where status = 'active'),
      'finished', (select count(*) from today_attendance where status = 'completed'),
      'attended', (select count(*) from today_attendance),
      'on_time', (select count(*) from today_attendance where on_time),
      'late', (select count(*) from today_attendance where not on_time),
      'absent', greatest(
        (select count(*) from staff
         where is_active and branch_id is not null
           and role not in ('owner', 'manager', 'shift_manager'))
        - (select count(*) from today_attendance),
        0
      ),
      'tasks_done', (select coalesce(count(*) filter (where t.completed), 0)
                     from public.tasks t join staff s on s.user_id = t.user_id
                     where t.task_date = s.branch_today),
      'tasks_total', (select count(*)
                      from public.tasks t join staff s on s.user_id = t.user_id
                      where t.task_date = s.branch_today),
      'reports_today', (select count(*) from reports rp join branch_day bd on bd.id = rp.branch_id
                        where rp.report_date = bd.today),
      'reports_pending', (select count(*) from reports where status = 'pending'),
      'points_today', (select coalesce(sum(points_earned), 0) from today_attendance)
    ),
    'branches', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', bd.id,
        'name', bd.name,
        'timezone', bd.timezone,
        'today', bd.today::text,
        'staff', (select count(*) from staff s where s.branch_id = bd.id and s.is_active),
        'working_now', (select count(*) from today_attendance a
                        join staff s on s.user_id = a.user_id
                        where s.branch_id = bd.id and a.status = 'active'),
        'attended_today', (select count(*) from today_attendance a
                           join staff s on s.user_id = a.user_id
                           where s.branch_id = bd.id),
        'late_today', (select count(*) from today_attendance a
                       join staff s on s.user_id = a.user_id
                       where s.branch_id = bd.id and not a.on_time),
        'pending_reports', (select count(*) from reports rp
                            where rp.branch_id = bd.id and rp.status = 'pending'),
        'reports_today', (select count(*) from reports rp
                          where rp.branch_id = bd.id and rp.report_date = bd.today),
        'water_ratio_today', (select w.salt_ratio from public.water_quality_checks w
                              where w.branch_id = bd.id and w.check_date = bd.today
                              order by w.created_at desc limit 1),
        'drinks_taken_today', (select count(*) from public.daily_beverage_logs l
                               where l.branch_id = bd.id and l.log_date = bd.today and l.consumed)
      ) order by bd.name)
      from branch_day bd
    ), '[]'::jsonb),
    'trend', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', g.day::text,
        'attended', (select count(*) from window_attendance a where a.shift_date = g.day),
        'on_time', (select count(*) from window_attendance a
                    where a.shift_date = g.day and a.on_time),
        'hours', (select round(coalesce(sum(
                    extract(epoch from (coalesce(a.end_time, now()) - a.start_time)) / 3600.0
                  ), 0)::numeric, 1)
                  from window_attendance a where a.shift_date = g.day),
        'reports', (select count(*) from reports rp where rp.report_date = g.day)
      ) order by g.day)
      from (
        select generate_series(v_from, v_today, interval '1 day')::date as day
      ) g
    ), '[]'::jsonb),
    'staff', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', s.user_id,
        'name', s.full_name,
        'role', s.role,
        'branch_name', s.branch_name,
        'is_active', s.is_active,
        'uses_attendance', s.role not in ('owner', 'manager', 'shift_manager'),
        'scheduled_start', s.scheduled_start,
        'status_today', case
          when s.role in ('owner', 'manager', 'shift_manager') then 'admin'
          when exists (select 1 from today_attendance a
                       where a.user_id = s.user_id and a.status = 'active') then 'working'
          when exists (select 1 from today_attendance a
                       where a.user_id = s.user_id) then 'finished'
          else 'absent'
        end,
        'started_at', (select a.start_time from today_attendance a
                       where a.user_id = s.user_id order by a.start_time desc limit 1),
        'on_time_today', (select a.on_time from today_attendance a
                          where a.user_id = s.user_id order by a.start_time desc limit 1),
        'shifts', coalesce((select sw.shifts from staff_window sw where sw.user_id = s.user_id), 0),
        'on_time_shifts', coalesce((select sw.on_time_shifts from staff_window sw
                                    where sw.user_id = s.user_id), 0),
        'last_shift', (select sw.last_shift::text from staff_window sw where sw.user_id = s.user_id),
        'points', coalesce((select g.points from public.gamification g
                            where g.user_id = s.user_id), 0),
        'streak', coalesce((select g.streak_count from public.gamification g
                            where g.user_id = s.user_id), 0),
        'pending_reports', (select count(*) from reports rp
                            where rp.submitted_by = s.user_id and rp.status = 'pending')
      ) order by s.is_active desc, s.branch_name nulls last, s.full_name)
      from staff s
    ), '[]'::jsonb),
    'pending_reports', coalesce((
      select jsonb_agg(item order by item->>'report_date' desc)
      from (
        select jsonb_build_object(
          'id', rp.id,
          'type', rp.report_type,
          'report_date', rp.report_date::text,
          'created_at', rp.created_at,
          'branch_name', bd.name,
          'staff_name', coalesce(s.full_name, 'موظف')
        ) as item
        from reports rp
        left join branch_day bd on bd.id = rp.branch_id
        left join staff s on s.user_id = rp.submitted_by
        where rp.status = 'pending'
        order by rp.report_date desc, rp.created_at desc
        limit 25
      ) pending
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

create or replace function public.get_owner_overview(p_days integer default 14)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.get_owner_overview_impl((select auth.uid()), p_days);
$$;

revoke all on function private.get_owner_overview_impl(uuid, integer) from public, anon;
grant execute on function private.get_owner_overview_impl(uuid, integer) to authenticated;
revoke all on function public.get_owner_overview(integer) from public, anon;
grant execute on function public.get_owner_overview(integer) to authenticated;

-- ── 5. operator-script backfills ────────────────────────────────────────────
-- `kitchen_reports.inventory_counts` is validated by a check constraint that
-- calls a private helper, so any role writing that table directly must be able
-- to execute it. Operator scripts (scripts/seed-demo-ops.mjs) run as
-- service_role and would otherwise fail on insert. The helper is immutable and
-- touches no data; the security-definer impl functions in this schema still
-- refuse a caller with no auth.uid().
grant usage on schema private to service_role;
grant execute on function private.valid_inventory_counts(jsonb) to service_role;

comment on function private.is_global_owner() is
  'True when the caller is an active owner profile. Owners are company-wide and are not scoped to a single branch.';
comment on function public.get_owner_overview(integer) is
  'Whole-company snapshot for the owner panel: totals, today, per-branch, trend, staff and pending reports.';
