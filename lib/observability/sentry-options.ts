import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs"

export type TransactionEvent = Parameters<NonNullable<NonNullable<Parameters<typeof import("@sentry/nextjs").init>[0]>["beforeSendTransaction"]>>[0]

/** Shared Sentry init options. Sentry stays inert unless a DSN is configured. */
const SENSITIVE_QUERY_KEY = /token|code|key/i
const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g

export function getSentryDsn(): string | undefined {
  return process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN || undefined
}

export function redactEmails(value: string): string {
  return value.replace(EMAIL_PATTERN, "[email]")
}

export function scrubUrl(url: string): string {
  const queryStart = url.indexOf("?")
  if (queryStart === -1) return url
  const base = url.slice(0, queryStart)
  const params = new URLSearchParams(url.slice(queryStart + 1))
  const keys = Array.from(params.keys())
  for (const key of keys) {
    if (SENSITIVE_QUERY_KEY.test(key)) params.set(key, "[redacted]")
  }
  const query = params.toString()
  return query ? `${base}?${query}` : base
}

export function scrubEvent(event: ErrorEvent): ErrorEvent {
  const next: ErrorEvent = { ...event }
  if (next.request) {
    const { headers, url, query_string: queryString, ...rest } = next.request
    const userAgent = headers?.["user-agent"] ?? headers?.["User-Agent"]
    const safeQuery =
      typeof queryString === "string"
        ? scrubUrl(`?${queryString}`).slice(1)
        : queryString && typeof queryString === "object" && !Array.isArray(queryString)
          ? Object.fromEntries(
              Object.entries(queryString).map(([k, v]) => [k, SENSITIVE_QUERY_KEY.test(k) ? "[redacted]" : v]),
            )
          : undefined
    next.request = {
      ...rest,
      ...(url ? { url: scrubUrl(url) } : {}),
      ...(safeQuery ? { query_string: safeQuery } : {}),
      ...(userAgent ? { headers: { "user-agent": userAgent } } : {}),
    }
    delete next.request.cookies
  }
  if (next.message) next.message = redactEmails(next.message)
  if (next.exception?.values) {
    next.exception = {
      ...next.exception,
      values: next.exception.values.map((v) => (v.value ? { ...v, value: redactEmails(v.value) } : v)),
    }
  }
  return next
}

/** Redacts emails and token/code/key query values inside free text (URLs may be embedded). */
export function scrubText(text: string): string {
  const withUrls = text.replace(/\S+\?\S+/g, (match) => scrubUrl(match))
  return redactEmails(withUrls)
}

export function scrubTransaction(event: TransactionEvent): TransactionEvent {
  const next: TransactionEvent = { ...event }
  if (next.transaction) next.transaction = scrubText(next.transaction)
  if (next.request) {
    const { headers, url, query_string: queryString, cookies, ...rest } = next.request
    void cookies
    const userAgent = headers?.["user-agent"] ?? headers?.["User-Agent"]
    next.request = {
      ...rest,
      ...(url ? { url: scrubUrl(url) } : {}),
      ...(typeof queryString === "string" ? { query_string: scrubUrl(`?${queryString}`).slice(1) } : {}),
      ...(userAgent ? { headers: { "user-agent": userAgent } } : {}),
    }
  }
  return next
}

export function scrubBreadcrumb(crumb: Breadcrumb): Breadcrumb | null {
  const next: Breadcrumb = { ...crumb }
  if (next.category === "console") {
    const args = (next.data as { arguments?: unknown } | undefined)?.arguments
    const hasEmail = Array.isArray(args) && args.some((a) => typeof a === "string" && new RegExp(EMAIL_PATTERN.source).test(a))
    if (hasEmail) {
      const { arguments: _dropped, ...data } = next.data as Record<string, unknown>
      void _dropped
      next.data = data
    }
  }
  if (next.message) next.message = scrubText(next.message)
  if (next.data) {
    const data: Record<string, unknown> = { ...next.data }
    for (const key of ["url", "from", "to"]) {
      if (typeof data[key] === "string") data[key] = scrubText(data[key] as string)
    }
    next.data = data
  }
  return next
}

export function buildSentryOptions() {
  const dsn = getSentryDsn()
  return {
    dsn,
    enabled: Boolean(dsn),
    environment: process.env.SENTRY_ENVIRONMENT || process.env.VERCEL_ENV || process.env.NODE_ENV,
    release: process.env.VERCEL_GIT_COMMIT_SHA || undefined,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
    sendDefaultPii: false,
    beforeSend: scrubEvent,
    beforeSendTransaction: scrubTransaction,
    beforeBreadcrumb: scrubBreadcrumb,
  }
}
