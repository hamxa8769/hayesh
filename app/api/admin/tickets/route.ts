import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * /api/admin/tickets
 *
 * PATCH — admin changes status / priority / assignment on a
 * public.support_tickets row. Migration 010 revoked UPDATE on those
 * columns from `authenticated` (see
 * supabase-migrations/010-student-workflow-and-support.sql), so this must
 * go through the service-role client.
 *
 * POST — admin posts a reply or an internal-only note into
 * public.support_ticket_messages. `is_internal` is likewise revoked from
 * `authenticated` INSERT grants (a ticket owner can never mark their own
 * message internal), so admin-flagged internal notes also require the
 * service-role client.
 *
 * Both handlers re-verify admin role server-side from `profiles` — the
 * caller's role is never trusted from the request body.
 */

const patchTicketSchema = z.object({
  ticket_id: z.string().uuid(),
  status: z.enum(["open", "pending", "resolved", "closed"]).optional(),
  priority: z.enum(["low", "normal", "high"]).optional(),
  assigned_admin_id: z.string().uuid().nullable().optional(),
})

const postMessageSchema = z.object({
  ticket_id: z.string().uuid(),
  body: z.string().trim().min(1, "Message cannot be empty").max(4000, "Keep it under 4000 characters"),
  is_internal: z.boolean().optional().default(false),
})

interface TicketErrorResponse {
  error: string
}

async function requireAdmin(): Promise<
  { ok: true; userId: string } | { ok: false; response: NextResponse<TicketErrorResponse> }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  if (profile?.role !== "admin") {
    return { ok: false, response: NextResponse.json({ error: "Admin access required" }, { status: 403 }) }
  }

  return { ok: true, userId: user.id }
}

export async function PATCH(
  request: Request
): Promise<NextResponse<{ id: string } | TicketErrorResponse>> {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = patchTicketSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 })
  }

  const { ticket_id, status, priority, assigned_admin_id } = parsed.data

  if (status === undefined && priority === undefined && assigned_admin_id === undefined) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
  }

  const updates: Record<string, string | null> = {}
  if (status !== undefined) updates.status = status
  if (priority !== undefined) updates.priority = priority
  if (assigned_admin_id !== undefined) updates.assigned_admin_id = assigned_admin_id
  if (status === "resolved") updates.resolved_at = new Date().toISOString()

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from("support_tickets")
    .update(updates)
    .eq("id", ticket_id)
    .select("id")
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  if (!data) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 })
  }

  return NextResponse.json({ id: data.id })
}

export async function POST(
  request: Request
): Promise<NextResponse<{ id: string } | TicketErrorResponse>> {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = postMessageSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 })
  }

  const { ticket_id, body: messageBody, is_internal } = parsed.data
  const adminClient = createAdminClient()

  const { data: ticket } = await adminClient
    .from("support_tickets")
    .select("id")
    .eq("id", ticket_id)
    .maybeSingle()

  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 })
  }

  const { data, error } = await adminClient
    .from("support_ticket_messages")
    .insert({
      ticket_id,
      sender_id: auth.userId,
      body: messageBody,
      is_internal,
    })
    .select("id")
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  if (!data) {
    return NextResponse.json({ error: "Message was not created" }, { status: 400 })
  }

  return NextResponse.json({ id: data.id })
}
