import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import type { UserRole } from "@/types/database"

interface JarvisRequest {
  query: string
  context?: string
}

async function classifyIntent(query: string): Promise<"simple" | "medium" | "complex"> {
  const lower = query.toLowerCase()
  if (lower.length < 30 || /^(hi|hello|hey|help|what|who|when|where|how are you)/.test(lower)) {
    return "simple"
  }
  if (/(create|update|delete|send|book|approve|reject|schedule|pay|translate)/i.test(lower)) {
    return "complex"
  }
  return "medium"
}

async function callAI(query: string, role: UserRole, intent: "simple" | "medium" | "complex"): Promise<string> {
  const openrouterKey = process.env.OPENROUTER_API_KEY
  const anthropicKey = process.env.ANTHROPIC_API_KEY

  const systemPrompt = `You are JARVIS, the AI assistant for Hayesh — a tutoring marketplace platform.
Current user role: ${role}.
You help users navigate the platform, manage their profiles, answer questions about teachers/services, and perform platform actions.
Be concise, helpful, and professional. Respond in natural language.`

  if (intent === "complex" && anthropicKey) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: query }],
      }),
    })
    const data = await res.json()
    return data.content?.[0]?.text || "I couldn't process that request."
  }

  if (openrouterKey) {
    const model = intent === "simple" ? "meta-llama/llama-4-maverick:free" : "openai/gpt-oss-120b"
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openrouterKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: query },
        ],
        max_tokens: 1024,
      }),
    })
    const data = await res.json()
    return data.choices?.[0]?.message?.content || "I couldn't process that request."
  }

  return "JARVIS AI is not configured. Please set OPENROUTER_API_KEY or ANTHROPIC_API_KEY in your environment."
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  const role = (profile?.role || "buyer") as UserRole

  const body: JarvisRequest = await request.json()
  if (!body.query) {
    return NextResponse.json({ error: "Query is required" }, { status: 400 })
  }

  const intent = await classifyIntent(body.query)
  const response = await callAI(body.query, role, intent)

  return NextResponse.json({ response, intent })
}
