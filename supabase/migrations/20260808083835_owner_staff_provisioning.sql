-- Owner-only account provisioning. Auth users are created server-side by the
-- application, then this RPC atomically registers the branch-scoped profile.
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
    return jsonb_build_object('ok', false, 'code', 'branch_invalid', 'message', 'The selected branch was not found.');
  end if;
  if p_role not in ('supervisor', 'employee', 'cleaning_staff', 'barista', 'kitchen_manager') then
    return jsonb_build_object('ok', false, 'code', 'role_not_allowed', 'message', 'Owners can create supervisor and field staff accounts.');
  end if;
  v_name := nullif(trim(p_full_name), '');
  if v_name is null or length(v_name) > 120 then
    return jsonb_build_object('ok', false, 'code', 'name_invalid', 'message', 'A valid staff name is required.');
  end if;
  v_nationality := coalesce(nullif(trim(p_nationality), ''), 'Other');
  if v_nationality not in (
    'Kenya','Bangladesh','India','Pakistan','Philippines','Egypt','Sudan','Ethiopia',
    'Nepal','Sri Lanka','Yemen','Jordan','Indonesia','Uganda','Tanzania','Saudi Arabia','Other'
  ) then
    return jsonb_build_object('ok', false, 'code', 'nationality_invalid', 'message', 'Select a valid nationality.');
  end if;
  v_lang := case
    when v_nationality in ('Saudi Arabia', 'Egypt', 'Yemen', 'Sudan', 'Jordan') then 'ar'
    when v_nationality = 'Bangladesh' then 'bn'
    else 'en'
  end;
  if p_new_user_id is null or not exists (select 1 from auth.users where id = p_new_user_id) then
    return jsonb_build_object('ok', false, 'code', 'auth_user_missing', 'message', 'The auth account was not found.');
  end if;
  if exists (select 1 from public.staff_profiles where user_id = p_new_user_id) then
    return jsonb_build_object('ok', false, 'code', 'profile_exists', 'message', 'A staff profile already exists for this account.');
  end if;
  insert into public.staff_profiles (user_id, full_name, role, branch_id, scheduled_start, nationality, preferred_language)
  values (p_new_user_id, v_name, p_role, p_branch_id, p_scheduled_start, v_nationality, v_lang);
  return jsonb_build_object('ok', true, 'user_id', p_new_user_id, 'branch_id', p_branch_id, 'role', p_role, 'preferred_language', v_lang);
end;
$$;

create or replace function public.register_owner_staff(
  p_new_user_id uuid,
  p_full_name text,
  p_role public.staff_role,
  p_branch_id uuid,
  p_scheduled_start time,
  p_nationality text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.register_owner_staff_impl((select auth.uid()), p_new_user_id, p_full_name, p_role, p_branch_id, p_scheduled_start, p_nationality);
$$;

revoke all on function private.register_owner_staff_impl(uuid, uuid, text, public.staff_role, uuid, time, text) from public, anon;
grant execute on function private.register_owner_staff_impl(uuid, uuid, text, public.staff_role, uuid, time, text) to authenticated;
revoke all on function public.register_owner_staff(uuid, text, public.staff_role, uuid, time, text) from public, anon;
grant execute on function public.register_owner_staff(uuid, text, public.staff_role, uuid, time, text) to authenticated;
