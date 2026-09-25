-- Guards: let the server (service role / direct SQL) through; enforce only for signed-in users.
create or replace function public.guard_profile_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), 'service_role') = 'service_role' then return new; end if;
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
  if coalesce(auth.role(), 'service_role') = 'service_role' then return new; end if;
  if not private.is_admin() then
    if new.assigned_employee_id is distinct from old.assigned_employee_id
       or new.portal_user_id is distinct from old.portal_user_id
       or new.client_code is distinct from old.client_code then
      raise exception 'Only admins can change client code, assignment or portal login';
    end if;
  end if;
  return new;
end $$;

revoke execute on function public.guard_profile_update(), public.guard_client_update()
from public, anon, authenticated;
