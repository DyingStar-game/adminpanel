-- Empties minikube's `social` database before `make reset-social` restarts the service, which
-- then recreates its tables. Same SQL as `social/scripts/reset-db.mjs` (DyingStar-game/services):
-- every table, sequence and view of `public`, and the `drizzle` migrations schema.
drop schema if exists drizzle cascade;
do $$ declare r record; begin
  for r in (select tablename from pg_tables where schemaname = 'public') loop
    execute 'drop table if exists public.' || quote_ident(r.tablename) || ' cascade';
  end loop;
  for r in (select sequencename from pg_sequences where schemaname = 'public') loop
    execute 'drop sequence if exists public.' || quote_ident(r.sequencename) || ' cascade';
  end loop;
  for r in (select table_name from information_schema.views where table_schema = 'public') loop
    execute 'drop view if exists public.' || quote_ident(r.table_name) || ' cascade';
  end loop;
end $$;
