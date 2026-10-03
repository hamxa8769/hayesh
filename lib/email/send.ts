if (typeof window !== "undefined") {
  throw new Error("lib/email/send.ts must never be imported client-side")
}

const RESEND_ENDPOINT = "https://api.resend.com/emails"
const REQUEST_TIMEOUT_MS = 8000

export interface SendEmailParams {
  to: string
  subject: string
  html: string
  text: string
}

export interface SendEmailResult {
  ok: boolean
  error?: string
}

/** Transactional email is inert until both env vars are set. */
export function isEmailEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM)
}

function recipientDomain(address: string): string {
  const at = address.lastIndexOf("@")
  return at >= 0 ? address.slice(at + 1) : "unknown"
}

/** Sends one email through Resend. Never throws. */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  if (!apiKey || !from) {
    return { ok: false, error: "Email is not configured" }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [params.to],
        subject: params.subject,
        html: params.html,
        text: params.text,
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      console.error(
        `[email] Resend responded ${res.status} for recipient domain ${recipientDomain(params.to)}`
      )
      return { ok: false, error: `Email provider responded ${res.status}` }
    }

    return { ok: true }
  } catch (error: unknown) {
    const reason =
      error instanceof Error && error.name === "AbortError" ? "timeout" : "network error"
    console.error(`[email] Send failed (${reason}) for recipient domain ${recipientDomain(params.to)}`)
    return { ok: false, error: `Email send failed: ${reason}` }
  } finally {
    clearTimeout(timer)
  }
}
