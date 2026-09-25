# Database tests (local Postgres, no Supabase needed)

Runs every migration on a throwaway Postgres 16 with a tiny stand-in for Supabase's `auth` schema, then checks the security rules and triggers. Everything is rolled back.

```bash
D=/tmp/pgdata; mkdir -p $D && chown postgres $D
su postgres -c "/usr/lib/postgresql/16/bin/initdb -D $D -A trust -U postgres"
su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D $D -o '-k /tmp -p 5499' start"
psql -h /tmp -p 5499 -U postgres -f tests/db/auth-stub.sql
for f in supabase/migrations/*.sql; do sed 's/notify pgrst.*//' $f | psql -h /tmp -p 5499 -U postgres -v ON_ERROR_STOP=1; done
psql -h /tmp -p 5499 -U postgres -f tests/db/security.test.sql   # expect: failed = 0
```
