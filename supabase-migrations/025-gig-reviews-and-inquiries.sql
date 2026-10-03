-- ============================================================
-- MIGRATION 025 — Gig reviews (with moderation + seller replies) and
-- pre-order "inquiry" conversations.
--
-- WHY: gig pages had no social proof (gigs.average_rating never moved) and
-- buyers could not ask a seller a question before ordering.
--
-- WHAT:
--   1. public.gig_reviews — one review per COMPLETED gig order, written by
--      the buyer through POST /api/gig-reviews (server, service role).
--      status: published | pending (awaiting admin approval) | hidden.
--      Browsers can only READ: published rows are public; the buyer, the
--      owning seller and admins can also read their non-published rows.
--   2. SECURITY DEFINER trigger recomputing average_rating / total_reviews
--      (PUBLISHED reviews only) on gigs and sellers. One-time backfill.
--   3. platform_settings: gig_reviews_enabled, gig_reviews_moderation.
--   4. conversations: gig_id + context 'inquiry' (buyer <-> gig seller,
--      before any order exists); unique index now includes gig_id.
--
-- Run once in the Supabase SQL Editor. Idempotent / re-runnable.
-- ============================================================

-- ── 1) gig_reviews ──────────────────────────────────────────
create table if not exists public.gig_reviews (
  id               uuid primary key default uuid_generate_v4(),
  gig_order_id     uuid not null unique references public.gig_orders(id) on delete cascade,
  gig_id           uuid not null references public.gigs(id) on delete cascade,
  seller_id        uuid not null references public.sellers(id) on delete cascade,
  buyer_id         uuid not null references public.profiles(id) on delete cascade,
  reviewer_name    text not null,                       -- snapshot, "First L."
  rating           smallint not null check (rating between 1 and 5),
  comment          text check (comment is null or char_length(comment) <= 2000),
  status           text not null default 'published' check (status in ('published', 'pending', 'hidden')),
  seller_reply     text check (seller_reply is null or char_length(seller_reply) <= 1000),
  seller_replied_at timestamptz,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

create index if not exists idx_gig_reviews_gig_status_created
  on public.gig_reviews(gig_id, status, created_at desc);
create index if not exists idx_gig_reviews_seller_status
  on public.gig_reviews(seller_id, status);

-- ── RLS: read-only for clients ──────────────────────────────
alter table public.gig_reviews enable row level security;

drop policy if exists "Gig reviews readable" on public.gig_reviews;
create policy "Gig reviews readable"
  on public.gig_reviews for select to anon, authenticated
  using (
    status = 'published'
    or buyer_id = auth.uid()
    or seller_id in (select s.id from public.sellers s where s.user_id = auth.uid())
    or public.get_user_role() = 'admin'
  );

revoke insert, update, delete on public.gig_reviews from anon, authenticated;
grant select on public.gig_reviews to anon, authenticated;

-- ── 2) Aggregates (published reviews only) ──────────────────
alter table public.gigs    add column if not exists total_reviews integer default 0;
alter table public.gigs    add column if not exists average_rating numeric(3,2) default 0;
alter table public.sellers add column if not exists total_reviews integer default 0;
alter table public.sellers add column if not exists average_rating numeric(3,2) default 0;

create or replace function public.refresh_gig_rating(p_gig_id uuid, p_seller_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.gigs g
     set average_rating = coalesce(
           (select round(avg(r.rating)::numeric, 2) from public.gig_reviews r
             where r.gig_id = p_gig_id and r.status = 'published'), 0),
         total_reviews = (select count(*) from public.gig_reviews r
                           where r.gig_id = p_gig_id and r.status = 'published')
   where g.id = p_gig_id;

  update public.sellers s
     set average_rating = coalesce(
           (select round(avg(r.rating)::numeric, 2) from public.gig_reviews r
             where r.seller_id = p_seller_id and r.status = 'published'), 0),
         total_reviews = (select count(*) from public.gig_reviews r
                           where r.seller_id = p_seller_id and r.status = 'published')
   where s.id = p_seller_id;
end;
$$;

create or replace function public.gig_reviews_refresh_aggregates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.refresh_gig_rating(new.gig_id, new.seller_id);
  end if;
  if tg_op = 'DELETE' or (tg_op = 'UPDATE' and (
       old.gig_id is distinct from new.gig_id or old.seller_id is distinct from new.seller_id)) then
    perform public.refresh_gig_rating(old.gig_id, old.seller_id);
  end if;
  return null;
end;
$$;

drop trigger if exists trg_gig_reviews_refresh_aggregates on public.gig_reviews;
create trigger trg_gig_reviews_refresh_aggregates
  after insert or update or delete on public.gig_reviews
  for each row execute function public.gig_reviews_refresh_aggregates();

-- One-time backfill (also keeps re-runs consistent).
do $$
declare r record;
begin
  for r in select g.id as gig_id, g.seller_id from public.gigs g loop
    perform public.refresh_gig_rating(r.gig_id, r.seller_id);
  end loop;
end $$;

-- ── 3) Settings ─────────────────────────────────────────────
insert into public.platform_settings (key, value, description) values
  ('gig_reviews_enabled',    'true',  'Show gig reviews publicly on gig pages'),
  ('gig_reviews_moderation', 'false', 'When true, new gig reviews stay pending until an admin publishes them')
on conflict (key) do nothing;

-- ── 4) Pre-order inquiries ──────────────────────────────────
alter table public.conversations
  add column if not exists gig_id uuid references public.gigs(id) on delete set null;
create index if not exists idx_conversations_gig on public.conversations(gig_id);

alter table public.conversations drop constraint if exists conversations_context_check;
alter table public.conversations
  add constraint conversations_context_check
  check (context in ('order', 'tuition', 'support', 'inquiry')) not valid;

drop index if exists public.conversations_unique_pair_context;
create unique index conversations_unique_pair_context
  on public.conversations (
    participant_a, participant_b, context,
    coalesce(gig_order_id,    '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(subscription_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(gig_id,          '00000000-0000-0000-0000-000000000000'::uuid)
  );
