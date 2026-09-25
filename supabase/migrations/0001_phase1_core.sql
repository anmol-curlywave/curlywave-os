-- Curlywave OS — Phase 1: users, roles, clients, rules, tasks, activity, dashboard views

-- ---------- Types ----------
create type public.user_role as enum ('admin', 'employee', 'client', 'pending');
create type public.pipeline_stage as enum (
  'intake', 'research', 'content_plan', 'client_review', 'revisions',
  'generation', 'delivery', 'final_approval', 'posting', 'completed'
);
create type public.task_status as enum ('todo', 'in_progress', 'review', 'done', 'blocked');
create type public.task_priority as enum ('low', 'normal', 'high', 'urgent');

-- ---------- Settings ----------
create table public.app_settings (
  key text primary key,
  value jsonb not null
);
-- Emails that become admin automatically when they sign up.
insert into public.app_settings (key, value)
values ('admin_bootstrap_emails', '["evocartoonz@gmail.com"]'::jsonb);

create table public.stage_settings (
  stage public.pipeline_stage primary key,
  label text not null,
  position int not null unique,
  sla_days int not null default 2,
  task_title text
);
insert into public.stage_settings (stage, label, position, sla_days, task_title) values
  ('intake',         'Intake',              1, 2, 'Collect client information & assets'),
  ('research',       'Research',            2, 2, 'Research business, competitors & audience'),
  ('content_plan',   'Content plan',        3, 3, 'Build content plan & image prompts'),
  ('client_review',  'Client review',       4, 3, 'Follow up with client for plan approval'),
  ('revisions',      'Revisions',           5, 2, 'Review & apply client change requests'),
  ('generation',     'Image/Video creation',6, 5, 'Generate images & videos'),
  ('delivery',       'Delivery',            7, 1, 'Upload to Drive & share link with client'),
  ('final_approval', 'Final approval',      8, 3, 'Get client approval on creatives'),
  ('posting',        'Posting',             9, 90,'Schedule & monitor posting'),
  ('completed',      'Completed',          10, 0, null);

-- ---------- Profiles ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  phone text,
  designation text,
  role public.user_role not null default 'pending',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- Helper functions (security definer, fixed search_path) ----------
create or replace function public.my_role()
returns public.user_role language sql stable security definer set search_path = '' as $$
  select p.role from public.profiles p where p.id = auth.uid() and p.is_active
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select p.role = 'admin' from public.profiles p where p.id = auth.uid() and p.is_active), false)
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select p.role in ('admin', 'employee') from public.profiles p where p.id = auth.uid() and p.is_active), false)
$$;

-- New auth user -> profile. Role comes from app_metadata (only settable server-side),
-- bootstrap admin emails become admin, everyone else is 'pending' (no access).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  r public.user_role;
  boot jsonb;
begin
  select value into boot from public.app_settings where key = 'admin_bootstrap_emails';
  if boot is not null and boot ? lower(new.email) then
    r := 'admin';
  else
    r := coalesce(nullif(new.raw_app_meta_data ->> 'role', '')::public.user_role, 'pending');
  end if;
  insert into public.profiles (id, email, full_name, role)
  values (new.id, lower(new.email), coalesce(new.raw_user_meta_data ->> 'full_name', ''), r);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Non-admins can edit their own name/phone but never role/active/email.
create or replace function public.guard_profile_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    if new.role is distinct from old.role
       or new.is_active is distinct from old.is_active
       or new.email is distinct from old.email
       or new.designation is distinct from old.designation then
      raise exception 'Only admins can change role, status, email or designation';
    end if;
  end if;
  return new;
end $$;
create trigger guard_profile_update before update on public.profiles
  for each row execute function public.guard_profile_update();

