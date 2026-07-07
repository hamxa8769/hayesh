import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { query } = await req.json()
  if (!query) return NextResponse.json({ error: "No query" }, { status: 400 })

  // Get user profile for context
  const { data: profile } = await supabase.from("profiles").select("role, display_name").eq("id", user.id).single()

  try {
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 })

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "meta-llama/llama-4-maverick:free",
        messages: [
          { role: "system", content: `You are JARVIS, the AI assistant for Hayesh platform. User role: ${profile?.role || "unknown"}. Be helpful, concise, and role-aware. Current date: ${new Date().toISOString().split("T")[0]}.` },
          { role: "user", content: query },
        ],
      }),
    })

    const data = await res.json()
    const answer = data.choices?.[0]?.message?.content || "I couldn't process that request."
    return NextResponse.json({ answer })
  } catch {
    return NextResponse.json({ answer: "JARVIS is temporarily unavailable. Please try again." })
  }
}
