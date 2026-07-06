/**
 * Hayesh — Database Types
 *
 * Mirrors `supabase-schema.sql` (enums, tables, JSONB shapes) exactly.
 * MUST be regenerated / hand-updated whenever the schema changes.
 *
 * Column mapping used throughout:
 *   uuid          -> string
 *   text          -> string
 *   integer       -> number
 *   smallint      -> number
 *   decimal(x,y)  -> number
 *   boolean       -> boolean
 *   timestamptz   -> string (ISO 8601)
 *   date          -> string (YYYY-MM-DD)
 *   text[]        -> string[]
 *   jsonb         -> named sub-shape interface
 *   enum          -> string-literal union type
 *
 * Nullability rule: a column is typed `T | null` unless the SQL declares it
 * `not null` (or it is a primary key / a `references` column declared
 * `not null`). A `default` only affects INSERT-time optionality — Postgres
 * still allows an explicit NULL to be written/updated afterward unless the
 * column is also `not null`. So `default` alone does NOT make a column
 * non-nullable on Row reads.
 */

// ============================================================
// ENUMS
// ============================================================

export type UserRole = 'admin' | 'teacher' | 'parent' | 'seller' | 'buyer';

export type ApprovalStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'suspended';

export type SessionStatus =
  | 'scheduled'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export type OrderStatus =
  | 'pending'
  | 'in_progress'
  | 'delivered'
  | 'revision_requested'
  | 'completed'
  | 'cancelled'
  | 'disputed';

export type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'refunded';

export type PaymentMethod =
  | 'stripe'
  | 'jazzcash'
  | 'easypaisa'
  | 'ibft'
  | 'bank_transfer'
  | 'card_pk';

export type GigTier = 'basic' | 'standard' | 'premium';

export type SubscriptionStatus =
  | 'active'
  | 'paused'
  | 'cancelled'
  | 'past_due';

// Non-enum but constrained text columns documented via SQL comments.
export type DemoBookingStatus =
  | 'pending'
  | 'confirmed'
  | 'completed'
  | 'cancelled';

export type SubscriptionTier = 'group' | 'standard' | 'private';

export type SellerLevel = 'new' | 'rising' | 'top' | 'elite';

export type AIServiceStatus = 'active' | 'paused' | 'draft';

export type AIOutputFormat = 'text' | 'code' | 'document' | 'json';

export type TransactionType =
  | 'tuition'
  | 'gig'
  | 'ai_service'
  | 'registration'
  | 'featured';

export type PayoutRecipientType = 'teacher' | 'seller';

export type PayoutStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type PaymentProcessor = 'stripe' | 'simpaisa';

// ============================================================
// JSONB SUB-SHAPES
// ============================================================

/** teachers.education — [{ degree, institution, year, field }] */
export interface EducationEntry {
  degree: string;
  institution: string;
  year: number;
  field: string;
}

/** teachers.experience — [{ title, institution, years, description }] */
export interface ExperienceEntry {
  title: string;
  institution: string;
  years: number;
  description: string;
}

/** teachers.subjects — [{ subject, level }] */
export interface SubjectEntry {
  subject: string;
  level: 'beginner' | 'intermediate' | 'advanced';
}

/** Time-of-day slot buckets used inside teachers.availability. */
export type TimeSlot = 'morning' | 'afternoon' | 'evening' | 'night';

/**
 * teachers.availability — { mon: ['morning','evening'], tue: ['evening'], ... }
 * Keyed by lowercase 3-letter weekday abbreviation; any day may be omitted.
 */
export interface Availability {
  mon?: TimeSlot[];
  tue?: TimeSlot[];
  wed?: TimeSlot[];
  thu?: TimeSlot[];
  fri?: TimeSlot[];
  sat?: TimeSlot[];
  sun?: TimeSlot[];
}

/** teachers.translation_languages — ['en','ja','ar','fr'] (ISO 639-1 codes) */
export type TranslationLanguages = string[];

/** gigs.faq — [{question, answer}] */
export interface GigFaqEntry {
  question: string;
  answer: string;
}

/**
 * ai_services.input_schema — dynamic order-form field definitions.
 * [{ field_name, label, type, required, options? }]
 */
export interface AIServiceInputField {
  field_name: string;
  label: string;
  type: 'text' | 'textarea' | 'file' | 'select';
  required: boolean;
  options?: string[];
}

/** ai_orders.user_inputs — free-form answers keyed by AIServiceInputField.field_name */
export type AIOrderUserInputs = Record<string, string | number | boolean | null>;

/** ai_orders.revision_requests — [{request, response, timestamp}] */
export interface AIRevisionEntry {
  request: string;
  response: string;
  timestamp: string;
}

/**
 * transactions.processor_response — raw response payload from the payment
 * processor (Stripe / Simpaisa). Shape varies by processor, so this is
 * modeled as an open record rather than `any`.
 */
export type ProcessorResponse = Record<string, unknown>;