-- ---------- Clients ----------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  client_code text not null unique,
  company_name text not null,
  contact_name text,
  email text,
  phone text,
  whatsapp text,
  industry text,
  city text,
  website text,
  instagram text,
  facebook text,
  linkedin text,
  youtube text,
  x_handle text,
  language text not null default 'English',
  plan_name text,
  static_posts int not null default 0,
  video_posts int not null default 0,
  carousel_posts int not null default 0,
  plan_start date,
  plan_end date,
  stage public.pipeline_stage not null default 'intake',
  stage_started_at timestamptz not null default now(),
  stage_due_date date,
  is_on_hold boolean not null default false,
  assigned_employee_id uuid references public.profiles (id) on delete set null,
  portal_user_id uuid references public.profiles (id) on delete set null,
  drive_folder_url text,
  content_plan_url text,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index clients_assigned_idx on public.clients (assigned_employee_id);
create index clients_portal_idx on public.clients (portal_user_id);
create index clients_created_by_idx on public.clients (created_by);

create table public.client_rules (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  rule text not null,
  category text not null default 'general',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index client_rules_client_idx on public.client_rules (client_id);
create index client_rules_created_by_idx on public.client_rules (created_by);

-- ---------- Tasks ----------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients (id) on delete cascade,
  title text not null,
  description text,
  stage public.pipeline_stage,
  assignee_id uuid references public.profiles (id) on delete set null,
  status public.task_status not null default 'todo',
  priority public.task_priority not null default 'normal',
  due_date date,
  completed_at timestamptz,
  auto_generated boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_client_idx on public.tasks (client_id);
create index tasks_assignee_idx on public.tasks (assignee_id);
create index tasks_created_by_idx on public.tasks (created_by);

-- ---------- Activity log ----------
create table public.activity_log (
  id bigint generated always as identity primary key,
  client_id uuid references public.clients (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete set null,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index activity_client_idx on public.activity_log (client_id, created_at desc);
create index activity_task_idx on public.activity_log (task_id);
create index activity_actor_idx on public.activity_log (actor_id);

-- ---------- Triggers: timestamps, guards, automation ----------
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;

create trigger clients_touch before update on public.clients
  for each row execute function public.touch_updated_at();
create trigger tasks_touch before update on public.tasks
  for each row execute function public.touch_updated_at();

-- Employees may update their clients' work fields, but not ownership fields.
create or replace function public.guard_client_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    if new.assigned_employee_id is distinct from old.assigned_employee_id
       or new.portal_user_id is distinct from old.portal_user_id
       or new.client_code is distinct from old.client_code then
      raise exception 'Only admins can change client code, assignment or portal login';
    end if;
  end if;
  return new;
end $$;
create trigger guard_client_update before update on public.clients
  for each row execute function public.guard_client_update();

-- Stage bookkeeping (before): start time + due date from SLA.
create or replace function public.client_stage_before()
returns trigger language plpgsql security definer set search_path = '' as $$
declare sla int;
begin
  if tg_op = 'INSERT' or new.stage is distinct from old.stage then
    select s.sla_days into sla from public.stage_settings s where s.stage = new.stage;
    new.stage_started_at := now();
    new.stage_due_date := case when new.stage = 'completed' then null
                               else current_date + coalesce(sla, 2) end;
  end if;
  return new;
end $$;
create trigger client_stage_before before insert or update of stage on public.clients
  for each row execute function public.client_stage_before();

-- Stage automation (after): close old auto tasks, open a task for the new stage, log it.
create or replace function public.client_stage_after()
returns trigger language plpgsql security definer set search_path = '' as $$
declare st record;
begin
  if tg_op = 'UPDATE' and new.stage is not distinct from old.stage then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    update public.tasks
       set status = 'done', completed_at = now()
     where client_id = new.id and auto_generated and stage = old.stage and status <> 'done';
  end if;

  select * into st from public.stage_settings s where s.stage = new.stage;
  if st.task_title is not null then
    insert into public.tasks (client_id, title, stage, assignee_id, due_date, auto_generated, created_by)
    values (new.id, st.task_title || ' — ' || new.company_name, new.stage,
            new.assigned_employee_id, new.stage_due_date, true, auth.uid());
  end if;

  insert into public.activity_log (client_id, actor_id, action, details)
  values (new.id, auth.uid(),
          case when tg_op = 'INSERT' then 'client_created' else 'stage_changed' end,
          jsonb_build_object('from', case when tg_op = 'UPDATE' then old.stage::text end, 'to', new.stage::text));
  return new;
end $$;
create trigger client_stage_after after insert or update of stage on public.clients
  for each row execute function public.client_stage_after();

-- Reassigning a client moves its open auto tasks to the new employee.
create or replace function public.client_reassign_after()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.assigned_employee_id is distinct from old.assigned_employee_id then
    update public.tasks set assignee_id = new.assigned_employee_id
     where client_id = new.id and auto_generated and status <> 'done';
    insert into public.activity_log (client_id, actor_id, action, details)
    values (new.id, auth.uid(), 'client_reassigned',
            jsonb_build_object('from', old.assigned_employee_id, 'to', new.assigned_employee_id));
  end if;
  return new;
end $$;
create trigger client_reassign_after after update of assigned_employee_id on public.clients
  for each row execute function public.client_reassign_after();

-- Task completion timestamp + log.
create or replace function public.task_status_before()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'done' and (tg_op = 'INSERT' or old.status <> 'done') then
    new.completed_at := coalesce(new.completed_at, now());
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;
  return new;
end $$;
create trigger task_status_before before insert or update of status on public.tasks
  for each row execute function public.task_status_before();

create or replace function public.task_status_after()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    insert into public.activity_log (client_id, task_id, actor_id, action, details)
    values (new.client_id, new.id, auth.uid(), 'task_status',
            jsonb_build_object('title', new.title, 'from', old.status::text, 'to', new.status::text));
  end if;
  return new;
end $$;
create trigger task_status_after after update of status on public.tasks
  for each row execute function public.task_status_after();

-- ---------- Row level security ----------
alter table public.app_settings enable row level security;
alter table public.stage_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.client_rules enable row level security;
alter table public.tasks enable row level security;
alter table public.activity_log enable row level security;

revoke all on all tables in schema public from anon;

-- app_settings: admin only
create policy app_settings_admin on public.app_settings for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- stage_settings: staff read, admin write
create policy stage_settings_read on public.stage_settings for select to authenticated
  using ((select public.is_staff()));
create policy stage_settings_write on public.stage_settings for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- profiles
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin())
         or ((select public.is_staff()) and role in ('admin', 'employee')));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()))
  with check (id = (select auth.uid()) or (select public.is_admin()));

