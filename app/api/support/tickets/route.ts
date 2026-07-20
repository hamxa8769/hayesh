import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { notifyAdmins } from "@/lib/notifications"
import { supportTicketSchema } from "@/components/teacher/teaching-schema"

/**
 * POST /api/support/tickets — any authenticated user (teacher, parent,
 * seller, buyer) raises a support ticket and posts its first message.
 *
 * Server route, not a direct client insert, because:
 *   1. Notifying every admin requires the service-role client in
 *      lib/notifications.ts (RLS on notifications only allows
 *      user_id = auth.uid()).
 *   2. It's one call site enforcing that only owner-permitted columns are
 *      ever sent — migration 010 REVOKEs insert/update on
 *      support_tickets/support_ticket_messages from `authenticated` and
 *      grants back only (user_id, subject, category) and
 *      (ticket_id, sender_id, body) respectively. status, priority,
 *      assigned_admin_id, and is_internal are admin/service-role only and
 *      are never sent from here.
 *
 * Both inserts run as the CALLER via the cookie-based client (not the
 * service role), so RLS + the column grants remain the real enforcement
 * boundary.
 */

interface CreateSuccessResponse {
  id: string
}

interface CreateErrorResponse {
  error: string
}

export async function POST(
  request: Request
): Promise<NextResponse<CreateSuccessResponse | CreateErrorResponse>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = supportTicketSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    )
  }

  const values = parsed.data

  // Owner-permitted columns only: user_id, subject, category. status,
  // priority, and assigned_admin_id are revoked from `authenticated` by
  // migration 010 and would fail with a column-privilege error if sent.
  const { data: ticket, error: ticketError } = await supabase
    .from("support_tickets")
    .insert({
      user_id: user.id,
      subject: values.subject,
      category: values.category || null,
    })
    .select("id")
    .maybeSingle()

  if (ticketError) {
    return NextResponse.json({ error: ticketError.message }, { status: 400 })
  }

  if (!ticket) {
    return NextResponse.json({ error: "Ticket was not created" }, { status: 400 })
  }

  const ticketId = (ticket as { id: string }).id

  // Owner-permitted columns only: ticket_id, sender_id, body. is_internal
  // is revoked from `authenticated` and defaults to false — a sender may
  // never mark their own message internal.
  const { error: messageError } = await supabase.from("support_ticket_messages").insert({
    ticket_id: ticketId,
    sender_id: user.id,
    body: values.message,
  })

  if (messageError) {
    return NextResponse.json({ error: messageError.message }, { status: 400 })
  }

  // Notification failure must never fail the request — the ticket has
  // already committed by this point.
  await notifyAdmins({
    type: "support_ticket_created",
    title: "New support ticket",
    message: values.subject,
    actionUrl: "/admin/support",
  })

  return NextResponse.json({ id: ticketId })
}
