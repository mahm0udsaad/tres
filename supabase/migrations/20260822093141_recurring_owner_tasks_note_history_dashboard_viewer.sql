-- Production operations hardening:
--   1. owner-created daily tasks persist without re-entering instructions;
--   2. the owner can change assignment/evidence requirements for future days;
--   3. employee notes have a dated, searchable owner-only history;
--   4. a manager account can open a read-only company dashboard without using
--      the owner's personal credentials;
--   5. the hot employee/task reads receive narrowly targeted indexes.

create table if not exists public.owner_task_assignments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.staff_profiles(user_id) on delete cascade,
  starts_on date not null,
  title text not null check (length(trim(title)) between 1 and 200),
  notes text check (notes is null or length(notes) <= 1000),
  is_required boolean not null default true,
  requires_photo boolean not null default false,
  requires_note boolean not null default false,
  response_type text not null default 'completion'
    check (response_type in ('completion', 'yes_no')),
  sort_order integer not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  created_by uuid not null references public.staff_profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint owner_task_assignments_yes_no_evidence check (
    response_type = 'completion' or (not requires_photo and not requires_note)
  )
);

create unique index if not exists owner_task_assignments_active_title_idx
  on public.owner_task_assignments(employee_id, lower(title))
  where is_active;
create index if not exists owner_task_assignments_seed_idx
  on public.owner_task_assignments(employee_id, starts_on, sort_order)
  where is_active;

drop trigger if exists owner_task_assignments_touch on public.owner_task_assignments;
create trigger owner_task_assignments_touch
before update on public.owner_task_assignments
for each row execute function public.touch_updated_at();

alter table public.owner_task_assignments enable row level security;
revoke all on public.owner_task_assignments from anon;
grant select on public.owner_task_assignments to authenticated;
drop policy if exists owner_task_assignments_read_owner on public.owner_task_assignments;
create policy owner_task_assignments_read_owner
  on public.owner_task_assignments for select
  to authenticated
  using ((select private.is_global_owner()));

alter table public.tasks
  add column if not exists recurring_assignment_id uuid
    references public.owner_task_assignments(id) on delete set null;

create unique index if not exists tasks_recurring_assignment_day_idx
  on public.tasks(recurring_assignment_id, task_date)
  where recurring_assignment_id is not null;
create index if not exists tasks_employee_due_open_idx
  on public.tasks(user_id, task_date, sort_order, created_at)
  where not completed;
create index if not exists employee_notes_author_created_idx
  on private.employee_notes(author_id, created_at desc);