-- clients: admin all; employee only assigned (no client portal access to raw table)
create policy clients_select on public.clients for select to authenticated
  using ((select public.is_admin()) or assigned_employee_id = (select auth.uid()));
create policy clients_insert on public.clients for insert to authenticated
  with check ((select public.is_admin()));
create policy clients_update on public.clients for update to authenticated
  using ((select public.is_admin()) or assigned_employee_id = (select auth.uid()))
  with check ((select public.is_admin()) or assigned_employee_id = (select auth.uid()));
create policy clients_delete on public.clients for delete to authenticated
  using ((select public.is_admin()));

-- client_rules: staff on their clients
create policy rules_select on public.client_rules for select to authenticated
  using ((select public.is_admin()) or exists (
    select 1 from public.clients c where c.id = client_id and c.assigned_employee_id = (select auth.uid())));
create policy rules_insert on public.client_rules for insert to authenticated
  with check ((select public.is_admin()) or exists (
    select 1 from public.clients c where c.id = client_id and c.assigned_employee_id = (select auth.uid())));
create policy rules_delete on public.client_rules for delete to authenticated
  using ((select public.is_admin()));

-- tasks
create policy tasks_select on public.tasks for select to authenticated
  using ((select public.is_admin()) or assignee_id = (select auth.uid()) or exists (
    select 1 from public.clients c where c.id = client_id and c.assigned_employee_id = (select auth.uid())));
