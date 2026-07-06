-- ============================================================
-- LUMORA — Complete Supabase Database Schema
-- Run this in Supabase SQL Editor (all at once)
-- ============================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================

create type user_role as enum (
  'admin', 'teacher', 'parent', 'seller', 'buyer'
);

create type approval_status as enum (
  'pending', 'approved', 'rejected', 'suspended'
);

create type session_status as enum (
  'scheduled', 'completed', 'cancelled', 'no_show'
);

create type order_status as enum (
  'pending', 'in_progress', 'delivered', 'revision_requested',
  'completed', 'cancelled', 'disputed'
);

create type payment_status as enum (
  'pending', 'processing', 'completed', 'failed', 'refunded'
);

create type payment_method as enum (
  'stripe', 'jazzcash', 'easypaisa', 'ibft', 'bank_transfer', 'card_pk'
);

create type gig_tier as enum ('basic', 'standard', 'premium');

create type subscription_status as enum (
  'active', 'paused', 'cancelled', 'past_due'
);

-- ============================================================
-- TABLE: profiles (extends Supabase auth.users)
-- ============================================================

create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  role            user_role not null default 'buyer',
  full_name       text not null,
  email           text not null,
  avatar_url      text,
  phone           text,
  country         text default 'PK',
  city            text,
  bio             text,
  is_verified     boolean default false,
  is_active       boolean default true,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ============================================================
-- TABLE: teachers
-- ============================================================