/**
 * platform_settings.value — the setting's value, shape depends on `key`
 * (e.g. numeric percentages, numeric fees, strings, or booleans). Modeled
 * as an open JSON value since it is heterogeneous across rows.
 */
export type PlatformSettingValue = string | number | boolean | null;

// ============================================================
// TABLE ROW INTERFACES
// ============================================================

/** public.profiles — extends Supabase auth.users */
export interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  email: string;
  avatar_url: string | null;
  phone: string | null;
  country: string | null;
  city: string | null;
  bio: string | null;
  is_verified: boolean | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

/** public.teachers */
export interface Teacher {
  id: string;
  user_id: string;
  status: ApprovalStatus | null;

  display_name: string;
  tagline: string | null;
  intro_video_url: string | null;
  profile_photo_url: string | null;

  education: EducationEntry[] | null;
  experience: ExperienceEntry[] | null;
  subjects: SubjectEntry[] | null;
  availability: Availability | null;

  group_price_pkr: number | null;
  group_price_usd: number | null;
  standard_price_pkr: number | null;
  standard_price_usd: number | null;
  private_price_pkr: number | null;
  private_price_usd: number | null;

  translation_enabled: boolean | null;
  translation_languages: TranslationLanguages | null;

  total_students: number | null;
  total_sessions: number | null;
  average_rating: number | null;
  total_reviews: number | null;

  registration_fee_paid: boolean | null;
  registration_fee_amount: number | null;
  featured: boolean | null;
  featured_until: string | null;

  created_at: string | null;
  updated_at: string | null;
}

/** public.teacher_reviews */
export interface TeacherReview {
  id: string;
  teacher_id: string;
  reviewer_id: string;
  rating: number;
  comment: string | null;
  created_at: string | null;
}

/** public.demo_bookings */
export interface DemoBooking {
  id: string;
  teacher_id: string;
  parent_id: string;
  child_name: string;
  child_age: number | null;
  subject: string;
  scheduled_at: string;
  duration_mins: number | null;
  status: DemoBookingStatus | null;
  livekit_room: string | null;
  notes: string | null;
  parent_approved: boolean | null;
  created_at: string | null;
}

/** public.subscriptions — teacher monthly tuitions */
export interface Subscription {
  id: string;
  teacher_id: string;
  parent_id: string;
  child_name: string;
  subject: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus | null;

  amount_pkr: number | null;
  amount_usd: number | null;
  currency: string | null;
  payment_method: PaymentMethod | null;

  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;

  billing_day: number | null;
  current_period_start: string | null;
  current_period_end: string | null;
  next_billing_date: string | null;
  cancelled_at: string | null;

  sessions_per_week: number | null;

  created_at: string | null;
  updated_at: string | null;
}

/** public.sessions — individual lesson records */
export interface Session {
  id: string;
  subscription_id: string | null;
  teacher_id: string;
  parent_id: string;
  child_name: string;
  subject: string;
  status: SessionStatus | null;
  scheduled_at: string;
  started_at: string | null;
  ended_at: string | null;
  duration_mins: number | null;
  livekit_room: string | null;
  recording_url: string | null;

  session_notes: string | null;
  topics_covered: string[] | null;
  homework: string | null;
  homework_due: string | null;

  translation_used: boolean | null;
  student_language: string | null;

  created_at: string | null;
}

/** public.student_progress — grade + attendance tracking */
export interface StudentProgress {
  id: string;
  subscription_id: string;
  teacher_id: string;
  parent_id: string;
  child_name: string;
  subject: string;
  month: string;
  attendance_pct: number | null;
  grade: number | null;
  grade_label: string | null;
  teacher_comment: string | null;
  sessions_held: number | null;
  sessions_total: number | null;
  created_at: string | null;
}

/** public.sellers */
export interface Seller {
  id: string;
  user_id: string;
  status: ApprovalStatus | null;
  display_name: string;
  tagline: string | null;
  avatar_url: string | null;
  portfolio_urls: string[] | null;
  skills: string[] | null;
  languages: string[] | null;
  response_time_hrs: number | null;
  level: SellerLevel | null;
  total_orders: number | null;
  completed_orders: number | null;
  average_rating: number | null;
  total_reviews: number | null;
  registration_fee_paid: boolean | null;
  is_online: boolean | null;
  last_seen_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

/** public.gigs — seller listings, Fiverr style */
export interface Gig {
  id: string;
  seller_id: string;
  status: ApprovalStatus | null;
  title: string;
  category: string;
  subcategory: string | null;
  description: string;
  tags: string[] | null;
  gallery_urls: string[] | null;
  faq: GigFaqEntry[] | null;

  basic_title: string | null;
  basic_description: string | null;
  basic_price_pkr: number | null;
  basic_price_usd: number | null;
  basic_delivery_days: number | null;
  basic_revisions: number | null;
  basic_features: string[] | null;

  standard_title: string | null;
  standard_description: string | null;
  standard_price_pkr: number | null;
  standard_price_usd: number | null;
  standard_delivery_days: number | null;
  standard_revisions: number | null;
  standard_features: string[] | null;

