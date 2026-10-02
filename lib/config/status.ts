if (typeof window !== "undefined") {
  throw new Error("lib/config/status.ts must never be imported client-side")
}

export type ConfigLevel = "required" | "recommended" | "optional"

export interface ConfigCheck {
  key: string
  label: string
  level: ConfigLevel
  ok: boolean
  /** What breaks when it's missing — shown to admins, never to customers. */
  impact: string
}

function has(name: string): boolean {
  return Boolean(process.env[name]?.trim())
}

function validEncryptionKey(): boolean {
  const raw = process.env.FIELD_ENCRYPTION_KEY?.trim()
  if (!raw) return false
  const isHex = /^[0-9a-fA-F]+$/.test(raw) && !raw.endsWith("=")
  try {
    return Buffer.from(raw, isHex ? "hex" : "base64").length === 32
  } catch {
    return false
  }
}

/**
 * Which server settings are present. Reports presence only — never values.
 */
export function getConfigChecks(): ConfigCheck[] {
  return [
    { key: "SUPABASE_SERVICE_ROLE_KEY", label: "Supabase service key", level: "required", ok: has("SUPABASE_SERVICE_ROLE_KEY"), impact: "Checkout, payments, admin actions and notifications fail." },
    { key: "FIELD_ENCRYPTION_KEY", label: "Bank-details encryption key", level: "required", ok: validEncryptionKey(), impact: "Teachers/sellers can't add withdrawal accounts and parents can't save payment methods." },
    { key: "NEXT_PUBLIC_APP_URL", label: "Public site URL", level: "required", ok: has("NEXT_PUBLIC_APP_URL"), impact: "Email links, sitemap and card-payment return URLs point to the wrong place." },
    { key: "CRON_SECRET", label: "Daily jobs secret", level: "required", ok: has("CRON_SECRET"), impact: "Tuition renewals, auto-completing gig orders and expiring featured listings never run." },
    { key: "ANTHROPIC_API_KEY", label: "Claude API key", level: "required", ok: has("ANTHROPIC_API_KEY"), impact: "Paid AI Studio orders can't be generated; JARVIS falls back to basic chat." },
    { key: "NEXT_PUBLIC_LIVEKIT_URL", label: "LiveKit (video) server", level: "recommended", ok: has("NEXT_PUBLIC_LIVEKIT_URL") && has("LIVEKIT_API_KEY") && has("LIVEKIT_API_SECRET"), impact: "Demo lessons and meetings can't start." },
    { key: "RESEND_API_KEY", label: "Transactional email", level: "recommended", ok: has("RESEND_API_KEY") && has("EMAIL_FROM"), impact: "Payment and order emails aren't sent (in-app notifications still work)." },
    { key: "NEXT_PUBLIC_SUPPORT_EMAIL", label: "Support contact", level: "recommended", ok: has("NEXT_PUBLIC_SUPPORT_EMAIL") || has("NEXT_PUBLIC_SUPPORT_WHATSAPP"), impact: "Contact page only offers in-app support." },
    { key: "STRIPE_SECRET_KEY", label: "Card payments (Stripe)", level: "optional", ok: has("STRIPE_SECRET_KEY") && has("STRIPE_WEBHOOK_SECRET"), impact: "Only bank / JazzCash / Easypaisa payments are offered." },
    { key: "OPENROUTER_API_KEY", label: "OpenRouter (JARVIS fallback)", level: "optional", ok: has("OPENROUTER_API_KEY"), impact: "JARVIS has no fallback model when Claude is unavailable." },
  ]
}
