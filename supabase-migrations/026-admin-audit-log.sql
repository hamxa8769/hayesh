-- 026: append-only admin audit log (OWASP A09).
-- Idempotent. Server code writes via service role (logAdminAction);
-- browser-side admin writes are captured by audit_admin_browser_change().

create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_table text,
  target_id text,
  before jsonb,
  after jsonb,
  reason text,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_audit_log_created_at on public.admin_audit_log (created_at desc);
create index if not exists idx_admin_audit_log_actor on public.admin_audit_log (actor_id, created_at desc);
create index if not exists idx_admin_audit_log_target on public.admin_audit_log (target_table, target_id);

alter table public.admin_audit_log enable row level security;

drop policy if exists "Admins can read audit log" on public.admin_audit_log;
create policy "Admins can read audit log"
  on public.admin_audit_log for select
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Privileges: nobody writes through the API roles; service role may only insert/select.
revoke insert, update, delete, truncate on public.admin_audit_log from anon, authenticated;
revoke update, delete, truncate on public.admin_audit_log from service_role;
grant select on public.admin_audit_log to authenticated;
grant insert, select on public.admin_audit_log to service_role;

-- Append-only enforcement, even for the service role / table owner.
-- Sole exception: the FK "on delete set null" nulling actor_id when a profile is removed.
create or replace function public.admin_audit_log_immutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.actor_id is null
     and old.actor_id is not null
     and (to_jsonb(new) - 'actor_id') = (to_jsonb(old) - 'actor_id') then
    return new;
  end if;
  raise exception 'admin_audit_log is append-only (% blocked)', tg_op
    using errcode = 'insufficient_privilege';
end;
$$;

drop trigger if exists admin_audit_log_no_mutate on public.admin_audit_log;
create trigger admin_audit_log_no_mutate
  before update or delete on public.admin_audit_log
  for each row execute function public.admin_audit_log_immutable();

drop trigger if exists admin_audit_log_no_truncate on public.admin_audit_log;
create trigger admin_audit_log_no_truncate
  before truncate on public.admin_audit_log
  for each statement execute function public.admin_audit_log_immutable();

-- Browser-side admin writes (teachers, sellers, payouts) are audited by trigger.
-- Logs only when the caller is an authenticated admin; service-role writes
-- (auth.uid() is null) and ordinary users' own writes are skipped.
create or replace function public.audit_admin_browser_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_old jsonb;
  v_new jsonb;
  v_before jsonb;
  v_after jsonb;
  v_key text;
  v_target text;
  v_secret text := '(encrypted|ciphertext|account_number|account_reference|iban|password|secret|token)';
begin
  if v_uid is null then
    return coalesce(new, old);
  end if;
  if not exists (select 1 from public.profiles p where p.id = v_uid and p.role = 'admin') then
    return coalesce(new, old);
  end if;

  v_old := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new := case when tg_op in ('UPDATE', 'INSERT') then to_jsonb(new) end;

  -- Strip secret-bearing columns.
  if v_old is not null then
    for v_key in select jsonb_object_keys(v_old) loop
      if v_key ~* v_secret then v_old := v_old - v_key; end if;
    end loop;
  end if;
  if v_new is not null then
    for v_key in select jsonb_object_keys(v_new) loop
      if v_key ~* v_secret then v_new := v_new - v_key; end if;
    end loop;
  end if;

  if tg_op = 'UPDATE' then
    select coalesce(jsonb_object_agg(k, v_old -> k), '{}'::jsonb),
           coalesce(jsonb_object_agg(k, v_new -> k), '{}'::jsonb)
      into v_before, v_after
      from jsonb_object_keys(v_new) as k
      where (v_old -> k) is distinct from (v_new -> k);
    if v_after = '{}'::jsonb then
      return new;
    end if;
  else
    v_before := v_old;
    v_after := v_new;
  end if;

  v_target := coalesce(v_new ->> 'id', v_old ->> 'id');

  insert into public.admin_audit_log (actor_id, action, target_table, target_id, before, after)
  values (
    v_uid,
    case
      when tg_table_name = 'payouts' and tg_op = 'UPDATE' and v_after ? 'status'
        then 'payout.' || (v_after ->> 'status')
      when tg_table_name = 'sellers' and tg_op = 'UPDATE' and v_after ? 'status'
        then 'seller.' || (v_after ->> 'status')
      when tg_table_name = 'teachers' and tg_op = 'UPDATE' and v_after ? 'status'
        then 'teacher.' || (v_after ->> 'status')
      else tg_table_name || '.' || lower(tg_op) || '_browser'
    end,
    tg_table_name,
    v_target,
    v_before,
    v_after
  );
  return coalesce(new, old);
end;
$$;

revoke all on function public.audit_admin_browser_change() from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['teachers', 'sellers', 'payouts'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists audit_admin_browser_change on public.%I', t);
      execute format(
        'create trigger audit_admin_browser_change after insert or update or delete on public.%I
           for each row execute function public.audit_admin_browser_change()', t);
    end if;
  end loop;
end $$;