  premium_title: string | null;
  premium_description: string | null;
  premium_price_pkr: number | null;
  premium_price_usd: number | null;
  premium_delivery_days: number | null;
  premium_revisions: number | null;
  premium_features: string[] | null;

  total_orders: number | null;
  average_rating: number | null;
  total_reviews: number | null;
  impressions: number | null;

  is_featured: boolean | null;
  featured_until: string | null;

  created_at: string | null;
  updated_at: string | null;
}

/** public.gig_orders */
export interface GigOrder {
  id: string;
  gig_id: string;
  seller_id: string;
  buyer_id: string;
  package_tier: GigTier;
  status: OrderStatus | null;
  requirements: string | null;

  amount_pkr: number | null;
  amount_usd: number | null;
  currency: string | null;
  payment_method: PaymentMethod | null;

  platform_fee_pct: number | null;
  platform_fee_amt: number | null;
  seller_payout_amt: number | null;

  delivery_days: number | null;
  delivery_due_at: string | null;
  delivered_at: string | null;
  delivery_files: string[] | null;
  delivery_message: string | null;

  revisions_used: number | null;
  revisions_allowed: number | null;

  dispute_opened_at: string | null;
  dispute_reason: string | null;
  dispute_resolved_at: string | null;
  dispute_resolution: string | null;

  created_at: string | null;
  updated_at: string | null;
}

/** public.ai_services — admin-deployed AI agent listings */
export interface AIService {
  id: string;
  title: string;
  description: string;
  category: string;
  thumbnail_url: string | null;
  status: AIServiceStatus | null;

  price_pkr: number | null;
  price_usd: number | null;

  ai_model: string | null;
  system_prompt: string;
  output_format: AIOutputFormat | null;
  delivery_time_hrs: number | null;

  input_schema: AIServiceInputField[] | null;

  revisions_allowed: number | null;

  total_orders: number | null;
  average_rating: number | null;
  total_reviews: number | null;

  created_at: string | null;
  updated_at: string | null;
}

/** public.ai_orders — AI service order fulfillment */
export interface AIOrder {
  id: string;
  service_id: string;
  buyer_id: string;
  status: OrderStatus | null;

  user_inputs: AIOrderUserInputs;

  amount_pkr: number | null;
  amount_usd: number | null;
  currency: string | null;
  payment_method: PaymentMethod | null;

  ai_output: string | null;
  fulfilled_at: string | null;
  model_used: string | null;

  revisions_used: number | null;
  revision_requests: AIRevisionEntry[] | null;

  rating: number | null;
  review: string | null;

  created_at: string | null;
  updated_at: string | null;
}

/** public.transactions — unified payment ledger */
export interface Transaction {
  id: string;
  type: TransactionType;
  status: PaymentStatus | null;

  payer_id: string | null;
  payee_id: string | null;

  subscription_id: string | null;
  gig_order_id: string | null;
  ai_order_id: string | null;

  gross_amount: number;
  platform_fee: number | null;
  net_amount: number;
  currency: string;

  payment_method: PaymentMethod | null;
  processor: PaymentProcessor | null;
  processor_ref: string | null;
  processor_response: ProcessorResponse | null;

  bank_transfer_proof: string | null;
  bank_transfer_confirmed_by: string | null;
  bank_transfer_confirmed_at: string | null;

  paid_at: string | null;
  created_at: string | null;
}

/** public.payouts — teacher + seller payouts */
export interface Payout {
  id: string;
  recipient_id: string;
  recipient_type: PayoutRecipientType;
  status: PayoutStatus | null;
  amount: number;
  currency: string;
  payment_method: PaymentMethod | null;
  bank_name: string | null;
  account_number: string | null;
  iban: string | null;
  processor_ref: string | null;
  processed_by: string | null;
  processed_at: string | null;
  notes: string | null;
  created_at: string | null;
}

/** public.platform_settings — admin-controlled config */
export interface PlatformSetting {
  key: string;
  value: PlatformSettingValue;
  description: string | null;
  updated_by: string | null;
  updated_at: string | null;
}

/** public.notifications */
export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  action_url: string | null;
  read: boolean | null;
  created_at: string | null;
}

/** public.messages — in-app messaging */
export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  attachment_url: string | null;
  read: boolean | null;
  created_at: string | null;
}

// ============================================================
// INSERT HELPER TYPE
// ============================================================

/**
 * Generic insert-shape helper: `id`, `created_at`, and `updated_at` are
 * always DB-generated/defaulted, so they become optional on insert while
 * every other column keeps its Row-level nullability.
 *
 * Usage: `type NewTeacher = TableInsert<Teacher>`
 */
export type TableInsert<T> = Omit<T, 'id' | 'created_at' | 'updated_at'> &
  Partial<Pick<T, Extract<'id', keyof T>>> &
  Partial<Pick<T, Extract<'created_at', keyof T>>> &
  Partial<Pick<T, Extract<'updated_at', keyof T>>>;
