-- ============================================================
-- MIGRATION 009 — Storage + a place to keep teacher documents
--
-- Adds:
--   * teachers.documents  jsonb  — references to uploaded ID / qualification
--     files (the schema had nowhere to persist these).
--   * a PUBLIC "teacher-photos" bucket (profile photos, shown on profiles)
--   * a PRIVATE "teacher-documents" bucket (KYC / ID / certificates)
--   * storage RLS so a user reads/writes only their own folder
--     (path convention: "<auth.uid()>/<filename>"), and admins can read all.
--
-- Run once in the Supabase SQL Editor.
-- ============================================================

alter table public.teachers
  add column if not exists documents jsonb default '[]';

-- Let a teacher write their own documents column too (append references).
-- Extends the update grant already set in earlier migrations.
grant update (documents) on public.teachers to authenticated;

-- ── Buckets ─────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('teacher-photos', 'teacher-photos', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('teacher-documents', 'teacher-documents', false)
on conflict (id) do nothing;

-- ── teacher-photos (public read, owner write) ───────────────
drop policy if exists "teacher-photos public read" on storage.objects;
create policy "teacher-photos public read"
  on storage.objects for select
  using (bucket_id = 'teacher-photos');

drop policy if exists "teacher-photos owner write" on storage.objects;
create policy "teacher-photos owner write"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'teacher-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "teacher-photos owner update" on storage.objects;
create policy "teacher-photos owner update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'teacher-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── teacher-documents (private: owner + admin only) ─────────
drop policy if exists "teacher-documents owner read" on storage.objects;
create policy "teacher-documents owner read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'teacher-documents'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.get_user_role() = 'admin'
    )
  );

drop policy if exists "teacher-documents owner write" on storage.objects;
create policy "teacher-documents owner write"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'teacher-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
