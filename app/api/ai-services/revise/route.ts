import { NextResponse } from "next/server"
import { z } from "zod"
import { requireUser } from "@/lib/auth/require-user"
import { createAdminClient } from "@/lib/supabase/admin"
import { reviseAIOrder } from "@/lib/ai/fulfil-order"
import { rateLimit } from "@/lib/security/rate-limit"

/**
 * /api/ai-services/revise
 *
 * Buyer-requested revision of a delivered AI order. Limited to
 * ai_services.revisions_allowed per order (enforced atomically in
 * reviseAIOrder) and rate limited because each call runs the model.
 */

export const maxDuration = 60

const reviseBodySchema = z.object({
  order_id: z.string().uuid("Invalid order id"),
  request: z.string().trim().min(5, "Describe the changes you want (at least 5 characters)").max(2000, "Keep your request under 2000 characters"),
})

export async function POST(request: Request): Promise<NextResponse<{ output: string } | { error: string }>> {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const { user } = auth

  const limited = rateLimit(`ai-revise:${user.userId}`, 5, 60_000)
  if (!limited.ok) return NextResponse.json({ error: "Too many attempts. Please wait a minute." }, { status: 429 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = reviseBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: order } = await admin.from("ai_orders").select("buyer_id").eq("id", parsed.data.order_id).maybeSingle()
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })
  if ((order as { buyer_id: string }).buyer_id !== user.userId) {
    return NextResponse.json({ error: "You do not have permission to revise this order" }, { status: 403 })
  }

  const result = await reviseAIOrder(parsed.data.order_id, parsed.data.request)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.httpStatus })
  return NextResponse.json({ output: result.output })
}
