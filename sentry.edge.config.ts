import * as Sentry from "@sentry/nextjs"
import { buildSentryOptions } from "@/lib/observability/sentry-options"

// Inert without a DSN.
const options = buildSentryOptions()
if (options.dsn) {
  Sentry.init(options)
}
