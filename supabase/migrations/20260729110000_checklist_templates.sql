-- Reusable branch checklist templates with per-item photo requirements.
--
-- Supervisors define a checklist once for their branch (each item optionally
-- targeting one role and optionally requiring photo evidence). At shift start
-- the active items materialize as tasks for that user's day. Completing an
-- item that requires a photo is impossible without a valid object in the
-- private staff-evidence bucket — enforced by the RPC AND a table CHECK.

-- ── template table ───────────────────────────────────────────────────────────
create table if not exists public.checklist_templates (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid not null references public.branches(id) on delete cascade,
  role           public.staff_role,          -- null = every attendance role
  title          text not null check (length(trim(title)) between 1 and 200),
  requires_photo boolean not null default false,
  is_required    boolean not null default true,
  sort_order     integer not null default 0,
  is_active      boolean not null default true,
  created_by     uuid not null references public.staff_profiles(user_id) on delete restrict,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint checklist_templates_role_allowed check (
    role is null or role not in ('owner', 'manager', 'shift_manager')
  )
);
create index if not exists checklist_templates_branch_idx
  on public.checklist_templates(branch_id, is_active);
create unique index if not exists checklist_templates_unique_role_title_idx
  on public.checklist_templates (branch_id, role, lower(trim(title)))
  where is_active and role is not null;
create unique index if not exists checklist_templates_unique_all_title_idx
  on public.checklist_templates (branch_id, lower(trim(title)))
  where is_active and role is null;

drop trigger if exists checklist_templates_touch on public.checklist_templates;
create trigger checklist_templates_touch before update on public.checklist_templates
  for each row execute function public.touch_updated_at();

alter table public.checklist_templates enable row level security;
revoke all on table public.checklist_templates from public, anon, authenticated;
grant select on table public.checklist_templates to authenticated;

drop policy if exists checklist_templates_read_authorized on public.checklist_templates;
create policy checklist_templates_read_authorized
  on public.checklist_templates for select
  to authenticated
  using ((select private.can_read_branch_report(branch_id, created_by)));

-- ── task columns for template-derived items ─────────────────────────────────
alter table public.tasks
  add column if not exists template_id uuid references public.checklist_templates(id) on delete set null,
  add column if not exists requires_photo boolean not null default false,
  add column if not exists photo_path text,
  add column if not exists sort_order integer not null default 0;

-- A photo-required task can never be completed without a stored photo path.
alter table public.tasks drop constraint if exists tasks_photo_completion;
alter table public.tasks add constraint tasks_photo_completion check (
  not completed or not requires_photo or photo_path is not null
);

