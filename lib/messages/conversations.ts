import { createAdminClient } from "@/lib/supabase/admin"
import type { UserRole } from "@/types/database"

if (typeof window !== "undefined") {
  throw new Error("lib/messages/conversations.ts must never be imported client-side")
}

export type ConversationInput =
  | { gig_order_id: string }
  | { subscription_id: string }
  | { gig_id: string }
  | { support: true }

export type ConversationResult =
  | { ok: true; conversationId: string }
  | { ok: false; error: string; status: number }

interface Resolved {
  other: string
  context: "order" | "tuition" | "support" | "inquiry"
  gigOrderId: string | null
  subscriptionId: string | null
  gigId: string | null
}

const fail = (error: string, status: number): ConversationResult => ({ ok: false, error, status })

type ResolveResult = { ok: true; value: Resolved } | { ok: false; error: string; status: number }

async function resolveRelationship(callerId: string, input: ConversationInput): Promise<ResolveResult> {
  const admin = createAdminClient()

  if ("gig_order_id" in input) {
    const { data: order } = await admin
      .from("gig_orders")
      .select("id, buyer_id, seller_id, status")
      .eq("id", input.gig_order_id)
      .maybeSingle()
    if (!order) return { ok: false, error: "Order not found", status: 404 }
    const { data: seller } = await admin.from("sellers").select("user_id").eq("id", order.seller_id).maybeSingle()
    const sellerUserId = (seller?.user_id as string | undefined) ?? null
    if (!sellerUserId) return { ok: false, error: "Seller not found", status: 404 }
    const buyerId = order.buyer_id as string
    let other: string
    if (callerId === buyerId) other = sellerUserId
    else if (callerId === sellerUserId) other = buyerId
    else return { ok: false, error: "You are not part of this order", status: 403 }
    return { ok: true, value: { other, context: "order", gigOrderId: order.id as string, subscriptionId: null, gigId: null } }
  }

  if ("gig_id" in input) {
    const { data: gig } = await admin
      .from("gigs")
      .select("id, seller_id, status")
      .eq("id", input.gig_id)
      .maybeSingle()
    if (!gig || gig.status !== "approved") return { ok: false, error: "Gig not found", status: 404 }
    const { data: seller } = await admin.from("sellers").select("user_id").eq("id", gig.seller_id).maybeSingle()
    const sellerUserId = (seller?.user_id as string | undefined) ?? null
    if (!sellerUserId) return { ok: false, error: "Seller not found", status: 404 }
    if (sellerUserId === callerId) return { ok: false, error: "This is your own gig", status: 400 }
    return {
      ok: true,
      value: { other: sellerUserId, context: "inquiry", gigOrderId: null, subscriptionId: null, gigId: gig.id as string },
    }
  }

  if ("subscription_id" in input) {
    const { data: sub } = await admin
      .from("subscriptions")
      .select("id, parent_id, teacher_id")
      .eq("id", input.subscription_id)
      .maybeSingle()
    if (!sub) return { ok: false, error: "Subscription not found", status: 404 }
    const { data: teacher } = await admin.from("teachers").select("user_id").eq("id", sub.teacher_id).maybeSingle()
    const teacherUserId = (teacher?.user_id as string | undefined) ?? null
    if (!teacherUserId) return { ok: false, error: "Teacher not found", status: 404 }
    const parentId = sub.parent_id as string
    let other: string
    if (callerId === parentId) other = teacherUserId
    else if (callerId === teacherUserId) other = parentId
    else return { ok: false, error: "You are not part of this tuition", status: 403 }
    return { ok: true, value: { other, context: "tuition", gigOrderId: null, subscriptionId: sub.id as string, gigId: null } }
  }

  const { data: adminProfile } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()
  const adminId = (adminProfile?.id as string | undefined) ?? null
  if (!adminId) return { ok: false, error: "Support is unavailable right now", status: 503 }
  if (adminId === callerId) return { ok: false, error: "You are the support account", status: 400 }
  return { ok: true, value: { other: adminId, context: "support", gigOrderId: null, subscriptionId: null, gigId: null } }
}

/**
 * Finds or creates the conversation for a real relationship. Only the
 * participants of the order / tuition (or anyone, for support) can open one.
 */
export async function getOrCreateConversation(
  callerId: string,
  callerRole: UserRole,
  input: ConversationInput,
): Promise<ConversationResult> {
  if (callerRole === "admin" && !("support" in input)) {
    return fail("Admins can read conversations but not open them", 403)
  }

  const resolved = await resolveRelationship(callerId, input)
  if (!resolved.ok) return fail(resolved.error, resolved.status)
  const { other, context, gigOrderId, subscriptionId, gigId } = resolved.value

  const [a, b] = callerId < other ? [callerId, other] : [other, callerId]
  const admin = createAdminClient()

  const find = async (): Promise<string | null> => {
    let q = admin
      .from("conversations")
      .select("id")
      .eq("participant_a", a)
      .eq("participant_b", b)
      .eq("context", context)
    q = gigOrderId ? q.eq("gig_order_id", gigOrderId) : q.is("gig_order_id", null)
    q = subscriptionId ? q.eq("subscription_id", subscriptionId) : q.is("subscription_id", null)
    q = gigId ? q.eq("gig_id", gigId) : q.is("gig_id", null)
    const { data } = await q.limit(1).maybeSingle()
    return (data?.id as string | undefined) ?? null
  }

  const existing = await find()
  if (existing) return { ok: true, conversationId: existing }

  const { data: created, error } = await admin
    .from("conversations")
    .insert({
      participant_a: a,
      participant_b: b,
      context,
      gig_order_id: gigOrderId,
      subscription_id: subscriptionId,
      gig_id: gigId,
    })
    .select("id")
    .single()

  if (error || !created) {
    // Lost a creation race (unique violation) — return the winner.
    const raced = await find()
    if (raced) return { ok: true, conversationId: raced }
    return fail("Could not open conversation", 500)
  }
  return { ok: true, conversationId: created.id as string }
}
