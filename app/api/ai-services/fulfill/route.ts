import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { service_id, user_inputs } = body

  if (!service_id) {
    return NextResponse.json({ error: "service_id is required" }, { status: 400 })
  }

  const { data: service, error: serviceError } = await supabase
    .from("ai_services")
    .select("*")
    .eq("id", service_id)
    .single()

  if (serviceError || !service) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 })
  }

  const { data: order, error: orderError } = await supabase
    .from("ai_orders")
    .insert({
      service_id,
      buyer_id: user.id,
      user_inputs: user_inputs || {},
      amount_pkr: service.price_pkr,
      amount_usd: service.price_usd,
      currency: "PKR",
      status: "pending",
    })
    .select()
    .single()

  if (orderError) {
    return NextResponse.json({ error: orderError.message }, { status: 500 })
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (!anthropicKey) {
    await supabase.from("ai_orders").update({ status: "failed" }).eq("id", order.id)
    return NextResponse.json({ error: "AI service not configured" }, { status: 500 })
  }

  const inputSummary = Object.entries(user_inputs || {})
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n")

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: service.ai_model || "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: service.system_prompt,
        messages: [{ role: "user", content: inputSummary || "Please process this request." }],
      }),
    })

    const data = await res.json()
    const output = data.content?.[0]?.text || "No output generated."

    await supabase
      .from("ai_orders")
      .update({
        status: "completed",
        ai_output: output,
        completed_at: new Date().toISOString(),
      })
      .eq("id", order.id)

    return NextResponse.json({ order_id: order.id, output, status: "completed" })
  } catch {
    await supabase.from("ai_orders").update({ status: "failed" }).eq("id", order.id)
    return NextResponse.json({ error: "AI processing failed", order_id: order.id }, { status: 500 })
  }
}
