import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import type { Notification } from "@/types/database"

const NOTIFICATIONS_LIMIT = 30

interface NotificationsGetResponse {
  notifications: Notification[]
  unreadCount: number
}

const PatchBodySchema = z.union([
  z.object({ id: z.string().uuid() }),
  z.object({ all: z.literal(true) }),
])

// Returns the authenticated user's notifications (newest first, capped) plus
// an unread count. RLS scopes rows to the caller's own user_id — this uses
// the cookie-based server client (never the admin client) so a user can
// only ever read their own notifications.
export async function GET(): Promise<NextResponse<NotificationsGetResponse | { error: string }>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: notifications, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(NOTIFICATIONS_LIMIT)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { count: unreadCount, error: countError } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("read", false)

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 })
  }

  return NextResponse.json({
    notifications: (notifications ?? []) as Notification[],
    unreadCount: unreadCount ?? 0,
  })
}

// Marks one notification (`{ id }`) or every unread notification (`{ all: true }`)
// as read. Always scoped to the authenticated user — a user_id is never
// accepted from the request body.
export async function PATCH(
  request: Request
): Promise<NextResponse<{ ok: true } | { error: string }>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = PatchBodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Body must be { id: string } or { all: true }" },
      { status: 400 }
    )
  }

  const query = supabase.from("notifications").update({ read: true }).eq("user_id", user.id)

  const { error } =
    "id" in parsed.data ? await query.eq("id", parsed.data.id) : await query.eq("read", false)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
