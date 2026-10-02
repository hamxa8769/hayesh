import { NextResponse } from "next/server"
import { z } from "zod"
import { requireUser } from "@/lib/auth/require-user"
import { createAdminClient } from "@/lib/supabase/admin"
import { fulfilAIOrder, isAIOrderPaid } from "@/lib/ai/fulfil-order"
import { rateLimit } from "@/lib/security/rate-limit"

/**
 * /api/ai-services/fulfill
 *
 * Buyer-triggered (re)run of a PAID AI order — used when automatic
 * fulfilment after payment failed transiently. An order is only ever
 * fulfilled once its transaction is 'completed', so this endpoint can't be
 * used to get AI output without paying.
 */

export const maxDuration = 60

const fulfillBodySchema = z.object({
  order_id: z.string().uuid("Invalid order id"),
})

export async function POST(request: Request): Promise<NextResponse<{ output: string; status: string } | { error: string }>> {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const { user } = auth

  const limited = rateLimit(`ai-fulfil:${user.userId}`, 5, 60_000)
  if (!limited.ok) return NextResponse.json({ error: "Too many attempts. Please wait a minute." }, { status: 429 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = fulfillBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 })
  }
  const orderId = parsed.data.order_id

  const admin = createAdminClient()
  const { data: order } = await admin.from("ai_orders").select("buyer_id").eq("id", orderId).maybeSingle()
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })
  if ((order as { buyer_id: string }).buyer_id !== user.userId && user.role !== "admin") {
    return NextResponse.json({ error: "You do not have permission to fulfil this order" }, { status: 403 })
  }

  if (!(await isAIOrderPaid(orderId))) {
    return NextResponse.json({ error: "Payment for this order has not been confirmed yet" }, { status: 402 })
  }

  const result = await fulfilAIOrder(orderId)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.httpStatus })
  return NextResponse.json({ output: result.output, status: result.status })
}
