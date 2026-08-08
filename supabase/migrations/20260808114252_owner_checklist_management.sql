-- Company owners manage recurring branch tasks from their own account.
create or replace function private.owner_save_checklist_template_impl(
  p_user_id uuid,
  p_template_id uuid,
  p_branch_id uuid,
  p_title text,
  p_role public.staff_role,
  p_requires_photo boolean,
  p_is_required boolean,
  p_sort_order integer
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_profile public.staff_profiles; v_template public.checklist_templates; v_title text;
begin
  v_profile := private.require_staff(p_user_id);
  if v_profile.role <> 'owner' then raise exception 'Only owners can manage company checklists' using errcode = '42501'; end if;
  if p_branch_id is null or not exists (select 1 from public.branches where id = p_branch_id) then
    return jsonb_build_object('ok', false, 'code', 'branch_invalid');
  end if;
  if p_role is not null and p_role in ('owner','manager','shift_manager') then
    return jsonb_build_object('ok', false, 'code', 'role_not_allowed');
  end if;
  v_title := nullif(trim(p_title), '');
  if v_title is null or length(v_title) > 200 then return jsonb_build_object('ok', false, 'code', 'title_invalid'); end if;
  if p_template_id is null then
    insert into public.checklist_templates(branch_id, role, title, requires_photo, is_required, sort_order)
    values (p_branch_id, p_role, v_title, coalesce(p_requires_photo,false), coalesce(p_is_required,true), greatest(coalesce(p_sort_order,0),0))
    returning * into v_template;
  else
    update public.checklist_templates set branch_id=p_branch_id, role=p_role, title=v_title,
      requires_photo=coalesce(p_requires_photo,false), is_required=coalesce(p_is_required,true), sort_order=greatest(coalesce(p_sort_order,0),0)
    where id=p_template_id returning * into v_template;
    if v_template.id is null then return jsonb_build_object('ok', false, 'code', 'template_not_found'); end if;
  end if;
  return jsonb_build_object('ok', true, 'template_id', v_template.id);
exception when unique_violation then return jsonb_build_object('ok', false, 'code', 'duplicate_template');
end; $$;

create or replace function public.owner_save_checklist_template(
  p_template_id uuid, p_branch_id uuid, p_title text, p_role public.staff_role,
  p_requires_photo boolean, p_is_required boolean, p_sort_order integer
) returns jsonb language sql security invoker set search_path = '' as $$
  select private.owner_save_checklist_template_impl((select auth.uid()), p_template_id, p_branch_id, p_title, p_role, p_requires_photo, p_is_required, p_sort_order);
$$;

create or replace function private.owner_set_checklist_template_active_impl(p_user_id uuid, p_template_id uuid, p_is_active boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_profile public.staff_profiles; v_id uuid;
begin
  v_profile := private.require_staff(p_user_id);
  if v_profile.role <> 'owner' then raise exception 'Only owners can manage company checklists' using errcode = '42501'; end if;
  update public.checklist_templates set is_active=p_is_active where id=p_template_id returning id into v_id;
  if v_id is null then return jsonb_build_object('ok', false, 'code', 'template_not_found'); end if;
  return jsonb_build_object('ok', true, 'template_id', v_id, 'is_active', p_is_active);
end; $$;

create or replace function public.owner_set_checklist_template_active(p_template_id uuid, p_is_active boolean)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.owner_set_checklist_template_active_impl((select auth.uid()), p_template_id, p_is_active);
$$;

revoke all on function private.owner_save_checklist_template_impl(uuid,uuid,uuid,text,public.staff_role,boolean,boolean,integer) from public, anon;
grant execute on function private.owner_save_checklist_template_impl(uuid,uuid,uuid,text,public.staff_role,boolean,boolean,integer) to authenticated;
revoke all on function public.owner_save_checklist_template(uuid,uuid,text,public.staff_role,boolean,boolean,integer) from public, anon;
grant execute on function public.owner_save_checklist_template(uuid,uuid,text,public.staff_role,boolean,boolean,integer) to authenticated;
revoke all on function private.owner_set_checklist_template_active_impl(uuid,uuid,boolean) from public, anon;
grant execute on function private.owner_set_checklist_template_active_impl(uuid,uuid,boolean) to authenticated;
revoke all on function public.owner_set_checklist_template_active(uuid,boolean) from public, anon;
grant execute on function public.owner_set_checklist_template_active(uuid,boolean) to authenticated;
