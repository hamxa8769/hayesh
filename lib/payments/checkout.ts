import { createAdminClient } from "@/lib/supabase/admin"
import { getCommerceSettings, splitCommission } from "@/lib/payments/settings"
import { generateReferenceCode } from "@/lib/payments/reference"
import type { AIServiceInputField, GigTier, SubscriptionTier, TransactionType, UserRole } from "@/types/database"

if (typeof window !== "undefined") {
  throw new Error("lib/payments/checkout.ts must never be imported client-side")
}

/**
 * Checkout = create the order row(s) + ONE pending transaction.
 *
 * Every price, commission and payee is resolved here from the database —
 * nothing monetary is ever taken from the request body. The order stays
 * inert ('pending' / 'pending_payment') until lib/payments/settle.ts marks
 * the transaction paid.
 */

export interface CheckoutCaller {
  userId: string
  role: UserRole
  fullName: string
}

export type CheckoutResult =
  | { ok: true; transactionId: string; referenceCode: string; free: boolean }
  | { ok: false; error: string; status: number }

interface PendingTxInput {
  type: TransactionType
  payerId: string
  payeeId: string | null
  gross: number
  fee: number
  net: number
  currency: string
  description: string
  subscriptionId?: string
  gigOrderId?: string
  aiOrderId?: string
  meta?: Record<string, unknown>
}

async function insertPendingTransaction(input: PendingTxInput): Promise<{ id: string; referenceCode: string } | { error: string }> {
  const admin = createAdminClient()
  // Retry on the (astronomically unlikely) reference-code collision.
  for (let attempt = 0; attempt < 3; attempt++) {
    const referenceCode = generateReferenceCode()
    const { data, error } = await admin
      .from("transactions")
      .insert({
        type: input.type,
        status: "pending",
        payer_id: input.payerId,
        payee_id: input.payeeId,
        subscription_id: input.subscriptionId ?? null,
        gig_order_id: input.gigOrderId ?? null,
        ai_order_id: input.aiOrderId ?? null,
        gross_amount: input.gross,
        platform_fee: input.fee,
        net_amount: input.net,
        currency: input.currency,
        description: input.description,
        reference_code: referenceCode,
        meta: input.meta ?? {},
      })
      .select("id")
      .single()
    if (!error && data) return { id: (data as { id: string }).id, referenceCode }
    if (error && !error.message.includes("reference_code")) return { error: error.message }
  }
  return { error: "Could not create a payment reference. Please try again." }
}

/** True when the caller's profile country is set and is not Pakistan. */
async function isInternationalCaller(userId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data } = await admin.from("profiles").select("country").eq("id", userId).maybeSingle()
  const country = ((data as { country: string | null } | null)?.country ?? "").trim().toLowerCase()
  return country !== "" && country !== "pk" && country !== "pakistan"
}

function pickPrice(
  pkr: number | null | undefined,
  usd: number | null | undefined,
  preferUsd = false
): { amount: number; currency: string } | null {
  if (preferUsd && typeof usd === "number" && usd >= 0) return { amount: Number(usd), currency: "USD" }
  if (typeof pkr === "number" && pkr >= 0) return { amount: pkr, currency: "PKR" }
  if (typeof usd === "number" && usd >= 0) return { amount: Number(usd), currency: "USD" }
  return null
}

// ── AI service ───────────────────────────────────────────────

export async function checkoutAIService(
  caller: CheckoutCaller,
  serviceId: string,
  inputs: Record<string, string>
): Promise<CheckoutResult> {
  const admin = createAdminClient()
  const { data: service } = await admin
    .from("ai_services")
    .select("id, title, status, price_pkr, price_usd, input_schema")
    .eq("id", serviceId)
    .maybeSingle()

  if (!service || service.status !== "active") return { ok: false, error: "This AI service is not available", status: 404 }

  const schema = (service.input_schema ?? []) as AIServiceInputField[]
  const cleanInputs: Record<string, string> = {}
  for (const field of schema) {
    const value = (inputs[field.field_name] ?? "").toString().trim()
    if (field.required && !value) return { ok: false, error: `${field.label} is required`, status: 400 }
    if (value.length > 20000) return { ok: false, error: `${field.label} is too long`, status: 400 }
    if (value) cleanInputs[field.field_name] = value
  }

  const price = pickPrice(service.price_pkr as number | null, service.price_usd as number | null, await isInternationalCaller(caller.userId))
  if (!price) return { ok: false, error: "This service has no price configured", status: 409 }

  const { data: order, error: orderError } = await admin
    .from("ai_orders")
    .insert({
      service_id: service.id,
      buyer_id: caller.userId,
      status: "pending",
      user_inputs: cleanInputs,
      amount_pkr: price.currency === "PKR" ? price.amount : null,
      amount_usd: price.currency === "USD" ? price.amount : null,
      currency: price.currency,
    })
    .select("id")
    .single()
  if (orderError || !order) return { ok: false, error: orderError?.message ?? "Could not create order", status: 500 }

  // AI services keep 100% of revenue: no payee, fee = gross.
  const tx = await insertPendingTransaction({
    type: "ai_service",
    payerId: caller.userId,
    payeeId: null,
    gross: price.amount,
    fee: price.amount,
    net: 0,
    currency: price.currency,
    description: `HayeshAI Studio — ${service.title}`,
    aiOrderId: (order as { id: string }).id,
  })
  if ("error" in tx) return { ok: false, error: tx.error, status: 500 }

  return { ok: true, transactionId: tx.id, referenceCode: tx.referenceCode, free: price.amount === 0 }
}

