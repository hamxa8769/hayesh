import * as Sentry from "@sentry/nextjs"
import { redactEmails } from "./sentry-options"

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
      if (value !== null && value !== undefined) tags[key] = typeof value === "string" ? redactEmails(value) : String(value)
    }
    const extra: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(context)) extra[key] = typeof value === "string" ? redactEmails(value) : value
    Sentry.captureException(error, { tags, extra })
  } catch {
    // Reporting must never break the caller.
  }
}