-- ── template CRUD (supervisor, own branch only) ─────────────────────────────
create or replace function private.save_checklist_template_impl(
  p_user_id uuid,
  p_template_id uuid,
  p_title text,
  p_role public.staff_role,
  p_requires_photo boolean,
  p_is_required boolean,
  p_sort_order integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.staff_profiles;
  v_title text;
  v_template public.checklist_templates;
begin
  v_profile := private.require_staff(p_user_id);
  if v_profile.role <> 'supervisor' then
    raise exception 'Only supervisors can manage checklist templates' using errcode = '42501';
  end if;
  if v_profile.branch_id is null then
    raise exception 'No branch is assigned to this account' using errcode = '23514';
  end if;

  v_title := nullif(trim(p_title), '');
  if v_title is null or length(v_title) > 200 then
    return jsonb_build_object('ok', false, 'code', 'title_invalid', 'message', 'A checklist title of 1-200 characters is required.');
  end if;
  if p_role is not null and p_role in ('owner', 'manager', 'shift_manager') then
    return jsonb_build_object('ok', false, 'code', 'role_not_allowed', 'message', 'Checklist items can only target attendance roles.');
  end if;

  begin
    if p_template_id is null then
      insert into public.checklist_templates (
        branch_id, role, title, requires_photo, is_required, sort_order, created_by
      ) values (
        v_profile.branch_id,
        p_role,
        v_title,
        coalesce(p_requires_photo, false),
        coalesce(p_is_required, true),
        coalesce(p_sort_order, 0),
        p_user_id
      )
      returning * into v_template;
    else
      update public.checklist_templates
      set
        role = p_role,
        title = v_title,
        requires_photo = coalesce(p_requires_photo, false),
        is_required = coalesce(p_is_required, true),
        sort_order = coalesce(p_sort_order, 0)
      where id = p_template_id and branch_id = v_profile.branch_id
      returning * into v_template;
      if not found then
        return jsonb_build_object('ok', false, 'code', 'template_not_found', 'message', 'Checklist item not found in your branch.');
      end if;
    end if;
  exception
    when unique_violation then
      return jsonb_build_object('ok', false, 'code', 'duplicate_template', 'message', 'An active item with this title already exists for this role.');
  end;

  return jsonb_build_object('ok', true, 'template_id', v_template.id);
end;
$$;

create or replace function private.set_checklist_template_active_impl(
  p_user_id uuid,
  p_template_id uuid,
  p_is_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.staff_profiles;
  v_template public.checklist_templates;
begin
  v_profile := private.require_staff(p_user_id);
  if v_profile.role <> 'supervisor' then
    raise exception 'Only supervisors can manage checklist templates' using errcode = '42501';
  end if;
  if v_profile.branch_id is null then
    raise exception 'No branch is assigned to this account' using errcode = '23514';
  end if;

  begin
    update public.checklist_templates
    set is_active = coalesce(p_is_active, false)
    where id = p_template_id and branch_id = v_profile.branch_id
    returning * into v_template;
  exception
    when unique_violation then
      return jsonb_build_object('ok', false, 'code', 'duplicate_template', 'message', 'An active item with this title already exists for this role.');
  end;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'template_not_found', 'message', 'Checklist item not found in your branch.');
  end if;
  return jsonb_build_object('ok', true, 'template_id', v_template.id, 'is_active', v_template.is_active);
end;
$$;

-- ── shift start now also seeds branch checklist items ───────────────────────
create or replace function private.start_shift_impl(
  p_user_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_meters double precision
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.staff_profiles;
  v_branch public.branches;
  v_attendance public.attendance_records;
  v_distance double precision;
  v_shift_date date;
  v_local_time time;
  v_on_time boolean := false;
begin
  v_profile := private.require_staff(p_user_id);

  if v_profile.role in ('owner', 'manager', 'shift_manager') then
    raise exception 'This role does not use attendance tracking' using errcode = '42501';
  end if;
  if v_profile.branch_id is null then
    raise exception 'No branch is assigned to this staff member' using errcode = '23514';
  end if;
  if p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    raise exception 'Invalid location coordinates' using errcode = '22023';
  end if;
  if p_accuracy_meters is null or p_accuracy_meters < 0 or p_accuracy_meters > 250 then
    raise exception 'Location accuracy is too low' using errcode = '22023';
  end if;

  select * into strict v_branch
  from public.branches
  where id = v_profile.branch_id;

  v_distance := private.distance_meters(
    p_latitude,
    p_longitude,
    v_branch.latitude,
    v_branch.longitude
  );
  if v_distance > v_branch.radius_meters then
    return jsonb_build_object(
      'ok', false,
      'code', 'outside_branch',
      'message', 'You are outside the branch location. Cannot start shift.',
      'distance_meters', round(v_distance::numeric, 1),
      'allowed_radius_meters', v_branch.radius_meters
    );
  end if;

  v_shift_date := (now() at time zone v_branch.timezone)::date;
  v_local_time := (now() at time zone v_branch.timezone)::time;
  if v_profile.scheduled_start is not null then
    v_on_time := v_local_time <= v_profile.scheduled_start + interval '15 minutes';
  end if;

  insert into public.attendance_records (
    user_id,
    branch_id,
    shift_date,
    start_location,
    on_time
  ) values (
    p_user_id,
    v_branch.id,
    v_shift_date,
    jsonb_build_object(
      'latitude', p_latitude,
      'longitude', p_longitude,
      'accuracy_meters', p_accuracy_meters,
      'distance_meters', round(v_distance::numeric, 1)
    ),
    v_on_time
  )
  returning * into v_attendance;

  if v_profile.role = 'cleaning_staff' then
    insert into public.tasks (user_id, task_date, task_type, title)
    values
      (p_user_id, v_shift_date, 'cleaning_report', 'Submit the daily cleaning report'),
      (p_user_id, v_shift_date, 'cleaning_photos', 'Upload cleaning proof photos')
    on conflict do nothing;
  elsif v_profile.role = 'barista' then
    insert into public.tasks (user_id, task_date, task_type, title)
    values
      (p_user_id, v_shift_date, 'barista_report', 'Submit the daily barista report'),
      (p_user_id, v_shift_date, 'bar_clean_confirmation', 'Confirm the bar is clean')
    on conflict do nothing;
  elsif v_profile.role = 'kitchen_manager' then
    insert into public.tasks (user_id, task_date, task_type, title)
    values
      (p_user_id, v_shift_date, 'kitchen_report', 'Submit the kitchen report'),
      (p_user_id, v_shift_date, 'kitchen_photos', 'Upload kitchen condition photos'),
      (p_user_id, v_shift_date, 'inventory_count', 'Complete the product and dessert inventory count')
    on conflict do nothing;
  end if;

  -- Branch checklist templates targeting this role (or all attendance roles).
  insert into public.tasks (
    user_id, task_date, task_type, title, is_required, requires_photo, template_id, sort_order
  )
  select
    p_user_id,
    v_shift_date,
    'checklist',
    template.title,
    template.is_required,
    template.requires_photo,
    template.id,
    template.sort_order
  from public.checklist_templates template
  where template.branch_id = v_branch.id
    and template.is_active
    and (template.role is null or template.role = v_profile.role)
  on conflict (user_id, task_date, task_type, title) do nothing;

  insert into public.gamification (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  return jsonb_build_object(
    'ok', true,
    'attendance_id', v_attendance.id,
    'started_at', v_attendance.start_time,
    'shift_date', v_shift_date,
    'distance_meters', round(v_distance::numeric, 1),
    'on_time', v_on_time
  );
exception
  when unique_violation then
    return jsonb_build_object(
      'ok', false,
      'code', 'active_shift_exists',
      'message', 'An active shift already exists.'
    );
end;
$$;

-- ── task completion now supports checklist items + photo evidence ───────────
create or replace function private.complete_task_impl(
  p_user_id uuid,
  p_task_id uuid,
  p_photo_path text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.staff_profiles;
  v_task public.tasks;
begin
  v_profile := private.require_staff(p_user_id);
  if v_profile.role in ('owner', 'manager', 'shift_manager') then
    raise exception 'This role cannot complete attendance tasks' using errcode = '42501';
  end if;

  select * into v_task
  from public.tasks
  where id = p_task_id and user_id = p_user_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'task_not_found', 'message', 'Task not found.');
  end if;
  if v_task.completed then
    return jsonb_build_object('ok', false, 'code', 'task_already_completed', 'message', 'This task is already completed.');
  end if;
  if v_task.task_type not in ('general_duty', 'checklist') then
    return jsonb_build_object(
      'ok', false,
      'code', 'task_not_manual',
      'message', 'This task is completed automatically from its daily form.'
    );
  end if;

  if v_task.requires_photo then
    if p_photo_path is null or length(trim(p_photo_path)) = 0 then
      return jsonb_build_object(
        'ok', false,
        'code', 'photo_required',
        'message', 'A proof photo is required to complete this task.',
        'title', v_task.title
      );
    end if;
    perform private.assert_staff_evidence(p_user_id, array[p_photo_path], true);
  elsif p_photo_path is not null and length(trim(p_photo_path)) > 0 then
    -- Optional proof on a non-photo task still has to be a valid own object.
    perform private.assert_staff_evidence(p_user_id, array[p_photo_path], true);
  else
    p_photo_path := null;
  end if;

  update public.tasks
  set completed = true, completed_at = now(), photo_path = p_photo_path
  where id = v_task.id;

  return jsonb_build_object(
    'ok', true,
    'task_id', v_task.id,
    'requires_photo', v_task.requires_photo,
    'photo_path', p_photo_path
  );
end;
$$;

-- ── checklist evidence becomes immutable once cited by a task ───────────────
create or replace function private.can_mutate_staff_evidence(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.can_upload_staff_evidence(p_object_name)
    and not exists (
      select 1 from public.cleaning_reports report
      where p_object_name = any(report.photo_paths)
    )
    and not exists (
      select 1 from public.barista_reports report
      where p_object_name = any(report.photo_paths)
    )
    and not exists (
      select 1 from public.kitchen_reports report
      where p_object_name = any(report.photo_paths)
    )
    and not exists (
      select 1 from public.water_quality_checks check_row
      where check_row.photo_path = p_object_name
    )
    and not exists (
      select 1 from public.tasks task_row
      where task_row.photo_path = p_object_name
    );
$$;

-- ── public wrappers ─────────────────────────────────────────────────────────
create or replace function public.save_checklist_template(
  p_template_id uuid,
  p_title text,
  p_role public.staff_role,
  p_requires_photo boolean,
  p_is_required boolean,
  p_sort_order integer
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.save_checklist_template_impl(
    (select auth.uid()),
    p_template_id,
    p_title,
    p_role,
    p_requires_photo,
    p_is_required,
    p_sort_order
  );
$$;

create or replace function public.set_checklist_template_active(
  p_template_id uuid,
  p_is_active boolean
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.set_checklist_template_active_impl(
    (select auth.uid()),
    p_template_id,
    p_is_active
  );
$$;

-- complete_task gains an optional photo argument: signature change requires
-- dropping the old wrapper and the superseded two-argument implementation.
drop function if exists public.complete_task(uuid);
create function public.complete_task(p_task_id uuid, p_photo_path text default null)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.complete_task_impl((select auth.uid()), p_task_id, p_photo_path);
$$;
drop function if exists private.complete_task_impl(uuid, uuid);

revoke all on function private.save_checklist_template_impl(uuid, uuid, text, public.staff_role, boolean, boolean, integer) from public, anon;
revoke all on function private.set_checklist_template_active_impl(uuid, uuid, boolean) from public, anon;
revoke all on function private.complete_task_impl(uuid, uuid, text) from public, anon;
grant execute on function private.save_checklist_template_impl(uuid, uuid, text, public.staff_role, boolean, boolean, integer) to authenticated;
grant execute on function private.set_checklist_template_active_impl(uuid, uuid, boolean) to authenticated;
grant execute on function private.complete_task_impl(uuid, uuid, text) to authenticated;

revoke all on function public.save_checklist_template(uuid, text, public.staff_role, boolean, boolean, integer) from public, anon;
revoke all on function public.set_checklist_template_active(uuid, boolean) from public, anon;
revoke all on function public.complete_task(uuid, text) from public, anon;
grant execute on function public.save_checklist_template(uuid, text, public.staff_role, boolean, boolean, integer) to authenticated;
grant execute on function public.set_checklist_template_active(uuid, boolean) to authenticated;
grant execute on function public.complete_task(uuid, text) to authenticated;
