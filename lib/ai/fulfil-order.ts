import { createAdminClient } from "@/lib/supabase/admin"
import { runAgent } from "@/lib/ai/claude"
import type { AIOrderUserInputs, AIService, AIServiceInputField } from "@/types/database"

if (typeof window !== "undefined") {
  throw new Error("lib/ai/fulfil-order.ts must never be imported client-side")
}

/**
 * Runs the Claude agent for one PAID ai_orders row and stores the output.
 *
 * Shared by /api/ai-services/fulfill (buyer retry) and the payment
 * confirmation path (lib/payments/settle.ts), so an order is fulfilled the
 * moment its payment clears. All reads/writes use the service-role client:
 * system_prompt is never selectable by buyers (migration 013).
 */

interface FulfillOrderRow {
  id: string
  service_id: string
  buyer_id: string
  status: string | null
  user_inputs: AIOrderUserInputs
}

export type FulfilResult =
  | { ok: true; output: string; status: string }
  | { ok: false; error: string; httpStatus: number }

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

/** True when the order has a settled payment (or was free). */
export async function isAIOrderPaid(orderId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data } = await admin
    .from("transactions")
    .select("id")
    .eq("ai_order_id", orderId)
    .eq("status", "completed")
    .limit(1)
  return (data?.length ?? 0) > 0
}

export async function fulfilAIOrder(orderId: string): Promise<FulfilResult> {
  const adminClient = createAdminClient()

  const { data: order, error: orderError } = await adminClient
    .from("ai_orders")
    .select("id, service_id, buyer_id, status, user_inputs")
    .eq("id", orderId)
    .maybeSingle()

  if (orderError) return { ok: false, error: orderError.message, httpStatus: 400 }
  if (!order) return { ok: false, error: "Order not found", httpStatus: 404 }

  const typedOrder = order as FulfillOrderRow
  if (typedOrder.status === "completed") {
    return { ok: false, error: "This order has already been fulfilled", httpStatus: 409 }
  }
  if (typedOrder.status === "cancelled") {
    return { ok: false, error: "This order was cancelled", httpStatus: 409 }
  }

  // Atomically claim the order — only one request can move it out of
  // 'pending' so the model never runs twice for the same order.
  const { data: claimedRows, error: claimError } = await adminClient
    .from("ai_orders")
    .update({ status: "in_progress" })
    .eq("id", orderId)
    .eq("status", "pending")
    .select("id")

  if (claimError) return { ok: false, error: claimError.message, httpStatus: 400 }
  if (!claimedRows || claimedRows.length === 0) {
    return { ok: false, error: "This order is already being processed", httpStatus: 409 }
  }

  const { data: service, error: serviceError } = await adminClient
    .from("ai_services")
    .select("id, title, system_prompt, ai_model, output_format, input_schema, status")
    .eq("id", typedOrder.service_id)
    .maybeSingle()

  if (serviceError || !service) {
    await adminClient.from("ai_orders").update({ status: "pending" }).eq("id", orderId)
    return { ok: false, error: "The service for this order is unavailable", httpStatus: 404 }
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
    // Revert to 'pending' so the buyer can retry from their orders page.
    await adminClient.from("ai_orders").update({ status: "pending" }).eq("id", orderId)
    return { ok: false, error: result.error, httpStatus: result.retryable ? 502 : 422 }
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
    await adminClient.from("ai_orders").update({ status: "pending" }).eq("id", orderId)
    return { ok: false, error: "Generated output could not be saved. Please try again.", httpStatus: 500 }
  }

  return { ok: true, output: result.text, status: (updated?.status as string | undefined) ?? "completed" }
}
