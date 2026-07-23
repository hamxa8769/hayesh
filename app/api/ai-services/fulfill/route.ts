import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { runAgent } from "@/lib/ai/claude"
import type { AIOrderUserInputs, AIService, AIServiceInputField } from "@/types/database"

/**
 * /api/ai-services/fulfill
 *
 * Runs the Claude agent for a single ai_orders row. The buyer who placed
 * the order (or an admin) triggers this after checkout; the AI generates
 * ai_orders.ai_output and marks the order completed.
 *
 * Security:
 * - Auth via the cookie-scoped client (createClient()) — identifies who is
 *   calling and enforces ownership (buyer_id match) or admin override.
 * - The service's system_prompt is READ ONLY via the service-role client
 *   (createAdminClient()) — migration 013 revokes SELECT on that column for
 *   anon/authenticated, so buyers structurally cannot see it even if this
 *   route had a bug.
 * - ai_output / status / fulfilled_at / model_used are WRITTEN ONLY via the
 *   service-role client — migration 013 revokes buyer UPDATE on those
 *   columns, so this route is the only path that can set them.
 * - Double-fulfillment guard: the order is atomically claimed (status set to
 *   'in_progress' only if not already 'completed') before the model runs.
 */

const fulfillBodySchema = z.object({
  order_id: z.string().trim().min(1, "order_id is required"),
})

interface ErrorResponse {
  error: string
}

interface FulfillOrderRow {
  id: string
  service_id: string
  buyer_id: string
  status: string | null
  user_inputs: AIOrderUserInputs
}

function buildUserContent(inputSchema: AIServiceInputField[], userInputs: AIOrderUserInputs): string {
  if (!Array.isArray(inputSchema) || inputSchema.length === 0) {
    const entries = Object.entries(userInputs ?? {})
    if (entries.length === 0) return "(no additional details provided)"
    return entries.map(([key, value]) => `${key}: ${value ?? ""}`).join("\n\n")
  }

  const lines = inputSchema
    .map((field) => {
      const raw = userInputs?.[field.field_name]
      if (raw === undefined || raw === null || raw === "") return null
      return `${field.label}:\n${String(raw)}`
    })
    .filter((line): line is string => line !== null)

  return lines.length > 0 ? lines.join("\n\n") : "(no additional details provided)"
}

function outputFormatInstruction(format: string | null): string {
  switch (format) {
    case "code":
      return "\n\nDeliver your response as code with a brief explanation, formatted in markdown code blocks."
    case "document":
      return "\n\nDeliver your response as a well-formatted document with clear headings."
    case "json":
      return "\n\nDeliver your response as valid JSON only — no prose outside the JSON."
    default:
      return ""
  }
}

export async function POST(request: Request): Promise<NextResponse<{ output: string; status: string } | ErrorResponse>> {
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
  const { order_id: orderId } = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const adminClient = createAdminClient()

  // Load the order via the service-role client so ownership can be checked
  // explicitly below, in one consistent flow.
  const { data: order, error: orderError } = await adminClient
    .from("ai_orders")
    .select("id, service_id, buyer_id, status, user_inputs")
    .eq("id", orderId)
    .maybeSingle()

  if (orderError) {
    return NextResponse.json({ error: orderError.message }, { status: 400 })
  }
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  const typedOrder = order as FulfillOrderRow

  if (typedOrder.buyer_id !== user.id) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "You do not have permission to fulfil this order" }, { status: 403 })
    }
  }

  if (typedOrder.status === "completed") {
    return NextResponse.json({ error: "This order has already been fulfilled" }, { status: 409 })
  }

  // Atomically claim the order — if another request already completed it
  // between our read above and now, this update affects zero rows.
  const { data: claimedRows, error: claimError } = await adminClient
    .from("ai_orders")
    .update({ status: "in_progress" })
    .eq("id", orderId)
    .neq("status", "completed")
    .select("id")

  if (claimError) {
    return NextResponse.json({ error: claimError.message }, { status: 400 })
  }
  if (!claimedRows || claimedRows.length === 0) {
    return NextResponse.json({ error: "This order has already been fulfilled" }, { status: 409 })
  }

  // system_prompt is only ever read here, via the service-role client.
  const { data: service, error: serviceError } = await adminClient
    .from("ai_services")
    .select("id, title, system_prompt, ai_model, output_format, input_schema, status")
    .eq("id", typedOrder.service_id)
    .maybeSingle()

  if (serviceError) {
    return NextResponse.json({ error: serviceError.message }, { status: 400 })
  }
  if (!service) {
    return NextResponse.json({ error: "The service for this order no longer exists" }, { status: 404 })
  }

  const typedService = service as Pick<
    AIService,
    "id" | "title" | "system_prompt" | "ai_model" | "output_format" | "input_schema" | "status"
  >

  const userContent =
    buildUserContent(typedService.input_schema ?? [], typedOrder.user_inputs) +
    outputFormatInstruction(typedService.output_format)

  const result = await runAgent({
    system: typedService.system_prompt,
    userContent,
    model: typedService.ai_model ?? undefined,
    maxTokens: typedService.output_format === "code" || typedService.output_format === "document" ? 8192 : 4096,
  })

  if (!result.ok) {
    // Leave the order retryable: if this was a transient failure, revert to
    // 'pending' so the buyer (or a retry) can fulfil it again. Non-retryable
    // failures (bad config, refusal) stay 'in_progress' so an admin notices
    // rather than the buyer silently retrying forever.
    if (result.retryable) {
      await adminClient.from("ai_orders").update({ status: "pending" }).eq("id", orderId)
    }
    return NextResponse.json({ error: result.error }, { status: result.retryable ? 502 : 422 })
  }

  const { data: updated, error: updateError } = await adminClient
    .from("ai_orders")
    .update({
      ai_output: result.text,
      status: "completed",
      fulfilled_at: new Date().toISOString(),
      model_used: result.modelUsed,
    })
    .eq("id", orderId)
    .select("status")
    .maybeSingle()

  if (updateError) {
    // The AI succeeded but we couldn't persist it — leave the order
    // retryable rather than losing the generation silently.
    await adminClient.from("ai_orders").update({ status: "pending" }).eq("id", orderId)
    return NextResponse.json({ error: "Generated output could not be saved. Please try again." }, { status: 500 })
  }

  return NextResponse.json({ output: result.text, status: updated?.status ?? "completed" })
}
