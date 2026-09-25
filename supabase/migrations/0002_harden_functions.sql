-- Move role helpers out of the public API schema; lock trigger functions.
create schema if not exists private;
grant usage on schema private to authenticated;

alter function public.is_admin() set schema private;
alter function public.is_staff() set schema private;
alter function public.my_role() set schema private;
revoke execute on function private.is_admin(), private.is_staff(), private.my_role() from public, anon;
grant execute on function private.is_admin(), private.is_staff(), private.my_role() to authenticated;

create or replace function public.guard_profile_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    if new.role is distinct from old.role
       or new.is_active is distinct from old.is_active
       or new.email is distinct from old.email
       or new.designation is distinct from old.designation then
      raise exception 'Only admins can change role, status, email or designation';
    end if;
  end if;
  return new;
end $$;

create or replace function public.guard_client_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    if new.assigned_employee_id is distinct from old.assigned_employee_id
       or new.portal_user_id is distinct from old.portal_user_id
       or new.client_code is distinct from old.client_code then
      raise exception 'Only admins can change client code, assignment or portal login';
    end if;
  end if;
  return new;
end $$;

revoke execute on function
  public.guard_profile_update(), public.guard_client_update(),
  public.client_stage_before(), public.client_stage_after(), public.client_reassign_after(),
  public.task_status_after(), public.task_status_before(), public.touch_updated_at(),
  public.handle_new_user()
from public, anon, authenticated;
