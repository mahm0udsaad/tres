-- Supervisor-scoped staff provisioning.
--
-- The owner console (service role) creates branches and supervisor accounts.
-- Supervisors then provision non-privileged staff for THEIR OWN branch only.
-- The Next.js server creates the bare auth.users record with the service role,
-- but the staff profile is registered through the RPC below running under the
-- supervisor's own session, so the branch scope and role allowlist are
-- enforced inside the database — app code alone can never widen them.

create or replace function private.register_branch_staff_impl(
  p_user_id uuid,
  p_new_user_id uuid,
  p_full_name text,
  p_role public.staff_role,
  p_scheduled_start time
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.staff_profiles;
  v_name text;
begin
  v_profile := private.require_staff(p_user_id);
  if v_profile.role <> 'supervisor' then
    raise exception 'Only supervisors can register branch staff' using errcode = '42501';
  end if;
  if v_profile.branch_id is null then
    raise exception 'No branch is assigned to this account' using errcode = '23514';
  end if;
  if p_role not in ('employee', 'cleaning_staff', 'barista', 'kitchen_manager') then
    return jsonb_build_object(
      'ok', false,
      'code', 'role_not_allowed',
      'message', 'Supervisors can only create non-privileged staff roles.'
    );
  end if;
  v_name := nullif(trim(p_full_name), '');
  if v_name is null or length(v_name) > 120 then
    return jsonb_build_object('ok', false, 'code', 'name_invalid', 'message', 'A valid staff name is required.');
  end if;
  if p_new_user_id is null
    or not exists (select 1 from auth.users where id = p_new_user_id) then
    return jsonb_build_object('ok', false, 'code', 'auth_user_missing', 'message', 'The auth account was not found.');
  end if;
  if exists (select 1 from public.staff_profiles where user_id = p_new_user_id) then
    return jsonb_build_object('ok', false, 'code', 'profile_exists', 'message', 'A staff profile already exists for this account.');
  end if;

  insert into public.staff_profiles (user_id, full_name, role, branch_id, scheduled_start)
  values (p_new_user_id, v_name, p_role, v_profile.branch_id, p_scheduled_start);

  return jsonb_build_object(
    'ok', true,
    'user_id', p_new_user_id,
    'branch_id', v_profile.branch_id,
    'role', p_role
  );
end;
$$;

create or replace function private.set_branch_staff_active_impl(
  p_user_id uuid,
  p_target_user_id uuid,
  p_is_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.staff_profiles;
  v_target public.staff_profiles;
begin
  v_profile := private.require_staff(p_user_id);
  if v_profile.role <> 'supervisor' then
    raise exception 'Only supervisors can manage branch staff' using errcode = '42501';
  end if;
  if v_profile.branch_id is null then
    raise exception 'No branch is assigned to this account' using errcode = '23514';
  end if;
  if p_target_user_id = p_user_id then
    return jsonb_build_object('ok', false, 'code', 'cannot_target_self', 'message', 'You cannot change your own account.');
  end if;

  update public.staff_profiles
  set is_active = coalesce(p_is_active, false)
  where user_id = p_target_user_id
    and branch_id = v_profile.branch_id
    and role in ('employee', 'cleaning_staff', 'barista', 'kitchen_manager')
  returning * into v_target;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'code', 'target_not_allowed',
      'message', 'This account is outside your branch or has a protected role.'
    );
  end if;

  return jsonb_build_object('ok', true, 'user_id', v_target.user_id, 'is_active', v_target.is_active);
end;
$$;

create or replace function public.register_branch_staff(
  p_new_user_id uuid,
  p_full_name text,
  p_role public.staff_role,
  p_scheduled_start time
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.register_branch_staff_impl(
    (select auth.uid()),
    p_new_user_id,
    p_full_name,
    p_role,
    p_scheduled_start
  );
$$;

create or replace function public.set_branch_staff_active(
  p_target_user_id uuid,
  p_is_active boolean
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.set_branch_staff_active_impl(
    (select auth.uid()),
    p_target_user_id,
    p_is_active
  );
$$;

revoke all on function private.register_branch_staff_impl(uuid, uuid, text, public.staff_role, time) from public, anon;
revoke all on function private.set_branch_staff_active_impl(uuid, uuid, boolean) from public, anon;
grant execute on function private.register_branch_staff_impl(uuid, uuid, text, public.staff_role, time) to authenticated;
grant execute on function private.set_branch_staff_active_impl(uuid, uuid, boolean) to authenticated;

revoke all on function public.register_branch_staff(uuid, text, public.staff_role, time) from public, anon;
revoke all on function public.set_branch_staff_active(uuid, boolean) from public, anon;
grant execute on function public.register_branch_staff(uuid, text, public.staff_role, time) to authenticated;
grant execute on function public.set_branch_staff_active(uuid, boolean) to authenticated;
