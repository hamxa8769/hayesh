import * as Sentry from "@sentry/nextjs"

type ErrorContext = Record<string, string | number | boolean | null | undefined>

/**
 * Log one structured JSON line and forward to Sentry (no-op without a DSN).
 * Never throws.
 */
export function reportError(error: unknown, context: ErrorContext): void {
  try {
    const message = error instanceof Error ? error.message : String(error)
    try {
      console.error(
        JSON.stringify({ level: "error", source: "app", message, ...context, time: new Date().toISOString() })
      )
    } catch {
      console.error(`{"level":"error","source":"app","message":"unserializable error"}`)
    }
    const tags: Record<string, string> = {}
    for (const [key, value] of Object.entries(context)) {
      if (value !== null && value !== undefined) tags[key] = String(value)
    }
    Sentry.captureException(error, { tags, extra: { ...context } })
  } catch {
    // Reporting must never break the caller.
  }
}
