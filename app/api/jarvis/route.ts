import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireUser } from "@/lib/auth/require-user"
import { runJarvis } from "@/lib/ai/jarvis-agent"
import { rateLimit } from "@/lib/security/rate-limit"

export const maxDuration = 60

const MAX_QUERY_CHARS = 2000

const bodySchema = z.object({
  query: z.string().trim().min(1, "No query"),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().transform((c) => c.slice(0, MAX_QUERY_CHARS)) }))
    .max(10)
    .optional(),
})

export async function POST(req: NextRequest): Promise<NextResponse<{ answer: string } | { error: string }>> {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const { user } = auth

  const limited = rateLimit(`jarvis:${user.userId}`, 20, 60_000)
  if (!limited.ok) {
    return NextResponse.json({ error: "You're sending messages too quickly. Please wait a moment." }, { status: 429 })
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: "No query" }, { status: 400 })
  if (parsed.data.query.length > MAX_QUERY_CHARS) {
    return NextResponse.json({ error: `Please keep messages under ${MAX_QUERY_CHARS} characters` }, { status: 413 })
  }

  const answer = await runJarvis({
    query: parsed.data.query,
    history: parsed.data.history,
    fullName: user.fullName,
    ctx: { userId: user.userId, role: user.role, supabase: user.supabase },
  })
  return NextResponse.json({ answer })
}