create table public.teachers (
  id                    uuid primary key default uuid_generate_v4(),
  user_id               uuid not null references public.profiles(id) on delete cascade,
  status                approval_status default 'pending',

  -- Profile info
  display_name          text not null,
  tagline               text,
  intro_video_url       text,
  profile_photo_url     text,

  -- Education (JSONB array)
  -- [{ degree, institution, year, field }]
  education             jsonb default '[]',

  -- Experience (JSONB array)
  -- [{ title, institution, years, description }]
  experience            jsonb default '[]',

  -- Subjects (JSONB array)
  -- [{ subject, level: 'beginner'|'intermediate'|'advanced' }]
  subjects              jsonb default '[]',

  -- Availability (JSONB)
  -- { mon: ['morning','evening'], tue: ['evening'], ... }
  availability          jsonb default '{}',

  -- Session pricing tiers
  group_price_pkr       integer,  -- Group (up to 5) monthly price PKR
  group_price_usd       decimal(10,2),
  standard_price_pkr    integer,  -- Small group (up to 3) monthly price PKR
  standard_price_usd    decimal(10,2),
  private_price_pkr     integer,  -- 1-on-1 monthly price PKR
  private_price_usd     decimal(10,2),

  -- Translation
  translation_enabled   boolean default false,
  translation_languages jsonb default '[]', -- ['en','ja','ar','fr']

  -- Stats (updated by triggers)
  total_students        integer default 0,
  total_sessions        integer default 0,
  average_rating        decimal(3,2) default 0,
  total_reviews         integer default 0,

  -- Admin
  registration_fee_paid boolean default false,
  registration_fee_amount decimal(10,2),
  featured              boolean default false,
  featured_until        timestamptz,

  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

-- ============================================================
-- TABLE: teacher_reviews
-- ============================================================

create table public.teacher_reviews (
  id          uuid primary key default uuid_generate_v4(),
  teacher_id  uuid not null references public.teachers(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id),
  rating      smallint not null check (rating between 1 and 5),
  comment     text,
  created_at  timestamptz default now()
);

-- ============================================================
-- TABLE: demo_bookings
-- ============================================================

create table public.demo_bookings (
  id              uuid primary key default uuid_generate_v4(),
  teacher_id      uuid not null references public.teachers(id),
  parent_id       uuid not null references public.profiles(id),
  child_name      text not null,
  child_age       smallint,
  subject         text not null,
  scheduled_at    timestamptz not null,
  duration_mins   smallint default 30,
  status          text default 'pending', -- pending|confirmed|completed|cancelled
  livekit_room    text,
  notes           text,
  parent_approved boolean,  -- null=pending, true=approved, false=declined
  created_at      timestamptz default now()
);

-- ============================================================
-- TABLE: subscriptions (teacher monthly tuitions)
-- ============================================================

create table public.subscriptions (
  id                  uuid primary key default uuid_generate_v4(),
  teacher_id          uuid not null references public.teachers(id),
  parent_id           uuid not null references public.profiles(id),
  child_name          text not null,
  subject             text not null,
  tier                text not null, -- 'group'|'standard'|'private'
  status              subscription_status default 'active',

  -- Pricing
  amount_pkr          integer,
  amount_usd          decimal(10,2),
  currency            text default 'PKR',
  payment_method      payment_method,

  -- Stripe (international)
  stripe_subscription_id text unique,
  stripe_customer_id     text,

  -- Billing
  billing_day         smallint default 1, -- day of month
  current_period_start timestamptz,
  current_period_end   timestamptz,
  next_billing_date    timestamptz,
  cancelled_at         timestamptz,

  -- Sessions per week
  sessions_per_week   smallint default 2,

  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- ============================================================
-- TABLE: sessions (individual lesson records)
-- ============================================================

create table public.sessions (
  id              uuid primary key default uuid_generate_v4(),
  subscription_id uuid references public.subscriptions(id),
  teacher_id      uuid not null references public.teachers(id),
  parent_id       uuid not null references public.profiles(id),
  child_name      text not null,
  subject         text not null,
  status          session_status default 'scheduled',
  scheduled_at    timestamptz not null,
  started_at      timestamptz,
  ended_at        timestamptz,
  duration_mins   smallint,
  livekit_room    text,
  recording_url   text,

  -- Progress (teacher fills these)
  session_notes   text,
  topics_covered  text[],
  homework        text,
  homework_due    date,

  -- Translation
  translation_used    boolean default false,
  student_language    text,

  created_at      timestamptz default now()
);

-- ============================================================
-- TABLE: student_progress (grade + attendance tracking)
-- ============================================================

create table public.student_progress (
  id              uuid primary key default uuid_generate_v4(),
  subscription_id uuid not null references public.subscriptions(id),
  teacher_id      uuid not null references public.teachers(id),
  parent_id       uuid not null references public.profiles(id),
  child_name      text not null,
  subject         text not null,
  month           date not null, -- first day of the month
  attendance_pct  decimal(5,2) default 0,
  grade           decimal(5,2), -- percentage score
  grade_label     text, -- 'A+', 'B', etc.
  teacher_comment text,
  sessions_held   smallint default 0,
  sessions_total  smallint default 0,
  created_at      timestamptz default now(),
  unique (subscription_id, month)
);

-- ============================================================
-- TABLE: sellers
-- ============================================================

create table public.sellers (
  id                    uuid primary key default uuid_generate_v4(),
  user_id               uuid not null references public.profiles(id) on delete cascade,
  status                approval_status default 'pending',
  display_name          text not null,
  tagline               text,
  avatar_url            text,
  portfolio_urls        text[] default '{}',
  skills                text[] default '{}',
  languages             text[] default '{}',
  response_time_hrs     smallint default 24,
  level                 text default 'new', -- 'new'|'rising'|'top'|'elite'
  total_orders          integer default 0,
  completed_orders      integer default 0,
  average_rating        decimal(3,2) default 0,
  total_reviews         integer default 0,
  registration_fee_paid boolean default false,
  is_online             boolean default false,
  last_seen_at          timestamptz,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

-- ============================================================
-- TABLE: gigs (seller listings — Fiverr style)
-- ============================================================

create table public.gigs (
  id            uuid primary key default uuid_generate_v4(),
  seller_id     uuid not null references public.sellers(id) on delete cascade,
  status        approval_status default 'pending',
  title         text not null,
  category      text not null,
  subcategory   text,
  description   text not null,
  tags          text[] default '{}',
  gallery_urls  text[] default '{}',
  faq           jsonb default '[]',  -- [{question, answer}]

  -- Packages (Basic / Standard / Premium)
  basic_title         text,
  basic_description   text,
  basic_price_pkr     integer,
  basic_price_usd     decimal(10,2),
  basic_delivery_days smallint default 3,
  basic_revisions     smallint default 1,
  basic_features      text[] default '{}',

  standard_title         text,
  standard_description   text,
  standard_price_pkr     integer,
  standard_price_usd     decimal(10,2),
  standard_delivery_days smallint default 5,
  standard_revisions     smallint default 3,
  standard_features      text[] default '{}',

  premium_title         text,
  premium_description   text,
  premium_price_pkr     integer,
  premium_price_usd     decimal(10,2),
  premium_delivery_days smallint default 7,
  premium_revisions     smallint,  -- null = unlimited
  premium_features      text[] default '{}',

  -- Stats
  total_orders    integer default 0,
  average_rating  decimal(3,2) default 0,
  total_reviews   integer default 0,
  impressions     integer default 0,

  -- Boosting
  is_featured     boolean default false,
  featured_until  timestamptz,

  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ============================================================
-- TABLE: gig_orders
-- ============================================================

create table public.gig_orders (
  id              uuid primary key default uuid_generate_v4(),
  gig_id          uuid not null references public.gigs(id),
  seller_id       uuid not null references public.sellers(id),
  buyer_id        uuid not null references public.profiles(id),
  package_tier    gig_tier not null,
  status          order_status default 'pending',
  requirements    text,  -- buyer's instructions

  -- Pricing
  amount_pkr      integer,
  amount_usd      decimal(10,2),
  currency        text,
  payment_method  payment_method,

  -- Commission
  platform_fee_pct   decimal(5,2) default 18.00,
  platform_fee_amt   decimal(10,2),
  seller_payout_amt  decimal(10,2),

  -- Delivery
  delivery_days      smallint,
  delivery_due_at    timestamptz,
  delivered_at       timestamptz,
  delivery_files     text[] default '{}',
  delivery_message   text,

  -- Revision tracking
  revisions_used     smallint default 0,
  revisions_allowed  smallint default 1,

  -- Dispute
  dispute_opened_at  timestamptz,
  dispute_reason     text,
  dispute_resolved_at timestamptz,
  dispute_resolution text,

  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ============================================================
-- TABLE: ai_services (admin-deployed AI agent listings)
-- ============================================================

create table public.ai_services (
  id                uuid primary key default uuid_generate_v4(),
  title             text not null,
  description       text not null,
  category          text not null,
  thumbnail_url     text,
  status            text default 'active', -- 'active'|'paused'|'draft'

  -- Pricing
  price_pkr         integer,
  price_usd         decimal(10,2),

  -- AI Agent Config (admin only — never expose to users)
  ai_model          text default 'claude-sonnet-4-6',
  system_prompt     text not null,
  output_format     text default 'text', -- 'text'|'code'|'document'|'json'
  delivery_time_hrs smallint default 0, -- 0 = instant

  -- Input form schema (JSONB)
  -- [{ field_name, label, type: 'text'|'textarea'|'file'|'select', required, options? }]
  input_schema      jsonb default '[]',

  -- Revision policy
  revisions_allowed smallint default 1,

  -- Stats
  total_orders      integer default 0,
  average_rating    decimal(3,2) default 0,
  total_reviews     integer default 0,

  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- ============================================================
-- TABLE: ai_orders (AI service order fulfillment)
-- ============================================================

create table public.ai_orders (
  id              uuid primary key default uuid_generate_v4(),
  service_id      uuid not null references public.ai_services(id),
  buyer_id        uuid not null references public.profiles(id),
  status          order_status default 'pending',

  -- User inputs (from dynamic form)
  user_inputs     jsonb not null default '{}',

  -- Pricing (100% platform margin)
  amount_pkr      integer,
  amount_usd      decimal(10,2),
  currency        text,
  payment_method  payment_method,

  -- AI Fulfillment
  ai_output       text,
  fulfilled_at    timestamptz,
  model_used      text,

  -- Revision tracking
  revisions_used    smallint default 0,
  revision_requests jsonb default '[]', -- [{request, response, timestamp}]

  -- Review
  rating          smallint check (rating between 1 and 5),
  review          text,

  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ============================================================
-- TABLE: transactions (unified payment ledger)
-- ============================================================

create table public.transactions (
  id                  uuid primary key default uuid_generate_v4(),
  type                text not null, -- 'tuition'|'gig'|'ai_service'|'registration'|'featured'
  status              payment_status default 'pending',

  -- Parties
  payer_id            uuid references public.profiles(id),
  payee_id            uuid references public.profiles(id), -- null for AI services

  -- References
  subscription_id     uuid references public.subscriptions(id),
  gig_order_id        uuid references public.gig_orders(id),
  ai_order_id         uuid references public.ai_orders(id),

  -- Amounts
  gross_amount        decimal(10,2) not null,
  platform_fee        decimal(10,2) default 0,
  net_amount          decimal(10,2) not null,
  currency            text not null default 'PKR',

  -- Payment processor
  payment_method      payment_method,
  processor           text, -- 'stripe'|'simpaisa'
  processor_ref       text, -- Stripe PaymentIntent ID or Simpaisa reference
  processor_response  jsonb,

  -- Bank transfer manual flow
  bank_transfer_proof text, -- uploaded screenshot URL
  bank_transfer_confirmed_by uuid references public.profiles(id),
  bank_transfer_confirmed_at timestamptz,

  paid_at             timestamptz,
  created_at          timestamptz default now()
);

-- ============================================================
-- TABLE: payouts (teacher + seller payouts)
-- ============================================================

create table public.payouts (
  id              uuid primary key default uuid_generate_v4(),
  recipient_id    uuid not null references public.profiles(id),
  recipient_type  text not null, -- 'teacher'|'seller'
  status          text default 'pending', -- 'pending'|'processing'|'completed'|'failed'
  amount          decimal(10,2) not null,
  currency        text not null default 'PKR',
  payment_method  payment_method,
  bank_name       text,
  account_number  text, -- encrypted at app layer
  iban            text, -- encrypted at app layer
  processor_ref   text,
  processed_by    uuid references public.profiles(id), -- admin
  processed_at    timestamptz,
  notes           text,
  created_at      timestamptz default now()
);

-- ============================================================
-- TABLE: platform_settings (admin-controlled config)
-- ============================================================

create table public.platform_settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_by  uuid references public.profiles(id),
  updated_at  timestamptz default now()
);

-- Insert default platform settings
insert into public.platform_settings (key, value, description) values
  ('teacher_commission_pct', '15', 'Platform commission % on teacher monthly tuitions'),
  ('seller_commission_pct', '18', 'Platform commission % on gig orders'),
  ('teacher_registration_fee_pkr', '2000', 'Teacher registration fee in PKR'),
  ('teacher_registration_fee_usd', '10', 'Teacher registration fee in USD'),
  ('seller_registration_fee_pkr', '1000', 'Seller registration fee in PKR'),
  ('seller_registration_fee_usd', '5', 'Seller registration fee in USD'),
  ('demo_lesson_duration_mins', '30', 'Default demo lesson duration in minutes'),
  ('parent_premium_price_usd', '9.99', 'Parent premium plan monthly price'),
  ('ai_service_brand_name', '"LumoraAI Studio"', 'Brand name shown for AI service listings'),
  ('translation_feature_enabled', 'true', 'Global toggle for translation feature'),
  ('maintenance_mode', 'false', 'Put platform in maintenance mode');

-- ============================================================
-- TABLE: notifications
-- ============================================================

create table public.notifications (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  type        text not null,
  title       text not null,
  message     text not null,
  action_url  text,
  read        boolean default false,
  created_at  timestamptz default now()
);

-- ============================================================
-- TABLE: messages (in-app messaging)
-- ============================================================

create table public.messages (
  id              uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null,
  sender_id       uuid not null references public.profiles(id),
  receiver_id     uuid not null references public.profiles(id),
  content         text not null,
  attachment_url  text,
  read            boolean default false,
  created_at      timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.teachers enable row level security;
alter table public.teacher_reviews enable row level security;
alter table public.demo_bookings enable row level security;
alter table public.subscriptions enable row level security;
alter table public.sessions enable row level security;
alter table public.student_progress enable row level security;
alter table public.sellers enable row level security;
alter table public.gigs enable row level security;
alter table public.gig_orders enable row level security;
alter table public.ai_services enable row level security;
alter table public.ai_orders enable row level security;
alter table public.transactions enable row level security;
alter table public.payouts enable row level security;
alter table public.platform_settings enable row level security;
alter table public.notifications enable row level security;
alter table public.messages enable row level security;

-- ── Helper function: get current user role ─────────────────
create or replace function public.get_user_role()
returns user_role as $$
  select role from public.profiles where id = auth.uid();
$$ language sql security definer stable;

-- ── PROFILES policies ──────────────────────────────────────
create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Admin can view all profiles"
  on public.profiles for select
  using (public.get_user_role() = 'admin');

create policy "Public teacher profiles visible to all"
  on public.profiles for select
  using (role = 'teacher');

-- ── TEACHERS policies ──────────────────────────────────────
create policy "Approved teachers visible to everyone"
  on public.teachers for select
  using (status = 'approved');

create policy "Teacher can view their own profile"
  on public.teachers for select
  using (user_id = auth.uid());

create policy "Teacher can update their own profile"
  on public.teachers for update
  using (user_id = auth.uid());

create policy "Admin can do everything with teachers"
  on public.teachers for all
  using (public.get_user_role() = 'admin');

-- ── GIGS policies ──────────────────────────────────────────
create policy "Approved gigs visible to everyone"
  on public.gigs for select
  using (status = 'approved');

create policy "Seller can manage their own gigs"
  on public.gigs for all
  using (seller_id in (
    select id from public.sellers where user_id = auth.uid()
  ));

create policy "Admin can manage all gigs"
  on public.gigs for all
  using (public.get_user_role() = 'admin');

-- ── AI SERVICES: only admin can create/edit ────────────────
create policy "AI services visible to everyone"
  on public.ai_services for select
  using (status = 'active');

create policy "Only admin can manage AI services"
  on public.ai_services for all
  using (public.get_user_role() = 'admin');

-- ── NOTIFICATIONS ──────────────────────────────────────────
create policy "Users see only their notifications"
  on public.notifications for all
  using (user_id = auth.uid());

-- ── MESSAGES ───────────────────────────────────────────────
create policy "Users see their own messages"
  on public.messages for select
  using (sender_id = auth.uid() or receiver_id = auth.uid());

create policy "Users can send messages"
  on public.messages for insert
  with check (sender_id = auth.uid());

-- ── PLATFORM SETTINGS: admin only ─────────────────────────
create policy "Admin can manage platform settings"
  on public.platform_settings for all
  using (public.get_user_role() = 'admin');

create policy "Anyone can read platform settings"
  on public.platform_settings for select
  using (true);

-- ============================================================
-- INDEXES (performance)
-- ============================================================

create index idx_teachers_status on public.teachers(status);
create index idx_teachers_user_id on public.teachers(user_id);
create index idx_gigs_seller_id on public.gigs(seller_id);
create index idx_gigs_status on public.gigs(status);
create index idx_gigs_category on public.gigs(category);
create index idx_subscriptions_teacher on public.subscriptions(teacher_id);
create index idx_subscriptions_parent on public.subscriptions(parent_id);
create index idx_sessions_subscription on public.sessions(subscription_id);
create index idx_transactions_payer on public.transactions(payer_id);
create index idx_notifications_user on public.notifications(user_id);
create index idx_messages_conversation on public.messages(conversation_id);

-- ============================================================
-- TRIGGERS (auto-update updated_at)
-- ============================================================

create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at();

create trigger update_teachers_updated_at
  before update on public.teachers
  for each row execute function public.update_updated_at();

create trigger update_sellers_updated_at
  before update on public.sellers
  for each row execute function public.update_updated_at();

create trigger update_gigs_updated_at
  before update on public.gigs
  for each row execute function public.update_updated_at();

create trigger update_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.update_updated_at();

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================

insert into storage.buckets (id, name, public) values
  ('avatars', 'avatars', true),
  ('teacher-media', 'teacher-media', true),
  ('gig-gallery', 'gig-gallery', true),
  ('order-files', 'order-files', false),
  ('payment-proofs', 'payment-proofs', false),
  ('session-recordings', 'session-recordings', false);

-- ============================================================
-- DONE — Schema created successfully
-- ============================================================
