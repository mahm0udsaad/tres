-- One owner-only read model for the employee operations table. Phone numbers
-- live in auth.users, while shift/task facts live in public tables, so the
-- aggregation stays inside Postgres and never exposes service-role access to
-- the staff application.

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
      p.user_id,
      p.full_name,
      p.role::text as role,
      p.branch_id,
      p.scheduled_start,
      p.scheduled_end,
      b.name as branch_name,
      coalesce(b.timezone, 'Asia/Riyadh') as timezone,
      (now() at time zone coalesce(b.timezone, 'Asia/Riyadh'))::date as today,
      coalesce(u.phone, '') as phone
    from public.staff_profiles p
    left join public.branches b on b.id = p.branch_id
    left join auth.users u on u.id = p.user_id
    where p.is_active
      and p.role in ('supervisor', 'employee', 'cleaning_staff', 'barista', 'kitchen_manager')
  ),
  employee_day as (
    select
      e.*,
      a.id as attendance_id,
      a.status::text as attendance_status,
      a.start_time,
      a.end_time,
      a.break_started_at,
      a.break_ended_at,
      a.break_duration_minutes
    from employee e
    left join lateral (
      select ar.*
      from public.attendance_records ar
      where ar.user_id = e.user_id and ar.shift_date = e.today
      order by ar.start_time desc
      limit 1
    ) a on true
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'user_id', e.user_id,
    'phone', case when e.phone = '' then null else '+' || e.phone end,
    'tasks_done', (
      select count(*) from public.tasks t
      where t.user_id = e.user_id and t.task_date = e.today and t.completed
    ),
    'tasks_total', (
      select count(*) from public.tasks t
      where t.user_id = e.user_id and t.task_date = e.today
    ),
    'break_minutes', case
      when e.break_started_at is null then 0
      when e.break_ended_at is not null then e.break_duration_minutes
      else greatest(0, floor(extract(epoch from (now() - e.break_started_at)) / 60)::integer)
    end,
    'break_status', case
      when e.break_started_at is null then 'not_taken'
      when e.break_ended_at is null then 'active'
      else 'completed'
    end,
    'shift_status', case
      when e.attendance_id is null then 'not_started'
      when e.attendance_status = 'active' then 'working'
      else 'finished'
    end,
    'shift_started_at', e.start_time,
    'shift_ended_at', e.end_time
  ) order by e.branch_name nulls last, e.full_name), '[]'::jsonb)
  into v_result
  from employee_day e;

  return v_result;
end;
$$;

create or replace function public.get_owner_employee_table()
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.get_owner_employee_table_impl((select auth.uid()));
$$;

revoke all on function private.get_owner_employee_table_impl(uuid) from public, anon;
grant execute on function private.get_owner_employee_table_impl(uuid) to authenticated;
revoke all on function public.get_owner_employee_table() from public, anon;
grant execute on function public.get_owner_employee_table() to authenticated;

comment on function public.get_owner_employee_table() is
  'Owner-only employee operations rows: login phone and branch-local daily task, break and shift facts.';
