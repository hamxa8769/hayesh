import { expect, test } from "@playwright/test"
import { scrubBreadcrumb, scrubText, scrubTransaction, type TransactionEvent } from "@/lib/observability/sentry-options"
import { classifyExistingClaim, STALE_CLAIM_MS } from "@/lib/payments/webhook-events"


test("scrubText redacts emails and sensitive query values", () => {
  const out = scrubText("GET /cb?token=abc&page=2 for a@b.com")
  expect(out).toContain("page=2")
  expect(out).not.toContain("abc")
  expect(out).not.toContain("a@b.com")
})

test("scrubTransaction scrubs name and request url", () => {
  const ev = { type: "transaction", transaction: "/u/a@b.com", request: { url: "https://x.io/p?code=123&q=1", cookies: { a: "b" } } } as TransactionEvent
  const out = scrubTransaction(ev)
  expect(out.transaction).toBe("/u/[email]")
  expect(out.request?.url).not.toContain("123")
  expect(out.request?.cookies).toBeUndefined()
})

test("scrubBreadcrumb scrubs urls and drops console args with emails", () => {
  const nav = scrubBreadcrumb({ category: "fetch", data: { url: "https://x.io/a?key=zzz" } })
  expect(JSON.stringify(nav)).not.toContain("zzz")
  const con = scrubBreadcrumb({ category: "console", message: "hi a@b.com", data: { arguments: ["a@b.com"] } })
  expect(con?.message).not.toContain("a@b.com")
  expect(con?.data?.arguments).toBeUndefined()
})

test("classifyExistingClaim maps claim states", () => {
  const now = Date.now()
  const iso = (ago: number) => new Date(now - ago).toISOString()
  expect(classifyExistingClaim({ processed_at: iso(0), received_at: iso(60_000) }, now)).toBe("duplicate")
  expect(classifyExistingClaim({ processed_at: null, received_at: iso(60_000) }, now)).toBe("in_progress")
  expect(classifyExistingClaim({ processed_at: null, received_at: iso(STALE_CLAIM_MS + 1000) }, now)).toBe("stale")
})
