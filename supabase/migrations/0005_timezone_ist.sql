-- "Today" and deadlines follow India time, not UTC.
alter database postgres set timezone to 'Asia/Kolkata';
alter role authenticator set timezone to 'Asia/Kolkata';
alter role authenticated set timezone to 'Asia/Kolkata';
alter role service_role set timezone to 'Asia/Kolkata';
notify pgrst, 'reload config';
