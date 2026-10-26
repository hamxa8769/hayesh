import * as Sentry from "@sentry/nextjs"
import { buildSentryOptions } from "@/lib/observability/sentry-options"

// Inert without NEXT_PUBLIC_SENTRY_DSN. No Session Replay (privacy + bundle size).
const options = buildSentryOptions()
if (options.dsn) {
  Sentry.init({ ...options, integrations: [] })
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
