/**
 * Hayesh — HayeshAI Studio fulfillment client
 *
 * Server-only wrapper around @anthropic-ai/sdk used to fulfil AI Service
 * orders (ai_services / ai_orders). Never import this file from a Client
 * Component — it reads ANTHROPIC_API_KEY, which must never reach the
 * browser bundle.
 *
 * Model choice: `claude-sonnet-4-6` is used as the default. It is a
 * current, actively-supported Anthropic model (not a stale/retired id) and
 * gives the best cost/quality balance for a 100%-margin marketplace product
 * that fulfils many small-to-medium tasks (code snippets, cover letters,
 * CVs, SEO audits, blog posts) — Opus-tier quality is available as an
 * admin-selectable upgrade per service, Haiku as a cheap/fast downgrade.
 */

import Anthropic from "@anthropic-ai/sdk"

if (typeof window !== "undefined") {
  throw new Error("lib/ai/claude.ts must never be imported client-side")
}

/** Real, current Anthropic model ids an admin may assign to a service. */
export const AI_SERVICE_MODELS = [
  {
    id: "claude-sonnet-4-6",
    label: "Claude Sonnet 4.6 — recommended (balanced cost & quality)",
  },
  {
    id: "claude-haiku-4-5",
    label: "Claude Haiku 4.5 — fastest & cheapest",
  },
  {
    id: "claude-opus-4-8",
    label: "Claude Opus 4.8 — most capable, highest cost",
  },
] as const

export type AIServiceModelId = (typeof AI_SERVICE_MODELS)[number]["id"]

export const DEFAULT_AI_SERVICE_MODEL: AIServiceModelId = "claude-sonnet-4-6"

const KNOWN_MODEL_IDS: readonly string[] = AI_SERVICE_MODELS.map((m) => m.id)

/** Falls back to the default model if a service was configured with an unrecognized/stale id. */
export function resolveModelId(modelId: string | null | undefined): string {
  if (modelId && KNOWN_MODEL_IDS.includes(modelId)) return modelId
  return DEFAULT_AI_SERVICE_MODEL
}

export interface RunAgentParams {
  /** The service's internal system prompt. Never expose this to buyers. */
  system: string
  /** Buyer-supplied order content, built from ai_orders.user_inputs. */
  userContent: string
  model?: string
  maxTokens?: number
}

export interface RunAgentSuccess {
  ok: true
  text: string
  modelUsed: string
}

export interface RunAgentFailure {
  ok: false
  error: string
  /** True when the caller should leave the order in a re-fulfillable state and let the buyer retry. */
  retryable: boolean
}

export type RunAgentResult = RunAgentSuccess | RunAgentFailure

const DEFAULT_MAX_TOKENS = 4096
/** Keep responses well under the ~16K threshold where the SDK recommends streaming to avoid HTTP timeouts. */
const MAX_ALLOWED_TOKENS = 8192

/**
 * Runs a single-turn Claude completion for an AI Service order.
 * Never throws — all failure modes are returned as a typed result so API
 * routes can surface a real error without leaking the prompt or API key.
 */
export async function runAgent(params: RunAgentParams): Promise<RunAgentResult> {
  const { system, userContent } = params
  const model = resolveModelId(params.model)
  const maxTokens = Math.min(Math.max(params.maxTokens ?? DEFAULT_MAX_TOKENS, 256), MAX_ALLOWED_TOKENS)

  if (!system.trim()) {
    return { ok: false, error: "This service is not configured correctly. Please contact support.", retryable: false }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return {
      ok: false,
      error: "The AI fulfillment service is temporarily unavailable. Please try again shortly.",
      retryable: true,
    }
  }

  const client = new Anthropic({ apiKey })

  try {
    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: userContent }],
    })

    if (response.stop_reason === "refusal") {
      return {
        ok: false,
        error: "The AI declined to complete this request. Please review your inputs and try again.",
        retryable: false,
      }
    }

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n\n")
      .trim()

    if (!text) {
      return { ok: false, error: "The AI did not return any output. Please try again.", retryable: true }
    }

    return { ok: true, text, modelUsed: model }
  } catch (err: unknown) {
    if (err instanceof Anthropic.RateLimitError) {
      return { ok: false, error: "The AI service is busy right now. Please try again in a moment.", retryable: true }
    }
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      return { ok: false, error: "AI service configuration error. Please contact support.", retryable: false }
    }
    if (err instanceof Anthropic.BadRequestError) {
      return {
        ok: false,
        error: "The request could not be processed. Please check the order details and try again.",
        retryable: false,
      }
    }
    if (err instanceof Anthropic.APIError) {
      return { ok: false, error: "The AI service encountered an error. Please try again.", retryable: true }
    }
    return { ok: false, error: "An unexpected error occurred while generating your order. Please try again.", retryable: true }
  }
}
