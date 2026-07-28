-- Staff Operations Dashboard — Stage 1
-- Supabase Auth identities are linked to public.staff_profiles. Attendance
-- mutations go through authenticated RPCs so geofencing, task gates, breaks,
-- and rewards are enforced in Postgres rather than trusted to the browser.

create extension if not exists "pgcrypto";
create schema if not exists private;
revoke create on schema private from public;
grant usage on schema private to authenticated;

do $$
begin
  create type public.staff_role as enum (
    'owner',
    'manager',
    'supervisor',
    'employee',
    'cleaning_staff',
    'barista',
    'kitchen_manager',
    'shift_manager'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.attendance_status as enum ('active', 'completed');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.branches (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  latitude       double precision not null check (latitude between -90 and 90),
  longitude      double precision not null check (longitude between -180 and 180),
  radius_meters  integer not null default 100 check (radius_meters between 10 and 5000),
  timezone       text not null default 'Asia/Riyadh',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists public.staff_profiles (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  full_name         text not null,
  role              public.staff_role not null default 'employee',
  branch_id         uuid references public.branches(id) on delete set null,
  scheduled_start   time,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists staff_profiles_branch_idx
  on public.staff_profiles(branch_id);

create table if not exists public.attendance_records (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references public.staff_profiles(user_id) on delete cascade,
  branch_id                uuid not null references public.branches(id) on delete restrict,
  shift_date               date not null,
  start_time               timestamptz not null default now(),
  end_time                 timestamptz,
  start_location           jsonb not null,
  end_location             jsonb,
  break_started_at         timestamptz,
  break_ended_at           timestamptz,
  break_duration_minutes   integer not null default 0 check (break_duration_minutes between 0 and 1440),
  break_entitlement_minutes integer not null default 60 check (break_entitlement_minutes = 60),
  status                   public.attendance_status not null default 'active',
  on_time                  boolean not null default false,
  points_earned            integer not null default 0 check (points_earned >= 0),
  tasks_completed          integer not null default 0 check (tasks_completed >= 0),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint attendance_completed_fields check (
    (status = 'active' and end_time is null)
    or (status = 'completed' and end_time is not null)
  )
);
create index if not exists attendance_user_date_idx
  on public.attendance_records(user_id, shift_date desc);
create unique index if not exists attendance_one_active_shift_idx
  on public.attendance_records(user_id)
  where status = 'active';

create table if not exists public.tasks (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.staff_profiles(user_id) on delete cascade,
  task_date     date not null,
  task_type     text not null,
  title         text not null,
  is_required   boolean not null default true,
  completed     boolean not null default false,
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint tasks_completion_fields check (
    (completed and completed_at is not null)
    or (not completed and completed_at is null)
  ),
  unique (user_id, task_date, task_type, title)
);
create index if not exists tasks_user_date_idx
  on public.tasks(user_id, task_date, completed);

create table if not exists public.gamification (
  user_id             uuid primary key references public.staff_profiles(user_id) on delete cascade,
  points              integer not null default 0 check (points >= 0),
  badges              text[] not null default '{}',
  streak_count        integer not null default 0 check (streak_count >= 0),
  last_completed_date date,
  updated_at          timestamptz not null default now()
);

drop trigger if exists branches_touch on public.branches;
create trigger branches_touch before update on public.branches
  for each row execute function public.touch_updated_at();
drop trigger if exists staff_profiles_touch on public.staff_profiles;
create trigger staff_profiles_touch before update on public.staff_profiles
  for each row execute function public.touch_updated_at();
drop trigger if exists attendance_records_touch on public.attendance_records;
create trigger attendance_records_touch before update on public.attendance_records
  for each row execute function public.touch_updated_at();
drop trigger if exists tasks_touch on public.tasks;
create trigger tasks_touch before update on public.tasks
  for each row execute function public.touch_updated_at();

alter table public.branches enable row level security;
alter table public.staff_profiles enable row level security;
alter table public.attendance_records enable row level security;
alter table public.tasks enable row level security;
alter table public.gamification enable row level security;

-- New Supabase projects no longer expose new public tables automatically.
-- Explicit grants opt authenticated staff in; RLS below still controls rows.
revoke all on public.branches from anon;
revoke all on public.staff_profiles from anon;
revoke all on public.attendance_records from anon;
revoke all on public.tasks from anon;
revoke all on public.gamification from anon;
grant select on public.branches to authenticated;
grant select on public.staff_profiles to authenticated;
grant select on public.attendance_records to authenticated;
grant select on public.tasks to authenticated;
grant select on public.gamification to authenticated;

drop policy if exists staff_profiles_read_self on public.staff_profiles;
create policy staff_profiles_read_self
  on public.staff_profiles for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists branches_read_assigned on public.branches;
create policy branches_read_assigned
  on public.branches for select
  to authenticated
  using (
    id in (
      select p.branch_id
      from public.staff_profiles p
      where p.user_id = (select auth.uid())
    )
  );

drop policy if exists attendance_read_self on public.attendance_records;
create policy attendance_read_self
  on public.attendance_records for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists tasks_read_self on public.tasks;
create policy tasks_read_self
  on public.tasks for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists gamification_read_self on public.gamification;
create policy gamification_read_self
  on public.gamification for select
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function private.distance_meters(
  p_latitude_a double precision,
  p_longitude_a double precision,
  p_latitude_b double precision,
  p_longitude_b double precision
)
returns double precision
language sql
immutable
set search_path = ''
as $$
  select 6371000 * 2 * asin(
    least(
      1,
      sqrt(
        power(sin(radians((p_latitude_b - p_latitude_a) / 2)), 2)
        + cos(radians(p_latitude_a))
          * cos(radians(p_latitude_b))
          * power(sin(radians((p_longitude_b - p_longitude_a) / 2)), 2)
      )
    )
  );
$$;

create or replace function private.require_staff(p_user_id uuid)
returns public.staff_profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.staff_profiles;
begin
  if p_user_id is null or p_user_id <> (select auth.uid()) then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select * into v_profile
  from public.staff_profiles
  where user_id = p_user_id and is_active;

  if not found then
    raise exception 'Active staff profile not found' using errcode = '42501';
  end if;
  return v_profile;
end;
$$;

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

create or replace function private.set_break_impl(p_user_id uuid, p_action text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.staff_profiles;
  v_attendance public.attendance_records;
  v_minutes integer;
begin
  v_profile := private.require_staff(p_user_id);
  if v_profile.role in ('owner', 'manager', 'shift_manager') then
    raise exception 'This role does not use attendance tracking' using errcode = '42501';
  end if;

  select * into v_attendance
  from public.attendance_records
  where user_id = p_user_id and status = 'active'
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'No active shift found.');
  end if;

  if p_action = 'start' then
    if v_attendance.break_started_at is not null then
      return jsonb_build_object('ok', false, 'message', 'Break has already been used.');
    end if;
    update public.attendance_records
    set break_started_at = now()
    where id = v_attendance.id;
    return jsonb_build_object('ok', true, 'break_status', 'active', 'started_at', now());
  elsif p_action = 'end' then
    if v_attendance.break_started_at is null then
      return jsonb_build_object('ok', false, 'message', 'Break has not started.');
    end if;
    if v_attendance.break_ended_at is not null then
      return jsonb_build_object('ok', false, 'message', 'Break has already ended.');
    end if;
    v_minutes := greatest(
      1,
      floor(extract(epoch from (now() - v_attendance.break_started_at)) / 60)::integer
    );
    update public.attendance_records
    set break_ended_at = now(), break_duration_minutes = v_minutes
    where id = v_attendance.id;
    return jsonb_build_object(
      'ok', true,
      'break_status', 'completed',
      'minutes_used', v_minutes,
      'entitlement_minutes', v_attendance.break_entitlement_minutes
    );
  end if;

  raise exception 'Invalid break action' using errcode = '22023';
end;
$$;

create or replace function private.complete_task_impl(p_user_id uuid, p_task_id uuid)
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

  update public.tasks
  set completed = true, completed_at = now()
  where id = p_task_id
    and user_id = p_user_id
    and task_type = 'general_duty'
    and not completed
  returning * into v_task;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'message', 'Only assigned general duties can be completed manually.'
    );
  end if;
  return jsonb_build_object('ok', true, 'task_id', v_task.id);
end;
$$;

create or replace function private.end_shift_impl(
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
  v_attendance public.attendance_records;
  v_missing jsonb;
  v_task_count integer;
  v_points integer;
  v_hours numeric;
  v_previous_date date;
  v_streak integer;
  v_total_points integer;
  v_badges text[];
begin
  v_profile := private.require_staff(p_user_id);
  if v_profile.role in ('owner', 'manager', 'shift_manager') then
    raise exception 'This role does not use attendance tracking' using errcode = '42501';
  end if;
  if p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    raise exception 'Invalid location coordinates' using errcode = '22023';
  end if;
  if p_accuracy_meters is null or p_accuracy_meters < 0 or p_accuracy_meters > 250 then
    raise exception 'Location accuracy is too low' using errcode = '22023';
  end if;

  select * into v_attendance
  from public.attendance_records
  where user_id = p_user_id and status = 'active'
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'No active shift found.');
  end if;
  if v_attendance.break_started_at is not null and v_attendance.break_ended_at is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'break_active',
      'message', 'End your active break before ending the shift.',
      'missing', jsonb_build_array(jsonb_build_object('id', null, 'title', 'End the active break'))
    );
  end if;

  select jsonb_agg(jsonb_build_object('id', id, 'title', title) order by created_at)
  into v_missing
  from public.tasks
  where user_id = p_user_id
    and task_date = v_attendance.shift_date
    and is_required
    and not completed;

  if v_missing is not null then
    return jsonb_build_object(
      'ok', false,
      'code', 'incomplete_tasks',
      'message', 'Complete all required tasks before ending the shift.',
      'missing', v_missing
    );
  end if;

  select count(*) into v_task_count
  from public.tasks
  where user_id = p_user_id
    and task_date = v_attendance.shift_date
    and completed;

  v_points := 10 + least(v_task_count, 5) * 2 + case when v_attendance.on_time then 5 else 0 end;
  v_hours := round((extract(epoch from (now() - v_attendance.start_time)) / 3600)::numeric, 2);

  update public.attendance_records
  set
    end_time = now(),
    end_location = jsonb_build_object(
      'latitude', p_latitude,
      'longitude', p_longitude,
      'accuracy_meters', p_accuracy_meters
    ),
    status = 'completed',
    points_earned = v_points,
    tasks_completed = v_task_count
  where id = v_attendance.id;

  select last_completed_date, streak_count
  into v_previous_date, v_streak
  from public.gamification
  where user_id = p_user_id
  for update;

  if not found then
    v_previous_date := null;
    v_streak := 0;
  end if;

  if v_previous_date = v_attendance.shift_date then
    v_streak := greatest(v_streak, 1);
  elsif v_previous_date = v_attendance.shift_date - 1 then
    v_streak := v_streak + 1;
  else
    v_streak := 1;
  end if;

  insert into public.gamification (
    user_id, points, streak_count, last_completed_date
  ) values (
    p_user_id, v_points, v_streak, v_attendance.shift_date
  )
  on conflict (user_id) do update set
    points = public.gamification.points + excluded.points,
    streak_count = excluded.streak_count,
    last_completed_date = excluded.last_completed_date,
    updated_at = now()
  returning points, badges into v_total_points, v_badges;

  if v_streak >= 5 and not ('five_day_streak' = any(v_badges)) then
    v_badges := array_append(v_badges, 'five_day_streak');
  end if;
  if v_total_points >= 100 and not ('century_club' = any(v_badges)) then
    v_badges := array_append(v_badges, 'century_club');
  end if;
  if not ('first_shift' = any(v_badges)) then
    v_badges := array_append(v_badges, 'first_shift');
  end if;
  update public.gamification set badges = v_badges where user_id = p_user_id;

  return jsonb_build_object(
    'ok', true,
    'attendance_id', v_attendance.id,
    'hours_worked', v_hours,
    'tasks_completed', v_task_count,
    'points_earned', v_points,
    'total_points', v_total_points,
    'streak_count', v_streak,
    'badges', to_jsonb(v_badges)
  );
end;
$$;

create or replace function private.update_branch_impl(
  p_user_id uuid,
  p_name text,
  p_latitude double precision,
  p_longitude double precision,
  p_radius_meters integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.staff_profiles;
begin
  v_profile := private.require_staff(p_user_id);
  if v_profile.role not in ('owner', 'manager') then
    raise exception 'Only owners and managers can update a branch' using errcode = '42501';
  end if;
  if v_profile.branch_id is null then
    raise exception 'No branch is assigned to this account' using errcode = '23514';
  end if;
  if p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    raise exception 'Invalid location coordinates' using errcode = '22023';
  end if;
  if p_radius_meters not between 10 and 5000 then
    raise exception 'Radius must be between 10 and 5000 meters' using errcode = '22023';
  end if;

  update public.branches
  set
    name = coalesce(nullif(trim(p_name), ''), name),
    latitude = p_latitude,
    longitude = p_longitude,
    radius_meters = p_radius_meters
  where id = v_profile.branch_id;

  return jsonb_build_object('ok', true, 'branch_id', v_profile.branch_id);
end;
$$;

-- Public wrappers are security-invoker RPC endpoints. The privileged
-- implementations live in the unexposed private schema and independently
-- verify auth.uid() before every mutation.
create or replace function public.start_shift(
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_meters double precision
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.start_shift_impl(
    (select auth.uid()),
    p_latitude,
    p_longitude,
    p_accuracy_meters
  );
$$;

create or replace function public.set_break(p_action text)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.set_break_impl((select auth.uid()), p_action);
$$;

create or replace function public.complete_task(p_task_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.complete_task_impl((select auth.uid()), p_task_id);
$$;

create or replace function public.end_shift(
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_meters double precision
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.end_shift_impl(
    (select auth.uid()),
    p_latitude,
    p_longitude,
    p_accuracy_meters
  );
$$;

create or replace function public.update_own_branch(
  p_name text,
  p_latitude double precision,
  p_longitude double precision,
  p_radius_meters integer
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.update_branch_impl(
    (select auth.uid()),
    p_name,
    p_latitude,
    p_longitude,
    p_radius_meters
  );
$$;

revoke all on function private.require_staff(uuid) from public, anon;
revoke all on function private.start_shift_impl(uuid, double precision, double precision, double precision) from public, anon;
revoke all on function private.set_break_impl(uuid, text) from public, anon;
revoke all on function private.complete_task_impl(uuid, uuid) from public, anon;
revoke all on function private.end_shift_impl(uuid, double precision, double precision, double precision) from public, anon;
revoke all on function private.update_branch_impl(uuid, text, double precision, double precision, integer) from public, anon;
grant execute on function private.require_staff(uuid) to authenticated;
grant execute on function private.start_shift_impl(uuid, double precision, double precision, double precision) to authenticated;
grant execute on function private.set_break_impl(uuid, text) to authenticated;
grant execute on function private.complete_task_impl(uuid, uuid) to authenticated;
grant execute on function private.end_shift_impl(uuid, double precision, double precision, double precision) to authenticated;
grant execute on function private.update_branch_impl(uuid, text, double precision, double precision, integer) to authenticated;

revoke all on function public.start_shift(double precision, double precision, double precision) from public, anon;
revoke all on function public.set_break(text) from public, anon;
revoke all on function public.complete_task(uuid) from public, anon;
revoke all on function public.end_shift(double precision, double precision, double precision) from public, anon;
revoke all on function public.update_own_branch(text, double precision, double precision, integer) from public, anon;
grant execute on function public.start_shift(double precision, double precision, double precision) to authenticated;
grant execute on function public.set_break(text) to authenticated;
grant execute on function public.complete_task(uuid) to authenticated;
grant execute on function public.end_shift(double precision, double precision, double precision) to authenticated;
grant execute on function public.update_own_branch(text, double precision, double precision, integer) to authenticated;
