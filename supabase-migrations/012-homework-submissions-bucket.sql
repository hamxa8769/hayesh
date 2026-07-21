-- ============================================================
-- MIGRATION 012 — Storage bucket for homework submissions
--
-- WHY: assignment submission was built text-only because no existing
-- bucket fits. teacher-documents is private to the UPLOADING owner, so a
-- teacher could never read a file a PARENT uploaded against their child's
-- homework — which is exactly who needs to read it. This adds a private
-- "homework-submissions" bucket whose RLS lets:
--   * a parent upload/read files for THEIR OWN child, and
--   * the ASSIGNED teacher read a submission for a child assigned to them,
--   * admins read everything.
--
-- Path convention: "<student_id>/<assignment_id>/<filename>". The first
-- path segment is the student id, which every policy keys off.
--
-- Run once in the Supabase SQL Editor. Idempotent / re-runnable.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('homework-submissions', 'homework-submissions', false)
on conflict (id) do nothing;

-- ── Parent uploads for their own child ──────────────────────
drop policy if exists "homework-submissions parent write" on storage.objects;
create policy "homework-submissions parent write"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'homework-submissions'
    and ((storage.foldername(name))[1])::uuid in (
      select s.id from public.students s where s.parent_id = auth.uid()
    )
  );

-- Parent may also update/replace and delete their own child's submissions
-- (re-upload before the teacher grades).
drop policy if exists "homework-submissions parent update" on storage.objects;
create policy "homework-submissions parent update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'homework-submissions'
    and ((storage.foldername(name))[1])::uuid in (
      select s.id from public.students s where s.parent_id = auth.uid()
    )
  );

drop policy if exists "homework-submissions parent delete" on storage.objects;
create policy "homework-submissions parent delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'homework-submissions'
    and ((storage.foldername(name))[1])::uuid in (
      select s.id from public.students s where s.parent_id = auth.uid()
    )
  );

-- ── Read: parent (own child), assigned teacher, or admin ────
drop policy if exists "homework-submissions read" on storage.objects;
create policy "homework-submissions read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'homework-submissions'
    and (
      public.get_user_role() = 'admin'
      or ((storage.foldername(name))[1])::uuid in (
        select s.id from public.students s where s.parent_id = auth.uid()
      )
      or ((storage.foldername(name))[1])::uuid in (
        select sr.student_id
        from public.student_requests sr
        join public.teachers t on t.id = sr.assigned_teacher_id
        where t.user_id = auth.uid()
      )
    )
  );
