/**
 * Hayesh — AI Router
 *
 * Routes AI requests through:
 *   Dev:  OmniRoute (localhost:20128/v1) — free tiers, auto/coding strategy
 *   Prod: OpenRouter (simple/medium) + Anthropic (complex/agentic)
 *
 * OmniRoute is OpenAI-compatible, so both dev/prod use the same
 * /v1/chat/completions format for JARVIS. AI services use Anthropic
 * format in prod but OpenAI format via OmniRoute in dev.
 */

const isDev = process.env.NODE_ENV === "development"
const OMNIROUTE_URL = process.env.OMNIROUTE_BASE_URL || "http://localhost:20128/v1"
const OPENROUTER_URL = "https://openrouter.ai/api/v1"
const ANTHROPIC_URL = "https://api.anthropic.com/v1"

// ── JARVIS (simple/medium queries) ────────────────────────────

interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

interface ChatOptions {
  messages: ChatMessage[]
  model?: string
  maxTokens?: number
}

/**
 * OpenAI-compatible chat completion.
 * Dev: routes through OmniRoute (auto/coding — burns free quotas first)
 * Prod: routes through OpenRouter (Llama 4 Maverick free tier)
 */
export async function chatCompletion(opts: ChatOptions): Promise<string> {
  const { messages, model, maxTokens = 1024 } = opts

  if (isDev && OMNIROUTE_URL) {
    return openaiCompat(OMNIROUTE_URL, undefined, {
      model: model || "auto",
      messages,
      max_tokens: maxTokens,
    })
  }

  // Production: OpenRouter
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set")

  return openaiCompat(OPENROUTER_URL, apiKey, {
    model: model || "meta-llama/llama-4-maverick:free",
    messages,
    max_tokens: maxTokens,
  })
}

// ── AI Services (complex/agentic tasks) ───────────────────────

interface ClaudeOptions {
  system: string
  prompt: string
  model?: string
  maxTokens?: number
}

/**
 * Anthropic-style completion for AI service fulfillment.
 * Dev: routes through OmniRoute (auto/coding — uses free Claude via Kiro etc.)
 * Prod: routes through Anthropic API directly (Claude Sonnet)
 */
export async function claudeCompletion(opts: ClaudeOptions): Promise<string> {
  const { system, prompt, model, maxTokens = 4096 } = opts

  if (isDev && OMNIROUTE_URL) {
    // OmniRoute is OpenAI-compatible, so we send OpenAI format
    // and the system message goes as the first message
    const messages: ChatMessage[] = [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ]
    return openaiCompat(OMNIROUTE_URL, undefined, {
      model: model || "auto",
      messages,
      max_tokens: maxTokens,
    })
  }

  // Production: Anthropic direct
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set")

  const res = await fetch(`${ANTHROPIC_URL}/messages`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: model || "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: prompt }],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Anthropic API error: ${res.status} ${err}`)
  }

  const data = await res.json()
  return data.content?.[0]?.text || "No output generated."
}

// ── Internal: OpenAI-compatible fetch ──────────────────────────

async function openaiCompat(
  baseUrl: string,
  apiKey: string | undefined,
  body: Record<string, unknown>,
): Promise<string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`AI API error: ${res.status} ${err}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content || "No response generated."
}

// ── Intent classifier (for JARVIS routing) ────────────────────

export type QueryComplexity = "simple" | "medium" | "complex"

/**
 * Classify query complexity to choose the right model tier.
 * Uses OmniRoute in dev (free), OpenRouter Scout in prod (cheapest).
 */
export async function classifyIntent(query: string): Promise<QueryComplexity> {
  const classifier = `
Classify this user query into exactly one category:
- simple: greetings, status checks, "what is", single-fact lookups
- medium: multi-step questions, moderate reasoning, summaries
- complex: code generation, multi-step planning, analysis, agentic tasks

Reply with ONLY the category word (simple, medium, or complex).`

  try {
    const result = await chatCompletion({
      messages: [
        { role: "system", content: classifier },
        { role: "user", content: query },
      ],
      model: isDev ? "auto" : "meta-llama/llama-4-scout:free",
      maxTokens: 10,
    })
    const trimmed = result.trim().toLowerCase()
    if (trimmed === "simple" || trimmed === "medium" || trimmed === "complex") return trimmed
    return "medium"
  } catch {
    return "medium"
  }
}
