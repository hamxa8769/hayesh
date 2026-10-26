-- 029 — Database-driven scheduler (works on Supabase FREE + Vercel Hobby).
--
-- Vercel Hobby only runs crons once a day, but tuition renewals, escrow
-- auto-release, featured-listing expiry (and, next sprint, class reminders
-- and the background job worker) need to run more often. Supabase's
-- pg_cron + pg_net (available on every plan) call the app's protected cron
-- endpoints on a schedule instead. Vercel's daily cron in vercel.json stays
-- as a safety net. Every endpoint is idempotent, so overlapping runs are safe.
--
-- ONE-TIME OPERATOR STEP (Supabase → SQL Editor), after running this file:
--
--   select vault.create_secret('https://YOUR-DOMAIN', 'hayesh_app_url');
--   select vault.create_secret('<same value as CRON_SECRET in Vercel>', 'hayesh_cron_secret');
--
-- (No trailing slash on the URL. To change a value later:
--   select vault.update_secret(id, '<new value>') from vault.secrets where name = 'hayesh_cron_secret';)
-- Until both secrets exist the jobs run but do nothing (a NOTICE is logged).
--
-- Check runs:  select * from cron.job_run_details order by start_time desc limit 20;
-- HTTP results: select * from net._http_response order by created desc limit 20;

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

create or replace function public.call_app_cron(p_path text)
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url    text;
  v_secret text;
begin
  if p_path is null or p_path !~ '^/api/cron/[a-z0-9/_-]+$' then
    raise exception 'call_app_cron: invalid path %', p_path;
  end if;

  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'hayesh_app_url' limit 1;
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'hayesh_cron_secret' limit 1;

  if coalesce(v_url, '') = '' or coalesce(v_secret, '') = '' then
    raise notice 'call_app_cron: vault secrets hayesh_app_url / hayesh_cron_secret not set — skipping %', p_path;
    return null;
  end if;

  return net.http_get(
    url := rtrim(v_url, '/') || p_path,
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret),
    timeout_milliseconds := 55000
  );
end;
$$;

revoke all on function public.call_app_cron(text) from public, anon, authenticated;

-- cron.schedule(name, …) replaces an existing job with the same name, so
-- re-running this migration is safe.
-- Commerce: renewals, past-due marking, escrow auto-release, featured expiry.
select cron.schedule('hayesh-commerce', '7 * * * *', $$select public.call_app_cron('/api/cron/commerce')$$);

-- Keep pg_net's response log and cron history small on the free tier.
select cron.schedule(
  'hayesh-cron-housekeeping',
  '30 3 * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '7 days'$$
);
