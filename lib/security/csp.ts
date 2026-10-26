/**
 * Content-Security-Policy builder. Shipped as Report-Only at launch.
 *
 * Path to enforcement: collect reports, then replace 'unsafe-inline' in
 * script-src with per-request nonces (middleware sets a nonce, Next.js applies
 * it to its inline scripts) and drop 'unsafe-eval' (only needed by dev tooling).
 */
export interface CspEnv {
  NEXT_PUBLIC_SUPABASE_URL?: string
  NEXT_PUBLIC_LIVEKIT_URL?: string
  NEXT_PUBLIC_SENTRY_DSN?: string
  SENTRY_DSN?: string
}

function parseUrl(raw: string | undefined): URL | null {
  if (!raw) return null
  try {
    return new URL(raw.trim())
  } catch {
    return null
  }
}

export function sentryReportUri(dsn: string | undefined): string | null {
  const url = parseUrl(dsn)
  if (!url || !url.username) return null
  const projectId = url.pathname.split("/").filter(Boolean).pop()
  if (!projectId) return null
  return `https://${url.host}/api/${projectId}/security/?sentry_key=${url.username}`
}

export function buildCsp(env: CspEnv): string {
  const supabase = parseUrl(env.NEXT_PUBLIC_SUPABASE_URL)
  const livekit = parseUrl(env.NEXT_PUBLIC_LIVEKIT_URL)

  const supabaseHttps = supabase ? `https://${supabase.host}` : null
  const supabaseWss = supabase ? `wss://${supabase.host}` : null
  const livekitHttps = livekit ? `https://${livekit.host}` : null
  const livekitWss = livekit ? `wss://${livekit.host}` : null

  const list = (...items: Array<string | null>): string[] => items.filter((i): i is string => Boolean(i))

  const directives: Array<[string, string[]]> = [
    ["default-src", ["'self'"]],
    ["script-src", ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://js.stripe.com"]],
    ["style-src", ["'self'", "'unsafe-inline'"]],
    ["img-src", list("'self'", "data:", "blob:", supabaseHttps, "https:")],
    ["font-src", ["'self'", "data:"]],
    [
      "connect-src",
      list(
        "'self'",
        supabaseHttps,
        supabaseWss,
        livekitWss,
        livekitHttps,
        "https://*.ingest.sentry.io",
        "https://*.ingest.us.sentry.io",
        "https://api.stripe.com"
      ),
    ],
    ["media-src", list("'self'", "blob:", supabaseHttps)],
    ["frame-src", ["https://js.stripe.com", "https://checkout.stripe.com"]],
    ["worker-src", ["'self'", "blob:"]],
    ["object-src", ["'none'"]],
    ["base-uri", ["'self'"]],
    ["form-action", ["'self'", "https://checkout.stripe.com"]],
    ["frame-ancestors", ["'self'"]],
  ]

  const reportUri = sentryReportUri(env.NEXT_PUBLIC_SENTRY_DSN || env.SENTRY_DSN)
  if (reportUri) directives.push(["report-uri", [reportUri]])

  return directives.map(([name, values]) => `${name} ${values.join(" ")}`).join("; ")
}
