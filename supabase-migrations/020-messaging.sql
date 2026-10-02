-- ============================================================
-- MIGRATION 020 — In-app messaging between related parties.
--
-- WHY: public.messages existed with a bare conversation_id and NO RLS
-- policies and no conversations table. This adds conversations (created
-- ONLY by the server, only between parties with a real relationship:
-- gig order buyer<->seller, tuition parent<->teacher, or user<->support)
-- and locks messages down to the participants.
--
-- Writes: conversations are server-created (service role). Messages are
-- inserted by the participant's own session (RLS enforced); the only
-- column a user may update is messages.read, and only as the receiver.
--
-- OPERATOR: enable Realtime for public.messages if the publication
-- statement below is skipped (Dashboard -> Database -> Replication).
-- Run once in the Supabase SQL Editor. Idempotent / re-runnable.
-- ============================================================

-- ── conversations ───────────────────────────────────────────
create table if not exists public.conversations (
  id               uuid primary key default uuid_generate_v4(),
  participant_a    uuid not null references public.profiles(id) on delete cascade,
  participant_b    uuid not null references public.profiles(id) on delete cascade,
  context          text not null check (context in ('order', 'tuition', 'support')),
  gig_order_id     uuid references public.gig_orders(id) on delete set null,
  subscription_id  uuid references public.subscriptions(id) on delete set null,
  last_message_at  timestamptz default now(),
  created_at       timestamptz default now(),
  check (participant_a < participant_b)
);

create unique index if not exists conversations_unique_pair_context
  on public.conversations (
    participant_a, participant_b, context,
    coalesce(gig_order_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(subscription_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );
create index if not exists idx_conversations_participant_a on public.conversations(participant_a);
create index if not exists idx_conversations_participant_b on public.conversations(participant_b);

-- ── messages: FK (NOT VALID so legacy rows are not checked) + index ──
do $$ begin
  alter table public.messages
    add constraint messages_conversation_id_fkey
    foreign key (conversation_id) references public.conversations(id)
    on delete cascade not valid;
exception when duplicate_object then null;
end $$;

create index if not exists idx_messages_conversation_created
  on public.messages(conversation_id, created_at);

-- ── RLS: conversations (read-only for clients) ──────────────
alter table public.conversations enable row level security;

drop policy if exists "Participants read conversations" on public.conversations;
create policy "Participants read conversations"
  on public.conversations for select to authenticated
  using (
    participant_a = auth.uid()
    or participant_b = auth.uid()
    or public.get_user_role() = 'admin'
  );

revoke insert, update, delete on public.conversations from authenticated, anon;
grant select on public.conversations to authenticated;

-- ── RLS: messages ───────────────────────────────────────────
alter table public.messages enable row level security;

drop policy if exists "Participants read messages" on public.messages;
create policy "Participants read messages"
  on public.messages for select to authenticated
  using (
    public.get_user_role() = 'admin'
    or exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (c.participant_a = auth.uid() or c.participant_b = auth.uid())
    )
  );

drop policy if exists "Participants send messages" on public.messages;
create policy "Participants send messages"
  on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and char_length(content) between 1 and 4000
    and attachment_url is null  -- attachments aren't supported in chat yet
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (c.participant_a = auth.uid() or c.participant_b = auth.uid())
        and messages.receiver_id = case
          when c.participant_a = auth.uid() then c.participant_b
          else c.participant_a
        end
    )
  );

drop policy if exists "Receiver marks messages read" on public.messages;
create policy "Receiver marks messages read"
  on public.messages for update to authenticated
  using (receiver_id = auth.uid())
  with check (receiver_id = auth.uid());

-- Column-level: users may only flip `read`; no deletes.
revoke insert, update, delete on public.messages from authenticated, anon;
grant select, insert on public.messages to authenticated;
grant update (read) on public.messages to authenticated;

-- ── Trigger: bump conversations.last_message_at ─────────────
create or replace function public.bump_conversation_last_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
     set last_message_at = coalesce(new.created_at, now())
   where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists trg_bump_conversation_last_message on public.messages;
create trigger trg_bump_conversation_last_message
  after insert on public.messages
  for each row execute function public.bump_conversation_last_message();

-- ── Realtime ────────────────────────────────────────────────
do $$ begin
  alter publication supabase_realtime add table public.messages;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
