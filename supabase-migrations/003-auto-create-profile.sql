-- ============================================================
-- MIGRATION 003 — Auto-create profile on user signup
-- Trigger function fires on auth.users INSERT and creates
-- a matching row in public.profiles with role + name from
-- the user's raw_user_meta_data (set during signUp()).
-- ============================================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, role, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'buyer')::user_role,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email
  );
  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger if it exists (idempotent)
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
