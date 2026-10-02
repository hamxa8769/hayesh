import { NextResponse } from "next/server"
import { z } from "zod"
import { requireUser } from "@/lib/auth/require-user"
import { createAdminClient } from "@/lib/supabase/admin"
import { notifyUser } from "@/lib/notifications"
import { rateLimit } from "@/lib/security/rate-limit"
import type { Message } from "@/types/database"

const bodySchema = z.object({
  conversation_id: z.string().uuid(),
  content: z.string().trim().min(1, "Message cannot be empty").max(4000, "Message is too long"),
})

type ErrorBody = { error: string }

export async function POST(request: Request): Promise<NextResponse<{ message: Message } | ErrorBody>> {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const { userId, fullName, supabase } = auth.user

  const limit = rateLimit(`msg:${userId}`, 30, 60_000)
  if (!limit.ok) {
    return NextResponse.json(
      { error: `You're sending messages too fast. Try again in ${limit.retryAfterSeconds}s` },
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
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 })
  }
  const { conversation_id, content } = parsed.data

  // User client: RLS only returns conversations the caller participates in.
  const { data: conv } = await supabase
    .from("conversations")
    .select("id, participant_a, participant_b")
    .eq("id", conversation_id)
    .maybeSingle()
  if (!conv || (conv.participant_a !== userId && conv.participant_b !== userId)) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
  }
  const receiverId = (conv.participant_a === userId ? conv.participant_b : conv.participant_a) as string

  const { data: inserted, error } = await supabase
    .from("messages")
    .insert({ conversation_id, sender_id: userId, receiver_id: receiverId, content })
    .select("id, conversation_id, sender_id, receiver_id, content, attachment_url, read, created_at")
    .single()
  if (error || !inserted) {
    return NextResponse.json({ error: "Could not send message" }, { status: 400 })
  }

  // Throttle: notify only for the first unread message in the thread.
  const admin = createAdminClient()
  const { count } = await admin
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversation_id)
    .eq("receiver_id", receiverId)
    .eq("read", false)
    .lt("created_at", inserted.created_at as string)
  if ((count ?? 0) === 0) {
    await notifyUser({
      userId: receiverId,
      type: "message_received",
      title: `New message from ${fullName}`,
      message: content.slice(0, 140),
      actionUrl: `/messages?c=${conversation_id}`,
    })
  }

  return NextResponse.json({ message: inserted as Message })
}
