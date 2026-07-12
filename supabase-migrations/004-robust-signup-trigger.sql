-- ============================================================
-- MIGRATION 004 — Fix signup 500 ("Database error saving new user")
--
-- Supabase Auth returns HTTP 500 from /auth/v1/signup when a trigger
-- on auth.users throws. This replaces the new-user trigger with an
-- exception-SAFE version that:
--   * whitelists the role from signup metadata (anything not
--     teacher/parent/seller/buyer — including "admin" — becomes buyer),
--   * fills the NOT NULL profile columns safely,
--   * NEVER blocks the signup: if the profile insert fails for any
--     reason it is swallowed (the app also creates the profile via
--     middleware / /api/profile as a fallback).
--
-- Run once in the Supabase SQL Editor.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role  text;
  v_name  text;
begin
  v_role := coalesce(new.raw_user_meta_data ->> 'role', 'buyer');
  if v_role not in ('teacher', 'parent', 'seller', 'buyer') then
    v_role := 'buyer';
  end if;

  v_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    split_part(coalesce(new.email, ''), '@', 1),
    'New user'
  );

  begin
    insert into public.profiles (id, role, full_name, email)
    values (new.id, v_role::user_role, v_name, coalesce(new.email, ''))
    on conflict (id) do nothing;
  exception when others then
    -- Never fail the signup because of profile creation; log and move on.
    raise warning 'handle_new_user: could not create profile for %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

-- (Re)attach the trigger. Drop the common existing name first so this
-- migration is idempotent.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
