import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { service_id, input } = await req.json()
  if (!service_id) return NextResponse.json({ error: "No service ID" }, { status: 400 })

  // Fetch service config
  const { data: service } = await supabase.from("ai_services").select("*").eq("id", service_id).single()
  if (!service) return NextResponse.json({ error: "Service not found" }, { status: 404 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 })

  try {
    const systemPrompt = service.system_prompt || "You are a helpful AI assistant."
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: service.model || "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: input || "Hello" }],
      }),
    })

    const data = await res.json()
    const output = data.content?.[0]?.text || "No output generated."

    // Record the order
    await supabase.from("ai_orders").insert({
      service_id, buyer_id: user.id, input, output,
      amount_pkr: service.price_pkr || 0, status: "completed",
    })

    return NextResponse.json({ output })
  } catch {
    return NextResponse.json({ error: "AI fulfillment failed" }, { status: 500 })
  }
}
