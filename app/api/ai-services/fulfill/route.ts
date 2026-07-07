import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { claudeCompletion } from "@/lib/ai/router"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { service_id, input } = await req.json()
  if (!service_id) return NextResponse.json({ error: "No service ID" }, { status: 400 })

  const { data: service } = await supabase.from("ai_services").select("*").eq("id", service_id).single()
  if (!service) return NextResponse.json({ error: "Service not found" }, { status: 404 })

  try {
    const systemPrompt = service.system_prompt || "You are a helpful AI assistant."
    const output = await claudeCompletion({
      system: systemPrompt,
      prompt: input || "Hello",
      model: service.ai_model || undefined,
      maxTokens: 4096,
    })

    await supabase.from("ai_orders").insert({
      service_id, buyer_id: user.id,
      user_inputs: { input },
      ai_output: output,
      amount_pkr: service.price_pkr || 0,
      status: "completed",
      model_used: service.ai_model || "auto",
      fulfilled_at: new Date().toISOString(),
    })

    return NextResponse.json({ output })
  } catch {
    return NextResponse.json({ error: "AI fulfillment failed" }, { status: 500 })
  }
}