create policy tasks_insert on public.tasks for insert to authenticated
  with check ((select public.is_admin()) or (
    (select public.is_staff()) and created_by = (select auth.uid()) and (
      client_id is null or exists (
        select 1 from public.clients c where c.id = client_id and c.assigned_employee_id = (select auth.uid())))));
create policy tasks_update on public.tasks for update to authenticated
  using ((select public.is_admin()) or assignee_id = (select auth.uid()) or exists (
    select 1 from public.clients c where c.id = client_id and c.assigned_employee_id = (select auth.uid())))
  with check ((select public.is_admin()) or assignee_id = (select auth.uid()) or exists (
    select 1 from public.clients c where c.id = client_id and c.assigned_employee_id = (select auth.uid())));
create policy tasks_delete on public.tasks for delete to authenticated
  using ((select public.is_admin()));

-- activity_log: read-only (written by triggers)
create policy activity_select on public.activity_log for select to authenticated
  using ((select public.is_admin()) or actor_id = (select auth.uid()) or exists (
    select 1 from public.clients c where c.id = client_id and c.assigned_employee_id = (select auth.uid())));

-- ---------- Views (run with the caller's permissions) ----------
create view public.client_overview with (security_invoker = true) as
select
  c.*,
  s.label as stage_label,
  s.position as stage_position,
  round((s.position - 1) * 100.0 / 9)::int as progress_pct,
  e.full_name as employee_name,
  coalesce(t.open_tasks, 0) as open_tasks,
  coalesce(t.overdue_tasks, 0) as overdue_tasks,
  (c.stage <> 'completed' and not c.is_on_hold and (
     c.stage_due_date < current_date
     or (c.plan_end is not null and c.plan_end < current_date)
     or coalesce(t.overdue_tasks, 0) > 0)) as is_delayed,
  case when c.stage_due_date is null then null else c.stage_due_date - current_date end as days_left
from public.clients c
join public.stage_settings s on s.stage = c.stage
left join public.profiles e on e.id = c.assigned_employee_id
left join lateral (
  select count(*) filter (where status <> 'done') as open_tasks,
         count(*) filter (where status <> 'done' and due_date < current_date) as overdue_tasks
  from public.tasks x where x.client_id = c.id
) t on true;

create view public.employee_workload with (security_invoker = true) as
select
  p.id, p.full_name, p.email, p.designation, p.role, p.is_active,
  (select count(*) from public.clients c where c.assigned_employee_id = p.id and c.stage <> 'completed') as active_clients,
  (select count(*) from public.tasks t where t.assignee_id = p.id and t.status <> 'done') as open_tasks,
  (select count(*) from public.tasks t where t.assignee_id = p.id and t.status = 'in_progress') as in_progress_tasks,
  (select count(*) from public.tasks t where t.assignee_id = p.id and t.status <> 'done' and t.due_date < current_date) as overdue_tasks,
  (select count(*) from public.tasks t where t.assignee_id = p.id and t.status = 'done' and t.completed_at > now() - interval '7 days') as done_last_7d
from public.profiles p
where p.role in ('admin', 'employee');

-- ---------- Client portal: limited, safe view of their own projects ----------
create or replace function public.my_projects()
returns table (
  id uuid, client_code text, company_name text, stage public.pipeline_stage, stage_label text,
  progress_pct int, plan_name text, plan_start date, plan_end date,
  drive_folder_url text, content_plan_url text, account_manager text
)
language sql stable security definer set search_path = '' as $$
  select c.id, c.client_code, c.company_name, c.stage, s.label,
         round((s.position - 1) * 100.0 / 9)::int,
         c.plan_name, c.plan_start, c.plan_end,
         c.drive_folder_url, c.content_plan_url, e.full_name
  from public.clients c
  join public.stage_settings s on s.stage = c.stage
  left join public.profiles e on e.id = c.assigned_employee_id
  where c.portal_user_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active and p.role = 'client')
$$;

revoke execute on function public.my_projects() from public, anon;
grant execute on function public.my_projects() to authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
