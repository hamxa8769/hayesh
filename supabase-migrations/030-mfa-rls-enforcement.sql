-- 030 — Enforce two-factor at the DATABASE layer, not just in middleware.
--
-- Middleware stops an admin with an aal1 session (password only) from using
-- /admin pages and /api/admin routes. But admin dashboards also read/write
-- some tables straight from the browser with the user's JWT, which never
-- passes through those routes. A stolen password must not unlock that path.
--
-- Rule (Supabase's recommended pattern): if a user HAS a verified MFA
-- factor, every request they make must carry an aal2 JWT. Users without a
-- factor (all parents, teachers, sellers, buyers today) are unaffected.
-- Implemented as a RESTRICTIVE policy, so it is AND-ed with every existing
-- permissive policy on each RLS-enabled table in `public` and on storage.
--
-- The service role bypasses RLS, so server routes are unaffected (they are
-- gated by middleware instead). Re-run this migration after creating new
-- tables so they get the policy too. Idempotent.

create or replace function public.mfa_satisfied()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or not exists (
        select 1 from auth.mfa_factors f
        where f.user_id = auth.uid() and f.status = 'verified'
      );
$$;

revoke all on function public.mfa_satisfied() from public;
grant execute on function public.mfa_satisfied() to anon, authenticated;

do $$
declare
  t record;
begin
  for t in
    select schemaname, tablename
    from pg_tables
    where rowsecurity
      and (schemaname = 'public' or (schemaname = 'storage' and tablename = 'objects'))
  loop
    execute format('drop policy if exists mfa_aal2_if_enrolled on %I.%I', t.schemaname, t.tablename);
    execute format(
      'create policy mfa_aal2_if_enrolled on %I.%I as restrictive for all to authenticated '
      || 'using ((select public.mfa_satisfied())) with check ((select public.mfa_satisfied()))',
      t.schemaname, t.tablename
    );
  end loop;
end $$;
