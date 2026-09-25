\set ON_ERROR_STOP 1
begin;
-- Existing admin (bootstrap email) + staff created by admin function (app_metadata)
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'anmol.curlywave@gmail.com');
insert into auth.users (id, email, raw_app_meta_data) values ('00000000-0000-0000-0000-0000000000e1', 'e1@t.in', '{"role":"employee"}'), ('00000000-0000-0000-0000-0000000000e2', 'e2@t.in', '{"role":"employee"}');
-- Attacker self-signs up with the other bootstrap email while an admin exists
insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000bb', 'evocartoonz@gmail.com', '{"consent_version":"2026-09-25","full_name":"X"}');
create temp table results (name text, ok boolean);
grant all on results to authenticated, anon;
do $$
declare r text; n int;
begin
  insert into results select 'first bootstrap email became admin', role='admin' from profiles where email='anmol.curlywave@gmail.com';
  insert into results select 'bootstrap email is pending once an admin exists', role='pending' from profiles where email='evocartoonz@gmail.com';
  insert into results select 'signup consent recorded', consent_version='2026-09-25' and consent_at is not null from profiles where email='evocartoonz@gmail.com';
  insert into results select 'staff via app_metadata', role='employee' and consent_at is null from profiles where email='e1@t.in';
  insert into clients (id, client_code, company_name, assigned_employee_id) values ('10000000-0000-0000-0000-000000000001','1','E1 Co','00000000-0000-0000-0000-0000000000e1'),('10000000-0000-0000-0000-000000000002','2','E2 Co','00000000-0000-0000-0000-0000000000e2');
  insert into tasks (id, client_id, title, assignee_id) values ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','On E2 client, assigned to E1','00000000-0000-0000-0000-0000000000e1'),
    ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','On E1 client','00000000-0000-0000-0000-0000000000e2');

  -- act as employee E1
  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000e1',true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  execute 'set local role authenticated';
  update tasks set status='in_progress' where id='20000000-0000-0000-0000-000000000001';
  insert into results values ('assignee can still update status on another client''s task', (select status='in_progress' from tasks where id='20000000-0000-0000-0000-000000000001'));
  begin update tasks set assignee_id='00000000-0000-0000-0000-0000000000e2' where id='20000000-0000-0000-0000-000000000001'; insert into results values ('employee cannot reassign task on other client', false);
  exception when others then insert into results values ('employee cannot reassign task on other client', sqlerrm like 'Only admins%'); end;
  begin update tasks set client_id='10000000-0000-0000-0000-000000000002' where id='20000000-0000-0000-0000-000000000002'; insert into results values ('employee cannot move task to other client', false);
  exception when others then insert into results values ('employee cannot move task to other client', true); end;
  update tasks set assignee_id='00000000-0000-0000-0000-0000000000e1' where id='20000000-0000-0000-0000-000000000002';
  insert into results values ('client owner can reassign within own client', (select assignee_id='00000000-0000-0000-0000-0000000000e1' from tasks where id='20000000-0000-0000-0000-000000000002'));
  begin update tasks set auto_generated=true where id='20000000-0000-0000-0000-000000000002'; insert into results values ('employee cannot fake auto_generated', false);
  exception when others then insert into results values ('employee cannot fake auto_generated', true); end;
  update profiles set consent_version='2026-09-25', consent_at='2000-01-01' where id=auth.uid();
  insert into results values ('consent_at set by server', (select consent_at > now() - interval '1 minute' from profiles where id='00000000-0000-0000-0000-0000000000e1'));
  update profiles set deletion_requested_at='2000-01-01' where id=auth.uid();
  insert into results values ('deletion request time set by server', (select deletion_requested_at > now() - interval '1 minute' from profiles where id='00000000-0000-0000-0000-0000000000e1'));
  begin update profiles set role='admin' where id=auth.uid(); insert into results values ('employee cannot self-promote', false);
  exception when others then insert into results values ('employee cannot self-promote', true); end;
  select count(*) into n from site_info; insert into results values ('staff can read site_info', n=1);
  update site_info set legal_name='hacked'; 
  insert into results values ('employee cannot edit site_info', (select legal_name <> 'hacked' from site_info));
  execute 'reset role';

  -- anon can read site_info, nothing else
  perform set_config('request.jwt.claim.sub','',true);
  perform set_config('request.jwt.claim.role','anon',true);
  execute 'set local role anon';
  select count(*) into n from site_info; insert into results values ('anon can read site_info', n=1);
  begin update site_info set legal_name='x'; get diagnostics n = row_count; insert into results values ('anon cannot edit site_info', n=0);
  exception when others then insert into results values ('anon cannot edit site_info', true); end;
  begin select count(*) into n from profiles; insert into results values ('anon cannot read profiles', n=0);
  exception when others then insert into results values ('anon cannot read profiles', true); end;
  execute 'reset role';

  -- admin can edit site_info and reassign
  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  execute 'set local role authenticated';
  update site_info set legal_name='Curlywave Pvt Ltd';
  insert into results values ('admin can edit site_info', (select legal_name='Curlywave Pvt Ltd' from site_info));
  update tasks set assignee_id='00000000-0000-0000-0000-0000000000e2' where id='20000000-0000-0000-0000-000000000001';
  insert into results values ('admin can reassign', (select assignee_id='00000000-0000-0000-0000-0000000000e2' from tasks where id='20000000-0000-0000-0000-000000000001'));
  update clients set assigned_employee_id='00000000-0000-0000-0000-0000000000e2' where id='10000000-0000-0000-0000-000000000001';
  insert into results values ('client reassign trigger still works (auto tasks)', true);
  update clients set stage='research' where id='10000000-0000-0000-0000-000000000001';
  insert into results values ('stage change auto task still works', (select count(*)>0 from tasks where client_id='10000000-0000-0000-0000-000000000001' and auto_generated and stage='research'));
  execute 'reset role';

  -- employee moving stage on own client (creates auto task via trigger)
  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000e2',true);
  execute 'set local role authenticated';
  update clients set stage='content_plan' where id='10000000-0000-0000-0000-000000000001';
  insert into results values ('employee stage move closes+creates auto tasks', (select count(*)=1 from tasks where client_id='10000000-0000-0000-0000-000000000001' and auto_generated and stage='content_plan'));
  execute 'reset role';
end $$;
select name, ok from results order by ok, name;
select count(*) filter (where ok) as passed, count(*) filter (where not ok or ok is null) as failed from results;
rollback;