// ── Gig order ────────────────────────────────────────────────

interface GigRow {
  id: string
  seller_id: string
  status: string
  title: string
  [key: string]: unknown
}

export async function checkoutGig(
  caller: CheckoutCaller,
  gigId: string,
  tier: GigTier,
  requirements: string
): Promise<CheckoutResult> {
  const admin = createAdminClient()
  const { data: gigData } = await admin.from("gigs").select("*").eq("id", gigId).maybeSingle()
  const gig = gigData as GigRow | null
  if (!gig || gig.status !== "approved") return { ok: false, error: "This service is not available", status: 404 }

  const { data: seller } = await admin
    .from("sellers")
    .select("id, user_id, status")
    .eq("id", gig.seller_id)
    .maybeSingle()
  if (!seller || seller.status !== "approved") return { ok: false, error: "This seller is not accepting orders", status: 409 }
  if (seller.user_id === caller.userId) return { ok: false, error: "You can't order your own service", status: 400 }

  const price = pickPrice(
    gig[`${tier}_price_pkr`] as number | null,
    gig[`${tier}_price_usd`] as number | null,
    await isInternationalCaller(caller.userId)
  )
  if (!price || price.amount <= 0) return { ok: false, error: "This package is not available", status: 400 }

  const deliveryDays = Number(gig[`${tier}_delivery_days`] ?? 3) || 3
  const revisions = Number(gig[`${tier}_revisions`] ?? 1)
  const settings = await getCommerceSettings()
  const { fee, net } = splitCommission(price.amount, settings.sellerCommissionPct)

  const { data: order, error: orderError } = await admin
    .from("gig_orders")
    .insert({
      gig_id: gig.id,
      seller_id: seller.id,
      buyer_id: caller.userId,
      package_tier: tier,
      status: "pending",
      requirements,
      gig_title: gig.title,
      amount_pkr: price.currency === "PKR" ? price.amount : null,
      amount_usd: price.currency === "USD" ? price.amount : null,
      currency: price.currency,
      platform_fee_pct: settings.sellerCommissionPct,
      platform_fee_amt: fee,
      seller_payout_amt: net,
      delivery_days: deliveryDays,
      revisions_allowed: Number.isFinite(revisions) ? revisions : 1,
    })
    .select("id")
    .single()
  if (orderError || !order) return { ok: false, error: orderError?.message ?? "Could not create order", status: 500 }

  const tx = await insertPendingTransaction({
    type: "gig",
    payerId: caller.userId,
    payeeId: seller.user_id as string,
    gross: price.amount,
    fee,
    net,
    currency: price.currency,
    description: `${gig.title} — ${tier[0].toUpperCase()}${tier.slice(1)} package`,
    gigOrderId: (order as { id: string }).id,
  })
  if ("error" in tx) return { ok: false, error: tx.error, status: 500 }

  return { ok: true, transactionId: tx.id, referenceCode: tx.referenceCode, free: false }
}

// ── Monthly tuition ──────────────────────────────────────────

interface TuitionInput {
  teacherId: string
  tier: SubscriptionTier
  childName: string
  subject: string
  studentId?: string
}

