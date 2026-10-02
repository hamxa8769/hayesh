#!/usr/bin/env bash
# Rebuilds the LOCAL Supabase database from supabase-schema.sql + every
# migration, in order — exactly what an operator runs in the SQL editor.
set -euo pipefail
DB_URL="${E2E_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
case "$DB_URL" in
  *127.0.0.1*|*localhost*) ;;
  *) echo "Refusing to reset a non-local database" >&2; exit 1 ;;
esac
psql "$DB_URL" -q -c "drop schema public cascade; create schema public; grant all on schema public to postgres, anon, authenticated, service_role;"
psql "$DB_URL" -q -c "alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role; alter default privileges in schema public grant all on functions to postgres, anon, authenticated, service_role; alter default privileges in schema public grant all on sequences to postgres, anon, authenticated, service_role;"
psql "$DB_URL" -q -c "set session_replication_role = replica; delete from storage.objects; delete from storage.buckets;"
psql "$DB_URL" -v ON_ERROR_STOP=1 -q -1 -f supabase-schema.sql
for f in supabase-migrations/*.sql; do
  echo "→ $f"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -q -1 -f "$f"
done
echo "Local database ready."
