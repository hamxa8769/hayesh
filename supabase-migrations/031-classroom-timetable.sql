-- 031 — Classroom core: weekly timetables → auto-generated classes,
-- double-booking guards, attendance, recordings with 30/90-day retention.
--
-- Classes are ordinary `meetings` rows (so the whole existing LiveKit stack —
-- tokens, waiting room, moderation, chat, recording — just works). A teacher
-- defines weekly `timetable_slots` and assigns enrolled students
-- (subscriptions) to them; `generate_class_meetings()` (called by the
-- /api/cron/classes job) materialises the next 14 days of classes and
-- invites every student whose tuition is active. Idempotent.

-- ── 1. Timetable ─────────────────────────────────────────────────────────

create table if not exists public.timetable_slots (
  id               uuid primary key default gen_random_uuid(),
  teacher_id       uuid not null references public.teachers(id) on delete cascade,
  title            text not null check (char_length(title) between 1 and 120),
  subject          text check (subject is null or char_length(subject) <= 80),
  weekday          smallint not null check (weekday between 0 and 6),   -- 0 = Sunday (extract(dow))
  start_time       time not null,
  duration_minutes smallint not null check (duration_minutes between 15 and 240),
  timezone         text not null default 'Asia/Karachi',
  is_group         boolean not null default false,
  active           boolean not null default true,
  starts_on        date not null default current_date,
  ends_on          date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint timetable_slots_same_day
    check (extract(epoch from start_time) / 60 + duration_minutes <= 1440),
  constraint timetable_slots_dates check (ends_on is null or ends_on >= starts_on)
);
create index if not exists idx_timetable_slots_teacher on public.timetable_slots (teacher_id, weekday);

create table if not exists public.timetable_slot_members (
  slot_id         uuid not null references public.timetable_slots(id) on delete cascade,
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  created_at      timestamptz not null default now(),
  primary key (slot_id, subscription_id)
);
create index if not exists idx_timetable_slot_members_sub on public.timetable_slot_members (subscription_id);

-- Validate the timezone name once, at write time.
create or replace function public.timetable_slot_validate()
returns trigger language plpgsql set search_path = public as $$
begin
  perform now() at time zone new.timezone;   -- raises on an unknown zone
  new.updated_at := now();

  if new.active and exists (
    select 1 from public.timetable_slots s
    where s.teacher_id = new.teacher_id
      and s.id <> new.id
      and s.active
      and s.weekday = new.weekday
      and (s.ends_on is null or s.ends_on >= new.starts_on)
      and (new.ends_on is null or new.ends_on >= s.starts_on)
      and s.start_time < new.start_time + make_interval(mins => new.duration_minutes)
      and new.start_time < s.start_time + make_interval(mins => s.duration_minutes)
  ) then
    raise exception 'schedule_conflict: this time overlaps another class in your timetable'
      using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists trg_timetable_slot_validate on public.timetable_slots;
create trigger trg_timetable_slot_validate
  before insert or update on public.timetable_slots
  for each row execute function public.timetable_slot_validate();

-- A member must be one of this teacher's own enrolments; a private slot
-- holds exactly one student.
create or replace function public.timetable_member_validate()
returns trigger language plpgsql set search_path = public as $$
declare
  v_slot public.timetable_slots%rowtype;
begin
  select * into v_slot from public.timetable_slots where id = new.slot_id;
  if not exists (
    select 1 from public.subscriptions sub
    where sub.id = new.subscription_id and sub.teacher_id = v_slot.teacher_id
  ) then
    raise exception 'invalid_member: that student is not enrolled with this teacher' using errcode = 'P0001';
  end if;
  if not v_slot.is_group and exists (
    select 1 from public.timetable_slot_members m
    where m.slot_id = new.slot_id and m.subscription_id <> new.subscription_id
  ) then
    raise exception 'private_slot_full: a private class has exactly one student' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists trg_timetable_member_validate on public.timetable_slot_members;
create trigger trg_timetable_member_validate
  before insert or update on public.timetable_slot_members
  for each row execute function public.timetable_member_validate();

alter table public.timetable_slots enable row level security;
alter table public.timetable_slot_members enable row level security;