export async function checkoutTuition(caller: CheckoutCaller, input: TuitionInput): Promise<CheckoutResult> {
  if (caller.role !== "parent" && caller.role !== "admin") {
    return { ok: false, error: "Only parent accounts can enrol a child in tuition", status: 403 }
  }
  const admin = createAdminClient()
  const { data: teacherData } = await admin.from("teachers").select("*").eq("id", input.teacherId).maybeSingle()
  const teacher = teacherData as Record<string, unknown> | null
  if (!teacher || teacher.status !== "approved") return { ok: false, error: "This teacher is not accepting students", status: 404 }
  if (teacher.user_id === caller.userId) return { ok: false, error: "You can't enrol with yourself", status: 400 }

  if (input.studentId) {
    const { data: student } = await admin
      .from("students")
      .select("id")
      .eq("id", input.studentId)
      .eq("parent_id", caller.userId)
      .maybeSingle()
    if (!student) return { ok: false, error: "Student not found", status: 404 }
  }

  const price = pickPrice(
    teacher[`${input.tier}_price_pkr`] as number | null,
    teacher[`${input.tier}_price_usd`] as number | null,
    await isInternationalCaller(caller.userId)
  )
  if (!price || price.amount <= 0) return { ok: false, error: "This plan is not offered by the teacher", status: 400 }

  // Re-use an unpaid enrolment for the same child/teacher/tier instead of piling up duplicates.
  const { data: existing } = await admin
    .from("subscriptions")
    .select("id")
    .eq("teacher_id", input.teacherId)
    .eq("parent_id", caller.userId)
    .eq("child_name", input.childName)
    .in("status", ["active", "pending_payment"])
    .limit(1)
  if (existing && existing.length > 0) {
    const { data: openTx } = await admin
      .from("transactions")
      .select("id, reference_code, status")
      .eq("subscription_id", (existing[0] as { id: string }).id)
      .eq("status", "pending")
      .limit(1)
    if (openTx && openTx.length > 0) {
      const row = openTx[0] as { id: string; reference_code: string }
      return { ok: true, transactionId: row.id, referenceCode: row.reference_code, free: false }
    }
    return { ok: false, error: `${input.childName} is already enrolled with this teacher`, status: 409 }
  }

  const settings = await getCommerceSettings()
  const { fee, net } = splitCommission(price.amount, settings.teacherCommissionPct)

  const { data: sub, error: subError } = await admin
    .from("subscriptions")
    .insert({
      teacher_id: input.teacherId,
      parent_id: caller.userId,
      child_name: input.childName,
      subject: input.subject,
      tier: input.tier,
      status: "pending_payment",
      amount_pkr: price.currency === "PKR" ? price.amount : null,
      amount_usd: price.currency === "USD" ? price.amount : null,
      currency: price.currency,
      student_id: input.studentId ?? null,
    })
    .select("id")
    .single()
  if (subError || !sub) return { ok: false, error: subError?.message ?? "Could not create enrolment", status: 500 }

  const tx = await insertPendingTransaction({
    type: "tuition",
    payerId: caller.userId,
    payeeId: teacher.user_id as string,
    gross: price.amount,
    fee,
    net,
    currency: price.currency,
    description: `Monthly tuition — ${teacher.display_name as string} · ${input.subject} for ${input.childName}`,
    subscriptionId: (sub as { id: string }).id,
    meta: { period: "first" },
  })
  if ("error" in tx) return { ok: false, error: tx.error, status: 500 }

  return { ok: true, transactionId: tx.id, referenceCode: tx.referenceCode, free: false }
}

/** Creates the next month's pending tuition charge for an active subscription (used by the renewal cron). */
export async function createRenewalTransaction(subscriptionId: string): Promise<{ ok: boolean; transactionId?: string; error?: string }> {
  const admin = createAdminClient()
  const { data: subData } = await admin.from("subscriptions").select("*").eq("id", subscriptionId).maybeSingle()
  const sub = subData as Record<string, unknown> | null
  if (!sub) return { ok: false, error: "Subscription not found" }

  const { data: openTx } = await admin
    .from("transactions")
    .select("id")
    .eq("subscription_id", subscriptionId)
    .eq("status", "pending")
    .limit(1)
  if (openTx && openTx.length > 0) return { ok: true, transactionId: (openTx[0] as { id: string }).id }

  const { data: teacher } = await admin.from("teachers").select("user_id, display_name").eq("id", sub.teacher_id as string).maybeSingle()
  if (!teacher) return { ok: false, error: "Teacher not found" }

  const currency = (sub.currency as string | null) ?? "PKR"
  const gross = Number(currency === "USD" ? sub.amount_usd : sub.amount_pkr)
  if (!Number.isFinite(gross) || gross <= 0) return { ok: false, error: "Subscription has no amount" }

  const settings = await getCommerceSettings()
  const { fee, net } = splitCommission(gross, settings.teacherCommissionPct)
  const tx = await insertPendingTransaction({
    type: "tuition",
    payerId: sub.parent_id as string,
    payeeId: (teacher as { user_id: string }).user_id,
    gross,
    fee,
    net,
    currency,
    description: `Monthly tuition renewal — ${(teacher as { display_name: string }).display_name} · ${sub.subject as string} for ${sub.child_name as string}`,
    subscriptionId,
    meta: { period: "renewal", for_period_start: sub.current_period_end },
  })
  if ("error" in tx) return { ok: false, error: tx.error }
  return { ok: true, transactionId: tx.id }
}

