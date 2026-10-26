import { expect, test } from "@playwright/test"
import { buildCsp, sentryReportUri } from "@/lib/security/csp"

test.describe("buildCsp", () => {
  test("includes derived supabase and livekit hosts", () => {
    const csp = buildCsp({
      NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
      NEXT_PUBLIC_LIVEKIT_URL: "wss://hayesh.livekit.cloud",
    })
    expect(csp).toContain("https://abc.supabase.co")
    expect(csp).toContain("wss://abc.supabase.co")
    expect(csp).toContain("wss://hayesh.livekit.cloud")
    expect(csp).toContain("https://hayesh.livekit.cloud")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("frame-ancestors 'self'")
    expect(csp).not.toContain("report-uri")
  })

  test("skips unset or invalid URLs without throwing", () => {
    const csp = buildCsp({ NEXT_PUBLIC_SUPABASE_URL: "not a url", NEXT_PUBLIC_LIVEKIT_URL: "" })
    expect(csp).toContain("connect-src 'self' https://*.ingest.sentry.io")
    expect(csp).not.toContain("undefined")
    expect(csp).not.toContain("null")
  })

  test("adds a Sentry report-uri derived from the DSN", () => {
    const dsn = "https://publickey@o123.ingest.us.sentry.io/456"
    expect(sentryReportUri(dsn)).toBe("https://o123.ingest.us.sentry.io/api/456/security/?sentry_key=publickey")
    expect(buildCsp({ NEXT_PUBLIC_SENTRY_DSN: dsn })).toContain("report-uri https://o123.ingest.us.sentry.io/api/456/security/")
  })

  test("ignores malformed DSNs", () => {
    expect(sentryReportUri("garbage")).toBeNull()
    expect(sentryReportUri(undefined)).toBeNull()
  })
})
