alter table public.tasks add column if not exists response_type text not null default 'completion'
  check (response_type in ('completion','yes_no'));
alter table public.tasks add column if not exists yes_no_answer boolean;

create or replace function private.complete_task_impl(p_user_id uuid, p_task_id uuid, p_photo_path text, p_note text default null, p_yes_no_answer boolean default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_profile public.staff_profiles; v_task public.tasks; v_note text;
begin
  v_profile := private.require_staff(p_user_id);
  if v_profile.role in ('owner','manager','shift_manager') then raise exception 'This role cannot complete attendance tasks' using errcode='42501'; end if;
  select * into v_task from public.tasks where id=p_task_id and user_id=p_user_id for update;
  if not found then return jsonb_build_object('ok',false,'code','task_not_found'); end if;
  if v_task.completed then return jsonb_build_object('ok',false,'code','task_already_completed'); end if;
  if v_task.task_type not in ('general_duty','checklist') then return jsonb_build_object('ok',false,'code','task_not_manual'); end if;
  if v_task.response_type = 'yes_no' and p_yes_no_answer is null then return jsonb_build_object('ok',false,'code','answer_required','title',v_task.title); end if;
  v_note := nullif(trim(p_note), '');
  if v_task.requires_note and (v_note is null or length(v_note)>1000) then return jsonb_build_object('ok',false,'code','note_required','title',v_task.title); end if;
  if v_note is not null and length(v_note)>1000 then return jsonb_build_object('ok',false,'code','note_invalid'); end if;
  if v_task.requires_photo then
    if p_photo_path is null or length(trim(p_photo_path))=0 then return jsonb_build_object('ok',false,'code','photo_required','title',v_task.title); end if;
    perform private.assert_staff_evidence(p_user_id,array[p_photo_path],true);
  elsif p_photo_path is not null and length(trim(p_photo_path))>0 then perform private.assert_staff_evidence(p_user_id,array[p_photo_path],true); else p_photo_path := null; end if;
  update public.tasks set completed=true, completed_at=now(), photo_path=p_photo_path,
    yes_no_answer=case when v_task.response_type='yes_no' then p_yes_no_answer else null end,
    notes=case when v_note is not null then coalesce(notes,'') || case when notes is null or notes='' then '' else E'\n' end || 'ملاحظة الموظف: ' || v_note else notes end
  where id=v_task.id;
  return jsonb_build_object('ok',true,'task_id',v_task.id,'yes_no_answer',p_yes_no_answer);
end; $$;

drop function if exists public.complete_task(uuid,text,text);
create or replace function public.complete_task(p_task_id uuid,p_photo_path text default null,p_note text default null,p_yes_no_answer boolean default null)
returns jsonb language sql security invoker set search_path = '' as $$
 select private.complete_task_impl((select auth.uid()),p_task_id,p_photo_path,p_note,p_yes_no_answer);
$$;
revoke all on function private.complete_task_impl(uuid,uuid,text,text,boolean) from public,anon;
grant execute on function private.complete_task_impl(uuid,uuid,text,text,boolean) to authenticated;
revoke all on function public.complete_task(uuid,text,text,boolean) from public,anon;
grant execute on function public.complete_task(uuid,text,text,boolean) to authenticated;

create or replace function private.owner_assign_task_impl(p_user_id uuid,p_employee_id uuid,p_task_date date,p_title text,p_is_required boolean,p_requires_photo boolean,p_sort_order integer,p_notes text default null,p_requires_note boolean default false,p_response_type text default 'completion')
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_owner public.staff_profiles; v_employee public.staff_profiles; v_task public.tasks; v_title text; v_notes text; v_response text;
begin
 v_owner:=private.require_staff(p_user_id); if v_owner.role<>'owner' then raise exception 'Only owners can assign tasks' using errcode='42501'; end if;
 select * into v_employee from public.staff_profiles where user_id=p_employee_id and is_active;
 if v_employee.user_id is null or v_employee.role in ('owner','manager','shift_manager') then return jsonb_build_object('ok',false,'code','employee_invalid'); end if;
 v_title:=nullif(trim(p_title),''); v_notes:=nullif(trim(p_notes),''); v_response:=coalesce(nullif(trim(p_response_type),''),'completion');
 if p_task_date is null or v_title is null or length(v_title)>200 or length(coalesce(v_notes,''))>1000 or v_response not in ('completion','yes_no') then return jsonb_build_object('ok',false,'code','task_invalid'); end if;
 insert into public.tasks(user_id,task_date,task_type,title,notes,is_required,requires_photo,requires_note,response_type,sort_order)
 values(p_employee_id,p_task_date,'general_duty',v_title,v_notes,coalesce(p_is_required,true),case when v_response='yes_no' then false else coalesce(p_requires_photo,false) end,case when v_response='yes_no' then false else coalesce(p_requires_note,false) end,v_response,greatest(coalesce(p_sort_order,0),0)) returning * into v_task;
 return jsonb_build_object('ok',true,'task_id',v_task.id);
exception when unique_violation then return jsonb_build_object('ok',false,'code','duplicate_task');
end; $$;

drop function if exists public.owner_assign_task(uuid,date,text,boolean,boolean,integer,text,boolean);
create or replace function public.owner_assign_task(p_employee_id uuid,p_task_date date,p_title text,p_is_required boolean,p_requires_photo boolean,p_sort_order integer default 0,p_notes text default null,p_requires_note boolean default false,p_response_type text default 'completion')
returns jsonb language sql security invoker set search_path='' as $$ select private.owner_assign_task_impl((select auth.uid()),p_employee_id,p_task_date,p_title,p_is_required,p_requires_photo,p_sort_order,p_notes,p_requires_note,p_response_type); $$;
revoke all on function private.owner_assign_task_impl(uuid,uuid,date,text,boolean,boolean,integer,text,boolean,text) from public,anon;
grant execute on function private.owner_assign_task_impl(uuid,uuid,date,text,boolean,boolean,integer,text,boolean,text) to authenticated;
revoke all on function public.owner_assign_task(uuid,date,text,boolean,boolean,integer,text,boolean,text) from public,anon;
grant execute on function public.owner_assign_task(uuid,date,text,boolean,boolean,integer,text,boolean,text) to authenticated;

create or replace function private.owner_update_assigned_task_impl(p_user_id uuid,p_task_id uuid,p_employee_id uuid,p_task_date date,p_title text,p_is_required boolean,p_requires_photo boolean,p_requires_note boolean,p_sort_order integer,p_notes text,p_response_type text default 'completion')
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_owner public.staff_profiles; v_employee public.staff_profiles; v_task public.tasks; v_title text; v_notes text; v_response text;
begin
 v_owner:=private.require_staff(p_user_id); if v_owner.role<>'owner' then raise exception 'Only owners can update assigned tasks' using errcode='42501'; end if;
 select * into v_task from public.tasks where id=p_task_id and task_type='general_duty' and not completed for update;
 if v_task.id is null then return jsonb_build_object('ok',false,'code','task_not_editable'); end if;
 select * into v_employee from public.staff_profiles where user_id=p_employee_id and is_active;
 if v_employee.user_id is null or v_employee.role in ('owner','manager','shift_manager') then return jsonb_build_object('ok',false,'code','employee_invalid'); end if;
 v_title:=nullif(trim(p_title),''); v_notes:=nullif(trim(p_notes),''); v_response:=coalesce(nullif(trim(p_response_type),''),'completion');
 if p_task_date is null or v_title is null or length(v_title)>200 or length(coalesce(v_notes,''))>1000 or v_response not in ('completion','yes_no') then return jsonb_build_object('ok',false,'code','task_invalid'); end if;
 update public.tasks set user_id=p_employee_id,task_date=p_task_date,title=v_title,notes=v_notes,is_required=coalesce(p_is_required,true),requires_photo=case when v_response='yes_no' then false else coalesce(p_requires_photo,false) end,requires_note=case when v_response='yes_no' then false else coalesce(p_requires_note,false) end,response_type=v_response,yes_no_answer=null,sort_order=greatest(coalesce(p_sort_order,0),0) where id=v_task.id;
 return jsonb_build_object('ok',true,'task_id',v_task.id,'employee_id',p_employee_id);
exception when unique_violation then return jsonb_build_object('ok',false,'code','duplicate_task');
end; $$;
drop function if exists public.owner_update_assigned_task(uuid,uuid,date,text,boolean,boolean,boolean,integer,text);
create or replace function public.owner_update_assigned_task(p_task_id uuid,p_employee_id uuid,p_task_date date,p_title text,p_is_required boolean,p_requires_photo boolean,p_requires_note boolean,p_sort_order integer,p_notes text default null,p_response_type text default 'completion')
returns jsonb language sql security invoker set search_path='' as $$ select private.owner_update_assigned_task_impl((select auth.uid()),p_task_id,p_employee_id,p_task_date,p_title,p_is_required,p_requires_photo,p_requires_note,p_sort_order,p_notes,p_response_type); $$;
revoke all on function private.owner_update_assigned_task_impl(uuid,uuid,uuid,date,text,boolean,boolean,boolean,integer,text,text) from public,anon;
grant execute on function private.owner_update_assigned_task_impl(uuid,uuid,uuid,date,text,boolean,boolean,boolean,integer,text,text) to authenticated;
revoke all on function public.owner_update_assigned_task(uuid,uuid,date,text,boolean,boolean,boolean,integer,text,text) from public,anon;
grant execute on function public.owner_update_assigned_task(uuid,uuid,date,text,boolean,boolean,boolean,integer,text,text) to authenticated;
