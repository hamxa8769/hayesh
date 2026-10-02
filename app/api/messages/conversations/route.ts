import { NextResponse } from "next/server"
import { z } from "zod"
import { requireUser } from "@/lib/auth/require-user"
import { createAdminClient } from "@/lib/supabase/admin"
import { getOrCreateConversation } from "@/lib/messages/conversations"
import { rateLimit } from "@/lib/security/rate-limit"
import type { Conversation } from "@/types/database"

const bodySchema = z.union([
  z.object({ gig_order_id: z.string().uuid() }).strict(),
  z.object({ subscription_id: z.string().uuid() }).strict(),
  z.object({ support: z.literal(true) }).strict(),
])

export interface ConversationListItem {
  id: string
  context: Conversation["context"]
  context_label: string
  other_user_id: string
  other_name: string
  other_avatar_url: string | null
  last_message_at: string | null
  last_message_preview: string | null
  unread_count: number
}

export interface ConversationListResponse {
  items: ConversationListItem[]
  user_id: string
}

type ErrorBody = { error: string }

export async function GET(): Promise<NextResponse<ConversationListResponse | ErrorBody>> {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const { userId } = auth.user
  const admin = createAdminClient()

  let query = admin
    .from("conversations")
    .select("id, participant_a, participant_b, context, gig_order_id, subscription_id, last_message_at")
    .order("last_message_at", { ascending: false })
    .limit(100)
  // Inbox is the caller's own threads (admins can read others via RLS elsewhere).
  query = query.or(`participant_a.eq.${userId},participant_b.eq.${userId}`)
  const { data: convs, error } = await query
  if (error) return NextResponse.json({ error: "Could not load conversations" }, { status: 500 })
  const rows = convs ?? []
  if (rows.length === 0) return NextResponse.json({ items: [], user_id: userId })

  const otherIds = Array.from(
    new Set(rows.map((c) => (c.participant_a === userId ? (c.participant_b as string) : (c.participant_a as string)))),
  )
  const orderIds = rows.map((c) => c.gig_order_id as string | null).filter((v): v is string => !!v)
  const subIds = rows.map((c) => c.subscription_id as string | null).filter((v): v is string => !!v)
  const convIds = rows.map((c) => c.id as string)

  const [profiles, orders, subs, recent] = await Promise.all([
    admin.from("profiles").select("id, full_name, avatar_url").in("id", otherIds),
    orderIds.length ? admin.from("gig_orders").select("id, gig_title").in("id", orderIds) : Promise.resolve({ data: [] }),
    subIds.length ? admin.from("subscriptions").select("id, child_name").in("id", subIds) : Promise.resolve({ data: [] }),
    admin
      .from("messages")
      .select("conversation_id, content, read, receiver_id, created_at")
      .in("conversation_id", convIds)
      .order("created_at", { ascending: false })
      .limit(1000),
  ])

  const profileMap = new Map<string, { full_name: string | null; avatar_url: string | null }>()
  for (const p of profiles.data ?? []) {
    profileMap.set(p.id as string, { full_name: p.full_name as string | null, avatar_url: p.avatar_url as string | null })
  }
  const orderTitle = new Map<string, string>()
  for (const o of orders.data ?? []) orderTitle.set(o.id as string, (o.gig_title as string | null) ?? "Order")
  const childName = new Map<string, string>()
  for (const s of subs.data ?? []) childName.set(s.id as string, (s.child_name as string | null) ?? "")

  const preview = new Map<string, string>()
  const unread = new Map<string, number>()
  for (const m of recent.data ?? []) {
    const cid = m.conversation_id as string
    if (!preview.has(cid)) preview.set(cid, String(m.content).slice(0, 100))
    if (m.receiver_id === userId && m.read === false) unread.set(cid, (unread.get(cid) ?? 0) + 1)
  }

  const items: ConversationListItem[] = rows.map((c) => {
    const otherId = c.participant_a === userId ? (c.participant_b as string) : (c.participant_a as string)
    const prof = profileMap.get(otherId)
    const context = c.context as Conversation["context"]
    let label = "Hayesh Support"
    if (context === "order") label = orderTitle.get(c.gig_order_id as string) ?? "Order"
    if (context === "tuition") label = `Tuition · ${childName.get(c.subscription_id as string) || "Student"}`
    return {
      id: c.id as string,
      context,
      context_label: label,
      other_user_id: otherId,
      other_name: context === "support" ? "Hayesh Support" : (prof?.full_name ?? "User"),
      other_avatar_url: prof?.avatar_url ?? null,
      last_message_at: c.last_message_at as string | null,
      last_message_preview: preview.get(c.id as string) ?? null,
      unread_count: unread.get(c.id as string) ?? 0,
    }
  })

  return NextResponse.json({ items, user_id: userId })
}

export async function POST(request: Request): Promise<NextResponse<{ conversation_id: string } | ErrorBody>> {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const { userId, role } = auth.user

  const limit = rateLimit(`conv:${userId}`, 30, 60_000)
  if (!limit.ok) {
    return NextResponse.json(
      { error: `Too many requests. Try again in ${limit.retryAfterSeconds}s` },
      { status: 429 },
    )
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 })

  const result = await getOrCreateConversation(userId, role, parsed.data)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ conversation_id: result.conversationId })
}