-- Reads: the teacher, parents enrolled in the slot, admins. Writes go
-- through /api/timetable (service role) so validation lives in one place.
drop policy if exists "timetable read" on public.timetable_slots;
create policy "timetable read" on public.timetable_slots for select to authenticated using (
  get_user_role() = 'admin'
  or exists (select 1 from public.teachers t where t.id = teacher_id and t.user_id = auth.uid())
  or exists (
    select 1 from public.timetable_slot_members m
    join public.subscriptions sub on sub.id = m.subscription_id
    where m.slot_id = timetable_slots.id and sub.parent_id = auth.uid()
  )
);
drop policy if exists "timetable members read" on public.timetable_slot_members;
create policy "timetable members read" on public.timetable_slot_members for select to authenticated using (
  get_user_role() = 'admin'
  or exists (
    select 1 from public.timetable_slots s join public.teachers t on t.id = s.teacher_id
    where s.id = slot_id and t.user_id = auth.uid()
  )
  or exists (select 1 from public.subscriptions sub where sub.id = subscription_id and sub.parent_id = auth.uid())
);
revoke insert, update, delete on public.timetable_slots, public.timetable_slot_members from anon, authenticated;

-- ── 2. Meetings become classes ───────────────────────────────────────────

alter table public.meetings add column if not exists timetable_slot_id uuid
  references public.timetable_slots(id) on delete set null;
alter table public.meetings add column if not exists reminder_sent_at timestamptz;
alter table public.meetings add column if not exists started_at timestamptz;
alter table public.meetings add column if not exists ended_at timestamptz;

create unique index if not exists meetings_timetable_occurrence
  on public.meetings (timetable_slot_id, scheduled_at) where timetable_slot_id is not null;
create index if not exists idx_meetings_organizer_scheduled
  on public.meetings (organizer_id, scheduled_at);
create index if not exists idx_meetings_reminder_due
  on public.meetings (scheduled_at) where status = 'scheduled' and reminder_sent_at is null;

alter table public.meetings drop constraint if exists meetings_status_check;
alter table public.meetings add constraint meetings_status_check
  check (status in ('scheduled', 'live', 'completed', 'cancelled', 'no_show_teacher', 'no_show_student'));

-- Double-booking guard for the HOST of any meeting/class and for demo
-- lessons. A trigger (not an exclusion constraint) so historic overlapping
-- rows on a live database don't block this migration; an advisory lock per
-- host serialises concurrent bookings.
create or replace function public.host_has_conflict(
  p_host uuid, p_start timestamptz, p_minutes int, p_ignore_meeting uuid, p_ignore_demo uuid
) returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.meetings m
    where m.organizer_id = p_host
      and m.id is distinct from p_ignore_meeting
      and m.status in ('scheduled', 'live')
      and tstzrange(m.scheduled_at, m.scheduled_at + make_interval(mins => coalesce(m.duration_minutes, 30)), '[)')
          && tstzrange(p_start, p_start + make_interval(mins => p_minutes), '[)')
  ) or exists (
    select 1 from public.demo_bookings d
    join public.teachers t on t.id = d.teacher_id
    where t.user_id = p_host
      and d.id is distinct from p_ignore_demo
      and d.status in ('pending', 'confirmed')
      and tstzrange(d.scheduled_at, d.scheduled_at + make_interval(mins => coalesce(d.duration_mins, 30)), '[)')
          && tstzrange(p_start, p_start + make_interval(mins => p_minutes), '[)')
  );
$$;
revoke all on function public.host_has_conflict(uuid, timestamptz, int, uuid, uuid) from public, anon, authenticated;

create or replace function public.meetings_no_double_booking()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status not in ('scheduled', 'live') then return new; end if;
  if tg_op = 'UPDATE'
     and new.scheduled_at = old.scheduled_at
     and new.duration_minutes is not distinct from old.duration_minutes
     and new.organizer_id = old.organizer_id
     and old.status in ('scheduled', 'live') then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtext('host:' || new.organizer_id::text));
  if public.host_has_conflict(new.organizer_id, new.scheduled_at, coalesce(new.duration_minutes, 30), new.id, null) then
    raise exception 'schedule_conflict: the host already has a class or demo at that time' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists trg_meetings_no_double_booking on public.meetings;
create trigger trg_meetings_no_double_booking
  before insert or update on public.meetings
  for each row execute function public.meetings_no_double_booking();

create or replace function public.demo_bookings_no_double_booking()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_host uuid;
begin
  if new.status not in ('pending', 'confirmed') then return new; end if;
  if tg_op = 'UPDATE'
     and new.scheduled_at = old.scheduled_at
     and new.duration_mins is not distinct from old.duration_mins
     and old.status in ('pending', 'confirmed') then
    return new;
  end if;
  select user_id into v_host from public.teachers where id = new.teacher_id;
  if v_host is null then return new; end if;
  perform pg_advisory_xact_lock(hashtext('host:' || v_host::text));
  if public.host_has_conflict(v_host, new.scheduled_at, coalesce(new.duration_mins, 30), null, new.id) then
    raise exception 'schedule_conflict: the teacher is not free at that time — please pick another slot' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists trg_demo_bookings_no_double_booking on public.demo_bookings;
