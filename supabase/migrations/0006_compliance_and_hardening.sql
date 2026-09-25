-- Curlywave OS — security hardening + privacy/DPDP compliance
-- 1) Admin bootstrap only while no active admin exists (self-signups are not email-verified).
-- 2) Record consent (version + time) and deletion requests on profiles.
-- 3) Employees can't reassign tasks or move them to other people's clients.
-- 4) Public business/legal details for the Privacy, Terms and Cookie pages (admin-editable).

update public.app_settings
   set value = '["anmol.curlywave@gmail.com", "evocartoonz@gmail.com"]'::jsonb
 where key = 'admin_bootstrap_emails';

alter table public.profiles
  add column if not exists consent_version text,
  add column if not exists consent_at timestamptz,
  add column if not exists deletion_requested_at timestamptz;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  r public.user_role;
  boot jsonb;
  cv text := nullif(new.raw_user_meta_data ->> 'consent_version', '');
begin
  select value into boot from public.app_settings where key = 'admin_bootstrap_emails';
  if boot is not null and boot ? lower(new.email)
     and not exists (select 1 from public.profiles p where p.role = 'admin' and p.is_active) then
    r := 'admin';
  else
    r := coalesce(nullif(new.raw_app_meta_data ->> 'role', '')::public.user_role, 'pending');
  end if;
  insert into public.profiles (id, email, full_name, role, consent_version, consent_at)
  values (new.id, lower(new.email), coalesce(new.raw_user_meta_data ->> 'full_name', ''), r,
          cv, case when cv is not null then now() end);
  return new;
end $$;

-- Users may record their own consent / deletion request; the server sets the timestamps.
create or replace function public.guard_profile_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.consent_version is distinct from old.consent_version then
    new.consent_at := case when new.consent_version is null then null else now() end;
  end if;
  if coalesce(auth.role(), 'service_role') = 'service_role' then return new; end if;
  if not private.is_admin() then
    if new.role is distinct from old.role
       or new.is_active is distinct from old.is_active
       or new.email is distinct from old.email
       or new.designation is distinct from old.designation then
      raise exception 'Only admins can change role, status, email or designation';
    end if;
    if new.deletion_requested_at is distinct from old.deletion_requested_at then
      new.deletion_requested_at := case when new.deletion_requested_at is null then null else now() end;
    end if;
  end if;
  return new;
end $$;

create or replace function public.guard_task_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), 'service_role') = 'service_role' or private.is_admin() then return new; end if;
  if new.assignee_id is distinct from old.assignee_id and (new.client_id is null or not exists (
       select 1 from public.clients c where c.id = new.client_id and c.assigned_employee_id = auth.uid())) then
    raise exception 'Only admins can reassign this task';
  end if;
  if new.client_id is distinct from old.client_id and new.client_id is not null and not exists (
       select 1 from public.clients c where c.id = new.client_id and c.assigned_employee_id = auth.uid()) then
    raise exception 'You can only move tasks to your own clients';
  end if;
  if new.auto_generated is distinct from old.auto_generated or new.created_by is distinct from old.created_by then
    raise exception 'Only admins can change how a task was created';
  end if;
  return new;
end $$;
drop trigger if exists guard_task_update on public.tasks;
create trigger guard_task_update before update on public.tasks
  for each row execute function public.guard_task_update();

revoke execute on function public.guard_task_update(), public.guard_profile_update(), public.handle_new_user()
from public, anon, authenticated;

-- Business details shown on the public legal pages.
create table if not exists public.site_info (
  id int primary key default 1 check (id = 1),
  business_name text not null default 'Curlywave',
  legal_name text not null default '[FILL IN: registered business name]',
  address text not null default '[FILL IN: registered address]',
  contact_email text not null default '[FILL IN: contact email]',
  contact_phone text not null default '[FILL IN: contact phone]',
  grievance_officer text not null default '[FILL IN: grievance officer name]',
  grievance_email text not null default '[FILL IN: grievance officer email]',
  updated_at timestamptz not null default now()
);
insert into public.site_info (id) values (1) on conflict (id) do nothing;
alter table public.site_info enable row level security;
revoke all on public.site_info from anon, authenticated;
grant select on public.site_info to anon, authenticated;
grant update on public.site_info to authenticated;
drop policy if exists site_info_read on public.site_info;
create policy site_info_read on public.site_info for select to anon, authenticated using (true);
drop policy if exists site_info_write on public.site_info;
create policy site_info_write on public.site_info for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create trigger site_info_touch before update on public.site_info
  for each row execute function public.touch_updated_at();
