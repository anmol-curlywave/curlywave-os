-- Client portal: only reveal the content plan from client review onwards, and the Drive folder from delivery onwards.
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
         case when s.position >= 7 then c.drive_folder_url end,
         case when s.position >= 4 then c.content_plan_url end,
         e.full_name
  from public.clients c
  join public.stage_settings s on s.stage = c.stage
  left join public.profiles e on e.id = c.assigned_employee_id
  where c.portal_user_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active and p.role = 'client')
$$;
revoke execute on function public.my_projects() from public, anon;
grant execute on function public.my_projects() to authenticated;
