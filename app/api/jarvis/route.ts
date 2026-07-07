import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { chatCompletion, classifyIntent } from "@/lib/ai/router"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { query } = await req.json()
  if (!query) return NextResponse.json({ error: "No query" }, { status: 400 })

  const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single()

  try {
    // Classify intent to pick the right model tier
    const complexity = await classifyIntent(query)

    const systemPrompt = `You are JARVIS, the AI assistant for Hayesh — a tutoring-first marketplace platform.
User role: ${profile?.role || "unknown"}${profile?.full_name ? ` (${profile.full_name})` : ""}.
Current date: ${new Date().toISOString().split("T")[0]}.

Be helpful, concise, and role-aware. Respond in natural language — never raw JSON.
You can help with: finding teachers, managing sessions, viewing earnings, platform questions.`

    const answer = await chatCompletion({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: query },
      ],
      maxTokens: complexity === "simple" ? 256 : complexity === "medium" ? 512 : 1024,
    })

    return NextResponse.json({ answer, complexity })
  } catch {
    return NextResponse.json({ answer: "JARVIS is temporarily unavailable. Please try again." })
  }
}
