-- Owner tasks are standing daily assignments. The assignment remains visible
-- and editable after an employee completes an occurrence; shift start creates
-- the next occurrence without accumulating unfinished copies from old days.

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

  -- A standing task has one unfinished occurrence at a time. This prevents an
  -- employee who missed yesterday from seeing the same task twice today.
  delete from public.tasks
  where user_id = p_user_id
    and task_type = 'general_duty'
    and recurring_assignment_id is not null
    and not completed
    and task_date < p_shift_date;

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

-- Keep the old RPC signature for already-open browser tabs, but deliberately
-- ignore p_repeat_daily. Every owner-created task is now a standing daily task.
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
  end loop;

  return jsonb_build_object(
    'ok', true,
    'assigned', v_assigned,
    'duplicates', v_duplicates,
    'repeat_daily', true
  );
end;
$$;

create or replace function private.owner_update_task_assignment_impl(
  p_user_id uuid,
  p_assignment_id uuid,
  p_employee_id uuid,
  p_starts_on date,
  p_title text,
  p_notes text,
  p_is_required boolean,
  p_requires_photo boolean,
  p_requires_note boolean,
  p_response_type text,
  p_sort_order integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner public.staff_profiles;
  v_assignment public.owner_task_assignments;
  v_title text := nullif(trim(p_title), '');
  v_notes text := nullif(trim(p_notes), '');
  v_response text := coalesce(nullif(trim(p_response_type), ''), 'completion');
  v_photo boolean;
  v_note boolean;
begin
  v_owner := private.require_staff(p_user_id);
  if v_owner.role <> 'owner' then
    raise exception 'Only owners can update task assignments' using errcode = '42501';
  end if;
  select * into v_assignment
  from public.owner_task_assignments
  where id = p_assignment_id and is_active
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
  if p_starts_on is null or v_title is null or length(v_title) > 200
    or length(coalesce(v_notes, '')) > 1000
    or v_response not in ('completion', 'yes_no')
  then
    return jsonb_build_object('ok', false, 'code', 'task_invalid');
  end if;

  v_photo := case when v_response = 'yes_no' then false else coalesce(p_requires_photo, false) end;
  v_note := case when v_response = 'yes_no' then false else coalesce(p_requires_note, false) end;

  update public.owner_task_assignments
  set employee_id = p_employee_id,
      starts_on = p_starts_on,
      title = v_title,
      notes = v_notes,
      is_required = coalesce(p_is_required, true),
      requires_photo = v_photo,
      requires_note = v_note,
      response_type = v_response,
      sort_order = greatest(coalesce(p_sort_order, 0), 0)
  where id = p_assignment_id;

  -- Completed occurrences are immutable history. Replace only the unfinished
  -- occurrence so reassignment and evidence changes take effect immediately.
  delete from public.tasks
  where recurring_assignment_id = p_assignment_id and not completed;

  insert into public.tasks (
    user_id, task_date, task_type, title, notes, is_required,
    requires_photo, requires_note, response_type, sort_order,
    recurring_assignment_id
  ) values (
    p_employee_id, p_starts_on, 'general_duty', v_title, v_notes,
    coalesce(p_is_required, true), v_photo, v_note, v_response,
    greatest(coalesce(p_sort_order, 0), 0), p_assignment_id
  );

  return jsonb_build_object(
    'ok', true,
    'assignment_id', p_assignment_id,
    'employee_id', p_employee_id,
    'repeat_daily', true
  );
exception when unique_violation then
  return jsonb_build_object('ok', false, 'code', 'duplicate_task');
end;
$$;

create or replace function public.owner_update_task_assignment(
  p_assignment_id uuid,
  p_employee_id uuid,
  p_starts_on date,
  p_title text,
  p_notes text default null,
  p_is_required boolean default true,
  p_requires_photo boolean default false,
  p_requires_note boolean default false,
  p_response_type text default 'completion',
  p_sort_order integer default 0
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.owner_update_task_assignment_impl(
    (select auth.uid()), p_assignment_id, p_employee_id, p_starts_on,
    p_title, p_notes, p_is_required, p_requires_photo, p_requires_note,
    p_response_type, p_sort_order
  );
$$;

create or replace function private.owner_delete_task_assignment_impl(
  p_user_id uuid,
  p_assignment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner public.staff_profiles;
begin
  v_owner := private.require_staff(p_user_id);
  if v_owner.role <> 'owner' then
    raise exception 'Only owners can stop task assignments' using errcode = '42501';
  end if;
  update public.owner_task_assignments
  set is_active = false
  where id = p_assignment_id and is_active;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'task_not_editable');
  end if;
  delete from public.tasks
  where recurring_assignment_id = p_assignment_id and not completed;
  return jsonb_build_object('ok', true, 'assignment_id', p_assignment_id, 'stopped_daily', true);
end;
$$;

create or replace function public.owner_delete_task_assignment(p_assignment_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.owner_delete_task_assignment_impl((select auth.uid()), p_assignment_id);
$$;

revoke all on function private.owner_update_task_assignment_impl(uuid,uuid,uuid,date,text,text,boolean,boolean,boolean,text,integer) from public, anon;
revoke all on function private.owner_delete_task_assignment_impl(uuid,uuid) from public, anon;
revoke all on function public.owner_update_task_assignment(uuid,uuid,date,text,text,boolean,boolean,boolean,text,integer) from public, anon;
revoke all on function public.owner_delete_task_assignment(uuid) from public, anon;
grant execute on function private.owner_update_task_assignment_impl(uuid,uuid,uuid,date,text,text,boolean,boolean,boolean,text,integer) to authenticated;
grant execute on function private.owner_delete_task_assignment_impl(uuid,uuid) to authenticated;
grant execute on function public.owner_update_task_assignment(uuid,uuid,date,text,text,boolean,boolean,boolean,text,integer) to authenticated;
grant execute on function public.owner_delete_task_assignment(uuid) to authenticated;

-- Convert every currently unfinished owner task into a standing assignment.
-- This preserves the owner's exact employee, wording and answer type. It also
-- moves the first occurrence to today so old test-period dates do not remain
-- as overdue duplicates when the next shift starts.
do $$
declare
  v_owner_id uuid;
begin
  select user_id into v_owner_id
  from public.staff_profiles
  where role = 'owner' and is_active
  order by created_at
  limit 1;

  if v_owner_id is null and exists (
    select 1 from public.tasks
    where task_type = 'general_duty' and not completed
      and recurring_assignment_id is null
  ) then
    raise exception 'Cannot convert owner tasks without an active owner';
  end if;

  with candidates as (
    select distinct on (task.user_id, lower(task.title))
      task.user_id,
      task.title,
      task.notes,
      task.is_required,
      task.requires_photo,
      task.requires_note,
      task.response_type,
      task.sort_order,
      coalesce(branch.timezone, 'Asia/Riyadh') as timezone
    from public.tasks task
    join public.staff_profiles staff
      on staff.user_id = task.user_id and staff.is_active
    left join public.branches branch on branch.id = staff.branch_id
    where task.task_type = 'general_duty'
      and not task.completed
      and task.recurring_assignment_id is null
    order by task.user_id, lower(task.title), task.task_date desc, task.created_at desc
  )
  insert into public.owner_task_assignments (
    employee_id, starts_on, title, notes, is_required, requires_photo,
    requires_note, response_type, sort_order, created_by
  )
  select
    candidate.user_id,
    (now() at time zone candidate.timezone)::date,
    candidate.title,
    candidate.notes,
    candidate.is_required,
    candidate.requires_photo,
    candidate.requires_note,
    candidate.response_type,
    candidate.sort_order,
    v_owner_id
  from candidates candidate
  on conflict do nothing;

  update public.tasks task
  set recurring_assignment_id = assignment.id,
      task_date = (now() at time zone coalesce(branch.timezone, 'Asia/Riyadh'))::date
  from public.owner_task_assignments assignment
  join public.staff_profiles staff on staff.user_id = assignment.employee_id
  left join public.branches branch on branch.id = staff.branch_id
  where task.user_id = assignment.employee_id
    and lower(task.title) = lower(assignment.title)
    and task.task_type = 'general_duty'
    and not task.completed
    and task.recurring_assignment_id is null
    and assignment.is_active;
end;
$$;
