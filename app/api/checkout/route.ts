import { NextResponse } from "next/server"
import { z } from "zod"
import { requireUser } from "@/lib/auth/require-user"
import { rateLimit } from "@/lib/security/rate-limit"
import { checkoutAIService, checkoutFeatured, checkoutGig, checkoutRegistration, checkoutTuition, type CheckoutResult } from "@/lib/payments/checkout"
import { markTransactionPaid } from "@/lib/payments/settle"

/**
 * POST /api/checkout
 *
 * Starts a purchase: creates the order + a pending transaction and returns
 * its id; the client then sends the buyer to /checkout/<transaction_id>.
 * Prices are always resolved server-side from the database.
 */

export const maxDuration = 60

const checkoutSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("ai_service"),
    service_id: z.string().uuid(),
    inputs: z.record(z.string(), z.string().max(20000)).default({}),
  }),
  z.object({
    kind: z.literal("gig"),
    gig_id: z.string().uuid(),
    tier: z.enum(["basic", "standard", "premium"]),
    requirements: z.string().trim().min(10, "Please describe what you need (at least 10 characters)").max(5000),
  }),
  z.object({
    kind: z.literal("tuition"),
    teacher_id: z.string().uuid(),
    tier: z.enum(["group", "standard", "private"]),
    child_name: z.string().trim().min(2, "Enter your child's name").max(100),
    subject: z.string().trim().min(2, "Choose a subject").max(100),
    student_id: z.string().uuid().optional(),
  }),
  z.object({ kind: z.literal("registration") }),
  z.object({ kind: z.literal("featured"), days: z.union([z.literal(7), z.literal(30)]) }),
])

export async function POST(request: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const { user } = auth

  const limited = rateLimit(`checkout:${user.userId}`, 10, 60_000)
  if (!limited.ok) return NextResponse.json({ error: "Too many checkout attempts. Please wait a minute." }, { status: 429 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  const parsed = checkoutSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 })
  }

  const caller = { userId: user.userId, role: user.role, fullName: user.fullName }
  const input = parsed.data
  let result: CheckoutResult
  switch (input.kind) {
    case "ai_service":
      result = await checkoutAIService(caller, input.service_id, input.inputs)
      break
    case "gig":
      result = await checkoutGig(caller, input.gig_id, input.tier, input.requirements)
      break
    case "tuition":
      result = await checkoutTuition(caller, {
        teacherId: input.teacher_id,
        tier: input.tier,
        childName: input.child_name,
        subject: input.subject,
        studentId: input.student_id,
      })
      break
    case "registration":
      result = await checkoutRegistration(caller)
      break
    case "featured":
      result = await checkoutFeatured(caller, input.days)
      break
  }

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  // Zero-priced items (e.g. a free AI service or waived fee) settle instantly.
  if (result.free) {
    await markTransactionPaid(result.transactionId, { processor: "manual", processorRef: "free" })
  }

  return NextResponse.json({ transaction_id: result.transactionId, reference_code: result.referenceCode, free: result.free })
}
