create or replace function private.owner_assign_task_impl(
  p_user_id uuid, p_employee_id uuid, p_task_date date, p_title text,
  p_is_required boolean, p_requires_photo boolean, p_sort_order integer
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_owner public.staff_profiles; v_employee public.staff_profiles; v_task public.tasks; v_title text;
begin
  v_owner := private.require_staff(p_user_id);
  if v_owner.role <> 'owner' then raise exception 'Only owners can assign tasks' using errcode = '42501'; end if;
  select * into v_employee from public.staff_profiles where user_id = p_employee_id and is_active;
  if v_employee.user_id is null or v_employee.role in ('owner','manager','shift_manager') then
    return jsonb_build_object('ok', false, 'code', 'employee_invalid');
  end if;
  v_title := nullif(trim(p_title), '');
  if p_task_date is null or v_title is null or length(v_title) > 200 then
    return jsonb_build_object('ok', false, 'code', 'task_invalid');
  end if;
  insert into public.tasks (user_id, task_date, task_type, title, is_required, requires_photo, sort_order)
  values (p_employee_id, p_task_date, 'general_duty', v_title, coalesce(p_is_required,true), coalesce(p_requires_photo,false), greatest(coalesce(p_sort_order,0),0))
  returning * into v_task;
  return jsonb_build_object('ok', true, 'task_id', v_task.id, 'employee_id', p_employee_id, 'task_date', p_task_date);
exception when unique_violation then return jsonb_build_object('ok', false, 'code', 'duplicate_task');
end; $$;

create or replace function public.owner_assign_task(
  p_employee_id uuid, p_task_date date, p_title text, p_is_required boolean,
  p_requires_photo boolean, p_sort_order integer default 0
) returns jsonb language sql security invoker set search_path = '' as $$
  select private.owner_assign_task_impl((select auth.uid()), p_employee_id, p_task_date, p_title, p_is_required, p_requires_photo, p_sort_order);
$$;

revoke all on function private.owner_assign_task_impl(uuid,uuid,date,text,boolean,boolean,integer) from public, anon;
grant execute on function private.owner_assign_task_impl(uuid,uuid,date,text,boolean,boolean,integer) to authenticated;
revoke all on function public.owner_assign_task(uuid,date,text,boolean,boolean,integer) from public, anon;
grant execute on function public.owner_assign_task(uuid,date,text,boolean,boolean,integer) to authenticated;