-- Shift start now materialises only assignments explicitly created by the
-- owner. Role defaults remain disabled: a staff member with no assignments
-- still receives exactly zero tasks.
create or replace function private.seed_shift_tasks(
  p_user_id uuid,
  p_role public.staff_role,
  p_branch_id uuid,
  p_shift_date date,
  p_lang text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_role in ('owner', 'manager', 'shift_manager') then
    return;
  end if;

  insert into public.tasks (
    user_id, task_date, task_type, title, notes, is_required,
    requires_photo, requires_note, response_type, sort_order,
    recurring_assignment_id
  )
  select
    assignment.employee_id,
    p_shift_date,
    'general_duty',
    assignment.title,
    assignment.notes,
    assignment.is_required,
    assignment.requires_photo,
    assignment.requires_note,
    assignment.response_type,
    assignment.sort_order,
    assignment.id
  from public.owner_task_assignments assignment
  where assignment.employee_id = p_user_id
    and assignment.is_active
    and assignment.starts_on <= p_shift_date
  on conflict do nothing;
end;
$$;

create or replace function private.owner_create_scheduled_tasks_impl(
  p_user_id uuid,
  p_employee_ids uuid[],
  p_task_date date,
  p_title text,
  p_notes text,
  p_is_required boolean,
  p_requires_photo boolean,
  p_requires_note boolean,
  p_response_type text,
  p_repeat_daily boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner public.staff_profiles;
  v_employee_id uuid;
  v_assignment_id uuid;
  v_title text := nullif(trim(p_title), '');
  v_notes text := nullif(trim(p_notes), '');
  v_response text := coalesce(nullif(trim(p_response_type), ''), 'completion');
  v_result jsonb;
  v_assigned integer := 0;
  v_duplicates integer := 0;
begin
  v_owner := private.require_staff(p_user_id);
  if v_owner.role <> 'owner' then
    raise exception 'Only owners can assign tasks' using errcode = '42501';
  end if;
  if p_task_date is null or v_title is null or length(v_title) > 200
    or length(coalesce(v_notes, '')) > 1000
    or v_response not in ('completion', 'yes_no')
    or p_employee_ids is null or cardinality(p_employee_ids) not between 1 and 100
  then
    return jsonb_build_object('ok', false, 'code', 'assignment_invalid');
  end if;
  if (select count(*) from public.staff_profiles
      where user_id = any(p_employee_ids) and is_active
        and role not in ('owner', 'manager', 'shift_manager')) <> cardinality(p_employee_ids)
  then
    return jsonb_build_object('ok', false, 'code', 'employee_invalid');
  end if;

  foreach v_employee_id in array p_employee_ids loop
    if coalesce(p_repeat_daily, false) then
      begin
        insert into public.owner_task_assignments (
          employee_id, starts_on, title, notes, is_required, requires_photo,
          requires_note, response_type, sort_order, created_by
        ) values (
          v_employee_id, p_task_date, v_title, v_notes,
          coalesce(p_is_required, true),
          case when v_response = 'yes_no' then false else coalesce(p_requires_photo, false) end,
          case when v_response = 'yes_no' then false else coalesce(p_requires_note, false) end,
          v_response, 0, p_user_id
        ) returning id into v_assignment_id;

        insert into public.tasks (
          user_id, task_date, task_type, title, notes, is_required,
          requires_photo, requires_note, response_type, sort_order,
          recurring_assignment_id
        ) values (
          v_employee_id, p_task_date, 'general_duty', v_title, v_notes,
          coalesce(p_is_required, true),
          case when v_response = 'yes_no' then false else coalesce(p_requires_photo, false) end,
          case when v_response = 'yes_no' then false else coalesce(p_requires_note, false) end,
          v_response, 0, v_assignment_id
        ) on conflict do nothing;
        v_assigned := v_assigned + 1;
      exception when unique_violation then
        v_duplicates := v_duplicates + 1;
      end;
    else
      v_result := private.owner_assign_task_impl(
        p_user_id, v_employee_id, p_task_date, v_title,
        p_is_required, p_requires_photo, 0, v_notes,
        p_requires_note, v_response
      );
      if (v_result->>'ok')::boolean then
        v_assigned := v_assigned + 1;
      elsif v_result->>'code' = 'duplicate_task' then
        v_duplicates := v_duplicates + 1;
      else
        return v_result;
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'assigned', v_assigned,
    'duplicates', v_duplicates,
    'repeat_daily', coalesce(p_repeat_daily, false)
  );
end;
$$;

create or replace function public.owner_create_scheduled_tasks(
  p_employee_ids uuid[],
  p_task_date date,
  p_title text,
  p_notes text default null,
  p_is_required boolean default true,
  p_requires_photo boolean default false,
  p_requires_note boolean default false,
  p_response_type text default 'completion',
  p_repeat_daily boolean default false
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.owner_create_scheduled_tasks_impl(
    (select auth.uid()), p_employee_ids, p_task_date, p_title, p_notes,
    p_is_required, p_requires_photo, p_requires_note, p_response_type,
    p_repeat_daily
  );
$$;

create or replace function private.owner_update_scheduled_task_impl(
  p_user_id uuid,
  p_task_id uuid,
  p_employee_id uuid,
  p_task_date date,
  p_title text,
  p_notes text,
  p_is_required boolean,
  p_requires_photo boolean,
  p_requires_note boolean,
  p_response_type text,
  p_sort_order integer,
  p_repeat_daily boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner public.staff_profiles;
  v_task public.tasks;
  v_assignment_id uuid;
  v_title text := nullif(trim(p_title), '');
  v_notes text := nullif(trim(p_notes), '');
  v_response text := coalesce(nullif(trim(p_response_type), ''), 'completion');
  v_photo boolean;
  v_note boolean;
begin
  v_owner := private.require_staff(p_user_id);
  if v_owner.role <> 'owner' then
    raise exception 'Only owners can update assigned tasks' using errcode = '42501';
  end if;
  select * into v_task from public.tasks
  where id = p_task_id and task_type = 'general_duty' and not completed
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'task_not_editable');
  end if;
  if not exists (
    select 1 from public.staff_profiles
    where user_id = p_employee_id and is_active
      and role not in ('owner', 'manager', 'shift_manager')
  ) then
    return jsonb_build_object('ok', false, 'code', 'employee_invalid');
  end if;
  if p_task_date is null or v_title is null or length(v_title) > 200
    or length(coalesce(v_notes, '')) > 1000
    or v_response not in ('completion', 'yes_no')
  then
    return jsonb_build_object('ok', false, 'code', 'task_invalid');
  end if;

  v_photo := case when v_response = 'yes_no' then false else coalesce(p_requires_photo, false) end;
  v_note := case when v_response = 'yes_no' then false else coalesce(p_requires_note, false) end;
  v_assignment_id := v_task.recurring_assignment_id;

  if coalesce(p_repeat_daily, false) then
    if v_assignment_id is null then
      insert into public.owner_task_assignments (
        employee_id, starts_on, title, notes, is_required, requires_photo,
        requires_note, response_type, sort_order, created_by
      ) values (
        p_employee_id, p_task_date, v_title, v_notes,
        coalesce(p_is_required, true), v_photo, v_note, v_response,
        greatest(coalesce(p_sort_order, 0), 0), p_user_id
      ) returning id into v_assignment_id;
    else
      update public.owner_task_assignments
      set employee_id = p_employee_id,
          starts_on = p_task_date,
          title = v_title,
          notes = v_notes,
          is_required = coalesce(p_is_required, true),
          requires_photo = v_photo,
          requires_note = v_note,
          response_type = v_response,
          sort_order = greatest(coalesce(p_sort_order, 0), 0),
          is_active = true
      where id = v_assignment_id;

      -- Keep every not-yet-finished occurrence in sync. Completed rows remain
      -- immutable history with the exact wording/evidence rules used that day.
      update public.tasks
      set user_id = p_employee_id,
          title = v_title,
          notes = v_notes,
          is_required = coalesce(p_is_required, true),
          requires_photo = v_photo,
          requires_note = v_note,
          response_type = v_response,
          yes_no_answer = null,
          sort_order = greatest(coalesce(p_sort_order, 0), 0)
      where recurring_assignment_id = v_assignment_id and not completed;
    end if;
  elsif v_assignment_id is not null then
    update public.owner_task_assignments set is_active = false
    where id = v_assignment_id;
    delete from public.tasks
    where recurring_assignment_id = v_assignment_id
      and not completed and id <> p_task_id;
    v_assignment_id := null;
  end if;

  update public.tasks
  set user_id = p_employee_id,
      task_date = p_task_date,
      title = v_title,
      notes = v_notes,
      is_required = coalesce(p_is_required, true),
      requires_photo = v_photo,
      requires_note = v_note,
      response_type = v_response,
      yes_no_answer = null,
      sort_order = greatest(coalesce(p_sort_order, 0), 0),
      recurring_assignment_id = v_assignment_id
  where id = p_task_id;

  return jsonb_build_object(
    'ok', true,
    'task_id', p_task_id,
    'employee_id', p_employee_id,
    'repeat_daily', coalesce(p_repeat_daily, false)
  );
exception when unique_violation then
  return jsonb_build_object('ok', false, 'code', 'duplicate_task');
end;
$$;

create or replace function public.owner_update_scheduled_task(
  p_task_id uuid,
  p_employee_id uuid,
  p_task_date date,
  p_title text,
  p_notes text default null,
  p_is_required boolean default true,
  p_requires_photo boolean default false,
  p_requires_note boolean default false,
  p_response_type text default 'completion',
  p_sort_order integer default 0,
  p_repeat_daily boolean default false
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.owner_update_scheduled_task_impl(
    (select auth.uid()), p_task_id, p_employee_id, p_task_date, p_title,
    p_notes, p_is_required, p_requires_photo, p_requires_note,
    p_response_type, p_sort_order, p_repeat_daily
  );
$$;

-- Deleting an occurrence of a daily task stops the assignment and removes its
-- unfinished occurrences. Completed history is deliberately retained.
create or replace function private.owner_delete_assigned_task_impl(
  p_user_id uuid,
  p_task_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner public.staff_profiles;
  v_assignment_id uuid;
  v_deleted integer := 0;
begin
  v_owner := private.require_staff(p_user_id);
  if v_owner.role <> 'owner' then
    raise exception 'Only owners can delete assigned tasks' using errcode = '42501';
  end if;
  select recurring_assignment_id into v_assignment_id
  from public.tasks
  where id = p_task_id and task_type = 'general_duty' and not completed
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'task_not_editable');
  end if;
  if v_assignment_id is not null then
    update public.owner_task_assignments set is_active = false
    where id = v_assignment_id;
    delete from public.tasks
    where recurring_assignment_id = v_assignment_id and not completed;
  else
    delete from public.tasks where id = p_task_id and not completed;
  end if;
  get diagnostics v_deleted = row_count;
  return jsonb_build_object(
    'ok', true,
    'task_id', p_task_id,
    'stopped_daily', v_assignment_id is not null,
    'deleted', v_deleted
  );
end;
$$;

-- Dated employee-note history. It deliberately returns the employee's free
-- text only to the owner; dashboard viewers never receive it.
create or replace function private.get_owner_note_history_impl(
  p_user_id uuid,
  p_employee_id uuid,
  p_limit integer,
  p_offset integer
)
returns table (
  entity_type text,
  entity_id uuid,
  employee_id uuid,
  employee_name text,
  title text,
  record_date date,
  note text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.staff_profiles;
begin
  v_profile := private.require_staff(p_user_id);
  if v_profile.role <> 'owner' then
    raise exception 'Only owners can read employee notes' using errcode = '42501';
  end if;

  return query
  select
    employee_note.entity_type,
    employee_note.entity_id,
    employee_note.author_id,
    coalesce(staff.full_name, 'موظف سابق'),
    coalesce(
      task.title,
      case employee_note.entity_type
        when 'cleaning_report' then 'تقرير النظافة'
        when 'barista_report' then 'تقرير الباريستا'
        when 'kitchen_report' then 'تقرير المطبخ'
        when 'water_check' then 'فحص المياه'
        else 'ملاحظة'
      end
    ),
    coalesce(
      task.task_date,
      cleaning.report_date,
      barista.report_date,
      kitchen.report_date,
      water.check_date,
      (employee_note.created_at at time zone 'Asia/Riyadh')::date
    ),
    employee_note.note,
    employee_note.created_at
  from private.employee_notes employee_note
  left join public.staff_profiles staff on staff.user_id = employee_note.author_id
  left join public.tasks task
    on employee_note.entity_type = 'task' and task.id = employee_note.entity_id
  left join public.cleaning_reports cleaning
    on employee_note.entity_type = 'cleaning_report' and cleaning.id = employee_note.entity_id
  left join public.barista_reports barista
    on employee_note.entity_type = 'barista_report' and barista.id = employee_note.entity_id
  left join public.kitchen_reports kitchen
    on employee_note.entity_type = 'kitchen_report' and kitchen.id = employee_note.entity_id
  left join public.water_quality_checks water
    on employee_note.entity_type = 'water_check' and water.id = employee_note.entity_id
  where p_employee_id is null or employee_note.author_id = p_employee_id
  order by employee_note.created_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 500)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

create or replace function public.get_owner_note_history(
  p_employee_id uuid default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns table (
  entity_type text,
  entity_id uuid,
  employee_id uuid,
  employee_name text,
  title text,
  record_date date,
  note text,
  created_at timestamptz
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.get_owner_note_history_impl(
    (select auth.uid()), p_employee_id, p_limit, p_offset
  );
$$;

-- A manager is a dashboard-only login created by the owner. It has no
-- attendance and no mutation privileges. The dashboard snapshot is returned
-- through a security-definer RPC so normal table RLS remains branch-scoped.
create or replace function private.get_dashboard_overview_impl(
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
  if v_profile.role not in ('owner', 'manager') then
    raise exception 'Only owners and dashboard managers can read the overview'
      using errcode = '42501';
  end if;
  v_from := v_today - (v_days - 1);

  with branch_day as (
    select b.id, b.name, b.timezone,
           (now() at time zone b.timezone)::date as today
    from public.branches b
  ),
  staff as (
    select p.user_id, p.full_name, p.role::text as role, p.branch_id,
           p.is_active, p.scheduled_start, p.scheduled_end,
           p.nationality, p.preferred_language,
           branch.name as branch_name,
           coalesce(branch.today, v_today) as branch_today
    from public.staff_profiles p
    left join branch_day branch on branch.id = p.branch_id
  ),
  today_attendance as (
    select attendance.*
    from public.attendance_records attendance
    join staff on staff.user_id = attendance.user_id
    where attendance.shift_date = staff.branch_today
  ),
  staff_window as (
    select attendance.user_id,
           count(*) as shifts,
           count(*) filter (where attendance.on_time) as on_time_shifts,
           max(attendance.shift_date) as last_shift
    from public.attendance_records attendance
    where attendance.shift_date between v_from and v_today
    group by attendance.user_id
  ),
  reports as (
    select branch_id, submitted_by, report_date, status::text as status
    from public.cleaning_reports
    union all
    select branch_id, submitted_by, report_date, status::text from public.barista_reports
    union all
    select branch_id, submitted_by, report_date, status::text from public.kitchen_reports
  )
  select jsonb_build_object(
    'ok', true,
    'today', v_today::text,
    'days', v_days,
    'totals', jsonb_build_object(
      'branches', (select count(*) from branch_day),
      'staff', (select count(*) from staff where is_active),
      'inactive_staff', (select count(*) from staff where not is_active),
      'field_staff', (select count(*) from staff where is_active
        and role not in ('owner', 'manager', 'shift_manager'))
    ),
    'today_stats', jsonb_build_object(
      'working_now', (select count(*) from today_attendance where status = 'active'),
      'finished', (select count(*) from today_attendance where status = 'completed'),
      'attended', (select count(*) from today_attendance),
      'on_time', (select count(*) from today_attendance where on_time),
      'late', (select count(*) from today_attendance where not on_time),
      'absent', greatest(
        (select count(*) from staff where is_active and branch_id is not null
          and role not in ('owner', 'manager', 'shift_manager'))
        - (select count(*) from today_attendance), 0
      ),
      'tasks_done', (select count(*) from public.tasks task join staff
        on staff.user_id = task.user_id
        where task.task_date = staff.branch_today and task.completed),
      'tasks_total', (select count(*) from public.tasks task join staff
        on staff.user_id = task.user_id where task.task_date = staff.branch_today),
      'reports_today', (select count(*) from reports report join branch_day branch
        on branch.id = report.branch_id where report.report_date = branch.today),
      'reports_pending', (select count(*) from reports where status = 'pending'),
      'points_today', (select coalesce(sum(points_earned), 0) from today_attendance)
    ),
    'branches', coalesce((select jsonb_agg(jsonb_build_object(
      'id', branch.id,
      'name', branch.name,
      'timezone', branch.timezone,
      'today', branch.today::text,
      'staff', (select count(*) from staff where branch_id = branch.id and is_active),
      'working_now', (select count(*) from today_attendance attendance join staff
        on staff.user_id = attendance.user_id
        where staff.branch_id = branch.id and attendance.status = 'active'),
      'attended_today', (select count(*) from today_attendance attendance join staff
        on staff.user_id = attendance.user_id where staff.branch_id = branch.id),
      'late_today', (select count(*) from today_attendance attendance join staff
        on staff.user_id = attendance.user_id
        where staff.branch_id = branch.id and not attendance.on_time),
      'pending_reports', (select count(*) from reports report
        where report.branch_id = branch.id and report.status = 'pending'),
      'reports_today', (select count(*) from reports report
        where report.branch_id = branch.id and report.report_date = branch.today),
      'water_ratio_today', (select water.salt_ratio from public.water_quality_checks water
        where water.branch_id = branch.id and water.check_date = branch.today
        order by water.created_at desc limit 1),
      'drinks_taken_today', (select count(*) from public.daily_beverage_logs beverage
        where beverage.branch_id = branch.id and beverage.log_date = branch.today
          and beverage.consumed)
    ) order by branch.name) from branch_day branch), '[]'::jsonb),
    'trend', '[]'::jsonb,
    'staff', coalesce((select jsonb_agg(jsonb_build_object(
      'user_id', staff.user_id,
      'name', staff.full_name,
      'role', staff.role,
      'branch_id', staff.branch_id,
      'branch_name', staff.branch_name,
      'is_active', staff.is_active,
      'uses_attendance', staff.role not in ('owner', 'manager', 'shift_manager'),
      'scheduled_start', staff.scheduled_start,
      'scheduled_end', staff.scheduled_end,
      'nationality', staff.nationality,
      'preferred_language', staff.preferred_language,
      'status_today', case
        when staff.role in ('owner', 'manager', 'shift_manager') then 'admin'
        when exists (select 1 from today_attendance attendance
          where attendance.user_id = staff.user_id and attendance.status = 'active') then 'working'
        when exists (select 1 from today_attendance attendance
          where attendance.user_id = staff.user_id) then 'finished'
        else 'absent'
      end,
      'started_at', (select attendance.start_time from today_attendance attendance
        where attendance.user_id = staff.user_id order by attendance.start_time desc limit 1),
      'on_time_today', (select attendance.on_time from today_attendance attendance
        where attendance.user_id = staff.user_id order by attendance.start_time desc limit 1),
      'shifts', coalesce(stats.shifts, 0),
      'on_time_shifts', coalesce(stats.on_time_shifts, 0),
      'last_shift', stats.last_shift::text,
      'points', coalesce(game.points, 0),
      'streak', coalesce(game.streak_count, 0),
      'pending_reports', (select count(*) from reports report
        where report.submitted_by = staff.user_id and report.status = 'pending')
    ) order by staff.is_active desc, staff.branch_name nulls last, staff.full_name)
    from staff
    left join staff_window stats on stats.user_id = staff.user_id
    left join public.gamification game on game.user_id = staff.user_id), '[]'::jsonb),
    'pending_reports', '[]'::jsonb
  ) into v_result;

  return v_result;
end;
$$;

create or replace function public.get_dashboard_overview(p_days integer default 14)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.get_dashboard_overview_impl((select auth.uid()), p_days);
$$;

-- Allow the owner to create/update/delete a dashboard-only manager account.
-- Existing field roles keep the same rules and managers still cannot mutate
-- owner data because every write RPC checks role = owner.
create or replace function private.register_owner_staff_impl(
  p_user_id uuid,
  p_new_user_id uuid,
  p_full_name text,
  p_role public.staff_role,
  p_branch_id uuid,
  p_scheduled_start time,
  p_nationality text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.staff_profiles;
  v_name text;
  v_nationality text;
  v_lang text;
begin
  v_profile := private.require_staff(p_user_id);
  if v_profile.role <> 'owner' then
    raise exception 'Only owners can register staff accounts' using errcode = '42501';
  end if;
  if p_branch_id is null or not exists (select 1 from public.branches where id = p_branch_id) then
    return jsonb_build_object('ok', false, 'code', 'branch_invalid');
  end if;
  if p_role not in ('manager', 'supervisor', 'employee', 'cleaning_staff', 'barista', 'kitchen_manager') then
    return jsonb_build_object('ok', false, 'code', 'role_not_allowed');
  end if;
  v_name := nullif(trim(p_full_name), '');
  if v_name is null or length(v_name) > 120 then
    return jsonb_build_object('ok', false, 'code', 'name_invalid');
  end if;
  v_nationality := coalesce(nullif(trim(p_nationality), ''), 'Other');
  if v_nationality not in (
    'Kenya','Bangladesh','India','Pakistan','Philippines','Egypt','Sudan','Ethiopia',
    'Nepal','Sri Lanka','Yemen','Jordan','Indonesia','Uganda','Tanzania','Saudi Arabia','Other'
  ) then
    return jsonb_build_object('ok', false, 'code', 'nationality_invalid');
  end if;
  v_lang := case
    when v_nationality in ('Saudi Arabia', 'Egypt', 'Yemen', 'Sudan', 'Jordan') then 'ar'
    when v_nationality = 'Bangladesh' then 'bn'
    else 'en'
  end;
  if p_new_user_id is null or not exists (select 1 from auth.users where id = p_new_user_id) then
    return jsonb_build_object('ok', false, 'code', 'auth_user_missing');
  end if;
  if exists (select 1 from public.staff_profiles where user_id = p_new_user_id) then
    return jsonb_build_object('ok', false, 'code', 'profile_exists');
  end if;
  insert into public.staff_profiles (
    user_id, full_name, role, branch_id, scheduled_start, nationality, preferred_language
  ) values (
    p_new_user_id, v_name, p_role, p_branch_id,
    case when p_role = 'manager' then null else p_scheduled_start end,
    v_nationality, v_lang
  );
  return jsonb_build_object('ok', true, 'user_id', p_new_user_id, 'role', p_role);
end;
$$;

revoke all on function private.owner_create_scheduled_tasks_impl(uuid,uuid[],date,text,text,boolean,boolean,boolean,text,boolean) from public, anon;
grant execute on function private.owner_create_scheduled_tasks_impl(uuid,uuid[],date,text,text,boolean,boolean,boolean,text,boolean) to authenticated;
revoke all on function public.owner_create_scheduled_tasks(uuid[],date,text,text,boolean,boolean,boolean,text,boolean) from public, anon;
grant execute on function public.owner_create_scheduled_tasks(uuid[],date,text,text,boolean,boolean,boolean,text,boolean) to authenticated;
revoke all on function private.owner_update_scheduled_task_impl(uuid,uuid,uuid,date,text,text,boolean,boolean,boolean,text,integer,boolean) from public, anon;
grant execute on function private.owner_update_scheduled_task_impl(uuid,uuid,uuid,date,text,text,boolean,boolean,boolean,text,integer,boolean) to authenticated;
revoke all on function public.owner_update_scheduled_task(uuid,uuid,date,text,text,boolean,boolean,boolean,text,integer,boolean) from public, anon;
grant execute on function public.owner_update_scheduled_task(uuid,uuid,date,text,text,boolean,boolean,boolean,text,integer,boolean) to authenticated;
revoke all on function private.get_owner_note_history_impl(uuid,uuid,integer,integer) from public, anon;
grant execute on function private.get_owner_note_history_impl(uuid,uuid,integer,integer) to authenticated;
revoke all on function public.get_owner_note_history(uuid,integer,integer) from public, anon;
grant execute on function public.get_owner_note_history(uuid,integer,integer) to authenticated;
revoke all on function private.get_dashboard_overview_impl(uuid,integer) from public, anon;
grant execute on function private.get_dashboard_overview_impl(uuid,integer) to authenticated;
revoke all on function public.get_dashboard_overview(integer) from public, anon;
grant execute on function public.get_dashboard_overview(integer) to authenticated;

comment on table public.owner_task_assignments is
  'Only explicit owner-created daily task assignments; shift start materialises one task per active assignment.';
comment on function public.get_owner_note_history(uuid,integer,integer) is
  'Owner-only dated employee free-text history, optionally filtered by employee.';
comment on function public.get_dashboard_overview(integer) is
  'Read-only company snapshot for owner and manager dashboard accounts.';

create or replace function private.owner_update_staff_impl(
  p_user_id uuid,
  p_employee_id uuid,
  p_full_name text,
  p_role public.staff_role,
  p_branch_id uuid,
  p_nationality text,
  p_scheduled_start time,
  p_scheduled_end time
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner public.staff_profiles;
  v_employee public.staff_profiles;
  v_name text := trim(coalesce(p_full_name, ''));
  v_language text;
begin
  v_owner := private.require_staff(p_user_id);
  if v_owner.role <> 'owner' then
    raise exception 'Only owners can edit staff' using errcode = '42501';
  end if;
  if p_employee_id = p_user_id then
    return jsonb_build_object('ok', false, 'code', 'cannot_target_self');
  end if;
  if length(v_name) not between 1 and 120 then
    return jsonb_build_object('ok', false, 'code', 'name_invalid');
  end if;
  if p_role not in ('manager', 'supervisor', 'employee', 'cleaning_staff', 'barista', 'kitchen_manager') then
    return jsonb_build_object('ok', false, 'code', 'target_not_allowed');
  end if;
  if not exists (select 1 from public.branches where id = p_branch_id) then
    return jsonb_build_object('ok', false, 'code', 'branch_invalid');
  end if;
  if p_nationality not in (
    'Kenya','Bangladesh','India','Pakistan','Philippines','Egypt','Sudan','Ethiopia',
    'Nepal','Sri Lanka','Yemen','Jordan','Indonesia','Uganda','Tanzania','Saudi Arabia','Other'
  ) then
    return jsonb_build_object('ok', false, 'code', 'nationality_invalid');
  end if;
  if p_role <> 'manager' and (
    p_scheduled_start is null or p_scheduled_end is null
    or p_scheduled_start = p_scheduled_end
  ) then
    return jsonb_build_object('ok', false, 'code', 'schedule_invalid');
  end if;
  if exists (
    select 1 from public.attendance_records
    where user_id = p_employee_id and status = 'active'
  ) then
    return jsonb_build_object('ok', false, 'code', 'active_shift_exists');
  end if;

  v_language := case
    when p_nationality in ('Saudi Arabia', 'Egypt', 'Yemen', 'Sudan', 'Jordan') then 'ar'
    when p_nationality = 'Bangladesh' then 'bn'
    else 'en'
  end;

  update public.staff_profiles
  set full_name = v_name,
      role = p_role,
      branch_id = p_branch_id,
      nationality = p_nationality,
      preferred_language = v_language,
      scheduled_start = case when p_role = 'manager' then null else p_scheduled_start end,
      scheduled_end = case when p_role = 'manager' then null else p_scheduled_end end
  where user_id = p_employee_id
    and is_active
    and role in ('manager', 'supervisor', 'employee', 'cleaning_staff', 'barista', 'kitchen_manager')
  returning * into v_employee;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'target_not_allowed');
  end if;
  return jsonb_build_object('ok', true, 'employee_id', v_employee.user_id);
end;
$$;

create or replace function private.owner_delete_staff_impl(
  p_user_id uuid,
  p_employee_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner public.staff_profiles;
  v_employee public.staff_profiles;
  v_closed uuid;
begin
  v_owner := private.require_staff(p_user_id);
  if v_owner.role <> 'owner' then
    raise exception 'Only owners can delete staff' using errcode = '42501';
  end if;
  if p_employee_id = p_user_id then
    return jsonb_build_object('ok', false, 'code', 'cannot_target_self');
  end if;
  select * into v_employee
  from public.staff_profiles
  where user_id = p_employee_id
    and is_active
    and role in ('manager', 'supervisor', 'employee', 'cleaning_staff', 'barista', 'kitchen_manager')
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'target_not_allowed');
  end if;

  v_closed := private.owner_close_employee_shift(
    p_user_id, p_employee_id, 'إغلاق الوردية عند حذف الموظف من الفريق'
  );
  update public.owner_task_assignments set is_active = false
  where employee_id = p_employee_id and is_active;
  delete from public.tasks where user_id = p_employee_id and not completed;
  update public.staff_profiles set is_active = false where user_id = p_employee_id;
  return jsonb_build_object(
    'ok', true,
    'employee_id', p_employee_id,
    'closed_shift', v_closed is not null
  );
end;
$$;

-- Include dashboard-only accounts in the owner's account table so their phone
-- and credentials remain manageable after creation. Attendance/task metrics
-- naturally stay at zero for this non-attendance role.
create or replace function private.get_owner_employee_table_impl(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner public.staff_profiles;
  v_result jsonb;
begin
  v_owner := private.require_staff(p_user_id);
  if v_owner.role <> 'owner' then
    raise exception 'Only owners can read the employee table' using errcode = '42501';
  end if;

  with employee as (
    select
      profile.user_id,
      profile.full_name,
      profile.role::text as role,
      profile.branch_id,
      profile.scheduled_start,
      profile.scheduled_end,
      branch.name as branch_name,
      coalesce(branch.timezone, 'Asia/Riyadh') as timezone,
      (now() at time zone coalesce(branch.timezone, 'Asia/Riyadh'))::date as today,
      coalesce(auth_user.phone, '') as phone
    from public.staff_profiles profile
    left join public.branches branch on branch.id = profile.branch_id
    left join auth.users auth_user on auth_user.id = profile.user_id
    where profile.is_active
      and profile.role in (
        'manager', 'supervisor', 'employee', 'cleaning_staff', 'barista', 'kitchen_manager'
      )
  ),
  employee_day as (
    select
      employee.*,
      attendance.id as attendance_id,
      attendance.status::text as attendance_status,
      attendance.start_time,
      attendance.end_time,
      attendance.break_started_at,
      attendance.break_ended_at,
      attendance.break_duration_minutes
    from employee
    left join lateral (
      select record.*
      from public.attendance_records record
      where record.user_id = employee.user_id and record.shift_date = employee.today
      order by record.start_time desc
      limit 1
    ) attendance on true
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'user_id', employee.user_id,
    'phone', case when employee.phone = '' then null else '+' || employee.phone end,
    'tasks_done', (
      select count(*) from public.tasks task
      where task.user_id = employee.user_id
        and task.task_date = employee.today and task.completed
    ),
    'tasks_total', (
      select count(*) from public.tasks task
      where task.user_id = employee.user_id and task.task_date = employee.today
    ),
    'break_minutes', case
      when employee.break_started_at is null then 0
      when employee.break_ended_at is not null then employee.break_duration_minutes
      else greatest(0, floor(extract(epoch from (now() - employee.break_started_at)) / 60)::integer)
    end,
    'break_status', case
      when employee.break_started_at is null then 'not_taken'
      when employee.break_ended_at is null then 'active'
      else 'completed'
    end,
    'shift_status', case
      when employee.attendance_id is null then 'not_started'
      when employee.attendance_status = 'active' then 'working'
      else 'finished'
    end,
    'shift_started_at', employee.start_time,
    'shift_ended_at', employee.end_time
  ) order by employee.branch_name nulls last, employee.full_name), '[]'::jsonb)
  into v_result
  from employee_day employee;

  return v_result;
end;
$$;