create trigger trg_demo_bookings_no_double_booking
  before insert or update on public.demo_bookings
  for each row execute function public.demo_bookings_no_double_booking();

-- ── 3. Attendance (written by the LiveKit webhook) ───────────────────────

create table if not exists public.class_attendance (
  id          bigint generated always as identity primary key,
  meeting_id  uuid not null references public.meetings(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  joined_at   timestamptz not null,
  left_at     timestamptz,
  lk_event_id text unique,
  created_at  timestamptz not null default now()
);
create index if not exists idx_class_attendance_meeting on public.class_attendance (meeting_id, profile_id);
create index if not exists idx_class_attendance_profile on public.class_attendance (profile_id, joined_at desc);

alter table public.class_attendance enable row level security;
drop policy if exists "attendance read" on public.class_attendance;
create policy "attendance read" on public.class_attendance for select to authenticated using (
  profile_id = auth.uid()
  or get_user_role() = 'admin'
  or exists (select 1 from public.meetings m where m.id = meeting_id and m.organizer_id = auth.uid())
);
revoke insert, update, delete on public.class_attendance from anon, authenticated;

-- ── 4. Recordings with retention ─────────────────────────────────────────

alter table public.teachers add column if not exists recording_retention_days smallint
  check (recording_retention_days is null or recording_retention_days in (30, 90));

insert into public.platform_settings (key, value)
values ('recording_retention_days', '30')
on conflict (key) do nothing;

create table if not exists public.meeting_recordings (
  id               uuid primary key default gen_random_uuid(),
  meeting_id       uuid not null references public.meetings(id) on delete cascade,
  egress_id        text not null unique,
  storage_key      text,
  status           text not null default 'recording'
                   check (status in ('recording', 'ready', 'failed', 'deleted')),
  duration_seconds integer,
  size_bytes       bigint,
  started_at       timestamptz not null default now(),
  ended_at         timestamptz,
  expires_at       timestamptz,
  deleted_at       timestamptz,
  created_at       timestamptz not null default now()
);
create index if not exists idx_meeting_recordings_meeting on public.meeting_recordings (meeting_id);
create index if not exists idx_meeting_recordings_expiry
  on public.meeting_recordings (expires_at) where status = 'ready';

alter table public.meeting_recordings enable row level security;
drop policy if exists "recordings read" on public.meeting_recordings;
create policy "recordings read" on public.meeting_recordings for select to authenticated using (
  get_user_role() = 'admin'
  or exists (
    select 1 from public.meetings m
    where m.id = meeting_id
      and (m.organizer_id = auth.uid() or m.participant_id = auth.uid() or public.user_invited_to_meeting(m.id))
  )
);
revoke insert, update, delete on public.meeting_recordings from anon, authenticated;

-- Retention for a meeting: the host teacher's override, else the platform
-- default (30 or 90 days).
create or replace function public.recording_retention_days_for(p_meeting uuid)
returns integer language sql stable security definer set search_path = public as $$
  select coalesce(
    (select t.recording_retention_days from public.meetings m
       join public.teachers t on t.user_id = m.organizer_id
      where m.id = p_meeting),
    (select case when (value #>> '{}') in ('30', '90') then (value #>> '{}')::int end
       from public.platform_settings where key = 'recording_retention_days'),
    30
  );
$$;
revoke all on function public.recording_retention_days_for(uuid) from public, anon, authenticated;

-- ── 5. Class generation (called by /api/cron/classes via RPC) ────────────

create or replace function public.generate_class_meetings(p_days integer default 14)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot      record;
  v_day       date;
  v_start     timestamptz;
  v_meeting   uuid;
  v_created   integer := 0;
  v_conflicts integer := 0;
  v_cancelled integer := 0;
  v_private_parent uuid;
begin
  if p_days < 1 or p_days > 60 then
    raise exception 'p_days must be between 1 and 60';
  end if;

  for v_slot in
    select s.*, t.user_id as host_id
    from public.timetable_slots s
    join public.teachers t on t.id = s.teacher_id
    where s.active and t.status = 'approved'
  loop
    -- Parents with an ACTIVE enrolment in this slot.
    if not exists (
      select 1 from public.timetable_slot_members m
      join public.subscriptions sub on sub.id = m.subscription_id
      where m.slot_id = v_slot.id and sub.status = 'active'
    ) then
      continue;
    end if;

    select sub.parent_id into v_private_parent
    from public.timetable_slot_members m
    join public.subscriptions sub on sub.id = m.subscription_id
    where m.slot_id = v_slot.id and sub.status = 'active'
    order by m.created_at limit 1;

    for v_day in
      select d::date from generate_series(current_date, current_date + p_days, interval '1 day') d
    loop
      continue when extract(dow from v_day) <> v_slot.weekday;
      continue when v_day < v_slot.starts_on;
      continue when v_slot.ends_on is not null and v_day > v_slot.ends_on;

      v_start := (v_day + v_slot.start_time) at time zone v_slot.timezone;
      continue when v_start <= now();

      -- Already generated? Reuse it (BEFORE-INSERT triggers fire before
      -- ON CONFLICT, so the double-booking guard would see the row itself).
      select id into v_meeting from public.meetings
      where timetable_slot_id = v_slot.id and scheduled_at = v_start;

      if v_meeting is null then
      begin
        insert into public.meetings (
          organizer_id, participant_id, context, related_id, title, agenda,
          scheduled_at, duration_minutes, status, is_group, waiting_room, timetable_slot_id
        ) values (
          v_slot.host_id,
          case when v_slot.is_group then null else v_private_parent end,
          'tutoring', v_slot.id, v_slot.title, v_slot.subject,
          v_start, v_slot.duration_minutes, 'scheduled', v_slot.is_group, false, v_slot.id
        )
        on conflict (timetable_slot_id, scheduled_at) where timetable_slot_id is not null do nothing
        returning id into v_meeting;
      exception when sqlstate 'P0001' then
        v_conflicts := v_conflicts + 1;   -- host already busy (e.g. a demo); skip this occurrence
        v_meeting := null;
        continue;
      end;

      if v_meeting is not null then
        v_created := v_created + 1;
      else
        select id into v_meeting from public.meetings
        where timetable_slot_id = v_slot.id and scheduled_at = v_start;
      end if;
      end if;

      -- A cancelled occurrence (teacher cancelled that one class) stays cancelled.
      continue when v_meeting is null
        or (select status from public.meetings where id = v_meeting) <> 'scheduled';

      -- (Re)invite every active student; group classes rely on invitations.
      insert into public.meeting_invitations (meeting_id, invitee_id, invited_by, status)
      select v_meeting, sub.parent_id, v_slot.host_id, 'accepted'
      from public.timetable_slot_members m
      join public.subscriptions sub on sub.id = m.subscription_id
      where m.slot_id = v_slot.id and sub.status = 'active'
      on conflict (meeting_id, invitee_id) do nothing;
    end loop;
  end loop;

  -- Lapsed tuition: drop the student from FUTURE classes only.
  delete from public.meeting_invitations i
  using public.meetings m
  where i.meeting_id = m.id
    and m.timetable_slot_id is not null
    and m.status = 'scheduled'
    and m.scheduled_at > now()
    and not exists (
      select 1 from public.timetable_slot_members tm
      join public.subscriptions sub on sub.id = tm.subscription_id
      where tm.slot_id = m.timetable_slot_id and sub.parent_id = i.invitee_id and sub.status = 'active'
    );

  -- Future classes of a paused slot (slots are deactivated, never hard-
  -- deleted, so history and attendance survive), or with nobody left, are
  -- cancelled. Manually created meetings are never touched.
  with dead as (
    update public.meetings m set status = 'cancelled', updated_at = now()
    where m.timetable_slot_id is not null
      and m.status = 'scheduled'
      and m.scheduled_at > now()
      and (
        not exists (select 1 from public.timetable_slots s where s.id = m.timetable_slot_id and s.active)
        or not exists (select 1 from public.meeting_invitations i where i.meeting_id = m.id)
      )
    returning 1
  )
  select count(*) into v_cancelled from dead;

  return jsonb_build_object('created', v_created, 'conflicts', v_conflicts, 'cancelled', v_cancelled);
end;
$$;

revoke all on function public.generate_class_meetings(integer) from public, anon, authenticated;

-- ── 6. Schedule: classes job every 10 minutes (reminders + generation) ───
select cron.schedule('hayesh-classes', '*/10 * * * *', $$select public.call_app_cron('/api/cron/classes')$$);
