create or replace function private.owner_update_assigned_task_impl(
  p_user_id uuid, p_task_id uuid, p_employee_id uuid, p_task_date date,
  p_title text, p_is_required boolean, p_requires_photo boolean,
  p_requires_note boolean, p_sort_order integer, p_notes text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_owner public.staff_profiles; v_employee public.staff_profiles; v_task public.tasks; v_title text; v_notes text;
begin
  v_owner := private.require_staff(p_user_id);
  if v_owner.role <> 'owner' then raise exception 'Only owners can update assigned tasks' using errcode = '42501'; end if;
  select * into v_task from public.tasks where id = p_task_id and task_type = 'general_duty' and not completed for update;
  if v_task.id is null then return jsonb_build_object('ok', false, 'code', 'task_not_editable'); end if;
  select * into v_employee from public.staff_profiles where user_id = p_employee_id and is_active;
  if v_employee.user_id is null or v_employee.role in ('owner','manager','shift_manager') then return jsonb_build_object('ok', false, 'code', 'employee_invalid'); end if;
  v_title := nullif(trim(p_title), ''); v_notes := nullif(trim(p_notes), '');
  if p_task_date is null or v_title is null or length(v_title) > 200 or length(coalesce(v_notes,'')) > 1000 then return jsonb_build_object('ok', false, 'code', 'task_invalid'); end if;
  update public.tasks set user_id=p_employee_id, task_date=p_task_date, title=v_title, notes=v_notes,
    is_required=coalesce(p_is_required,true), requires_photo=coalesce(p_requires_photo,false),
    requires_note=coalesce(p_requires_note,false), sort_order=greatest(coalesce(p_sort_order,0),0)
  where id=v_task.id;
  return jsonb_build_object('ok', true, 'task_id', v_task.id, 'employee_id', p_employee_id);
exception when unique_violation then return jsonb_build_object('ok', false, 'code', 'duplicate_task');
end; $$;

create or replace function public.owner_update_assigned_task(
  p_task_id uuid, p_employee_id uuid, p_task_date date, p_title text,
  p_is_required boolean, p_requires_photo boolean, p_requires_note boolean,
  p_sort_order integer, p_notes text default null
)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.owner_update_assigned_task_impl((select auth.uid()), p_task_id, p_employee_id, p_task_date, p_title, p_is_required, p_requires_photo, p_requires_note, p_sort_order, p_notes);
$$;

revoke all on function private.owner_update_assigned_task_impl(uuid,uuid,uuid,date,text,boolean,boolean,boolean,integer,text) from public, anon;
grant execute on function private.owner_update_assigned_task_impl(uuid,uuid,uuid,date,text,boolean,boolean,boolean,integer,text) to authenticated;
revoke all on function public.owner_update_assigned_task(uuid,uuid,date,text,boolean,boolean,boolean,integer,text) from public, anon;
grant execute on function public.owner_update_assigned_task(uuid,uuid,date,text,boolean,boolean,boolean,integer,text) to authenticated;