// ── Registration fee (teachers / sellers) ────────────────────

export async function checkoutRegistration(caller: CheckoutCaller): Promise<CheckoutResult> {
  if (caller.role !== "teacher" && caller.role !== "seller") {
    return { ok: false, error: "Registration fees apply to teacher and seller accounts only", status: 400 }
  }
  const admin = createAdminClient()
  const table = caller.role === "teacher" ? "teachers" : "sellers"
  const { data: row } = await admin.from(table).select("id, registration_fee_paid").eq("user_id", caller.userId).maybeSingle()
  if (!row) return { ok: false, error: "Complete your profile before paying the registration fee", status: 409 }
  if ((row as { registration_fee_paid: boolean | null }).registration_fee_paid) {
    return { ok: false, error: "Your registration fee is already paid", status: 409 }
  }

  const { data: openTx } = await admin
    .from("transactions")
    .select("id, reference_code")
    .eq("payer_id", caller.userId)
    .eq("type", "registration")
    .eq("status", "pending")
    .limit(1)
  if (openTx && openTx.length > 0) {
    const r = openTx[0] as { id: string; reference_code: string }
    return { ok: true, transactionId: r.id, referenceCode: r.reference_code, free: false }
  }

  const settings = await getCommerceSettings()
  const fee = caller.role === "teacher" ? settings.teacherRegistrationFeePkr : settings.sellerRegistrationFeePkr

  const tx = await insertPendingTransaction({
    type: "registration",
    payerId: caller.userId,
    payeeId: null,
    gross: fee,
    fee,
    net: 0,
    currency: "PKR",
    description: `${caller.role === "teacher" ? "Teacher" : "Seller"} registration fee`,
    meta: { role: caller.role, profile_id: (row as { id: string }).id },
  })
  if ("error" in tx) return { ok: false, error: tx.error, status: 500 }
  return { ok: true, transactionId: tx.id, referenceCode: tx.referenceCode, free: fee === 0 }
}

// ── Featured listing (teachers / sellers) ────────────────────

export async function checkoutFeatured(caller: CheckoutCaller, days: 7 | 30): Promise<CheckoutResult> {
  if (caller.role !== "teacher" && caller.role !== "seller") {
    return { ok: false, error: "Featured listings are for teacher and seller accounts only", status: 400 }
  }
  const admin = createAdminClient()
  const table = caller.role === "teacher" ? "teachers" : "sellers"
  const { data: row } = await admin.from(table).select("id, status").eq("user_id", caller.userId).maybeSingle()
  if (!row || (row as { status: string | null }).status !== "approved") {
    return { ok: false, error: "Your profile must be approved first", status: 409 }
  }

  const { data: openTx } = await admin
    .from("transactions")
    .select("id, reference_code, meta")
    .eq("payer_id", caller.userId)
    .eq("type", "featured")
    .eq("status", "pending")
    .limit(20)
  const reusable = ((openTx ?? []) as Array<{ id: string; reference_code: string; meta: Record<string, unknown> | null }>).find(
    (t) => Number(t.meta?.days) === days
  )
  if (reusable) return { ok: true, transactionId: reusable.id, referenceCode: reusable.reference_code, free: false }

  const settings = await getCommerceSettings()
  const price = days === 7 ? settings.featured7dPricePkr : settings.featured30dPricePkr

  const tx = await insertPendingTransaction({
    type: "featured",
    payerId: caller.userId,
    payeeId: null,
    gross: price,
    fee: price,
    net: 0,
    currency: "PKR",
    description: `Featured listing — ${days} days`,
    meta: { role: caller.role, profile_id: (row as { id: string }).id, days },
  })
  if ("error" in tx) return { ok: false, error: tx.error, status: 500 }
  return { ok: true, transactionId: tx.id, referenceCode: tx.referenceCode, free: price === 0 }
}
