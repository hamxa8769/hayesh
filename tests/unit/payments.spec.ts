import { expect, test } from "@playwright/test"
import { splitCommission } from "@/lib/payments/settings"
import { generateReferenceCode } from "@/lib/payments/reference"
import { toMinorUnits } from "@/lib/payments/stripe"
import { rateLimit } from "@/lib/security/rate-limit"
import { safeRedirectPath } from "@/lib/utils/safe-redirect"
import { renderNotificationEmail } from "@/lib/email/templates"

test.describe("commission split", () => {
  test("takes the platform fee and pays out the rest", () => {
    expect(splitCommission(15000, 15)).toEqual({ fee: 2250, net: 12750 })
    expect(splitCommission(5000, 18)).toEqual({ fee: 900, net: 4100 })
  })

  test("rounds to two decimals without losing money", () => {
    const { fee, net } = splitCommission(9.99, 18)
    expect(fee).toBe(1.8)
    expect(Math.round((fee + net) * 100)).toBe(999)
  })

  test("handles 0% and 100%", () => {
    expect(splitCommission(1000, 0)).toEqual({ fee: 0, net: 1000 })
    expect(splitCommission(1000, 100)).toEqual({ fee: 1000, net: 0 })
  })
})

test("reference codes are unambiguous and unique", () => {
  const codes = new Set(Array.from({ length: 2000 }, () => generateReferenceCode()))
  expect(codes.size).toBe(2000)
  for (const code of codes) expect(code).toMatch(/^HYS-[A-HJ-NP-Z2-9]{8}$/)
})

test("Stripe minor units", () => {
  expect(toMinorUnits(15000)).toBe(1500000)
  expect(toMinorUnits(9.99)).toBe(999)
  expect(toMinorUnits(0.1 + 0.2)).toBe(30)
})

test("rate limiter blocks after the limit and reports retry", () => {
  const key = `unit-${Date.now()}`
  for (let i = 0; i < 3; i++) expect(rateLimit(key, 3, 60_000).ok).toBe(true)
  const blocked = rateLimit(key, 3, 60_000)
  expect(blocked.ok).toBe(false)
  expect(blocked.retryAfterSeconds).toBeGreaterThan(0)
})

test.describe("login redirect safety", () => {
  test("allows same-origin paths", () => {
    expect(safeRedirectPath("/checkout/abc?stripe=success")).toBe("/checkout/abc?stripe=success")
    expect(safeRedirectPath("/teachers/123")).toBe("/teachers/123")
  })

  test("rejects open-redirect tricks", () => {
    for (const bad of ["//evil.com", "/\\evil.com", "/\t/evil.com", "/\n/evil.com", "https://evil.com", "evil.com", "", "/", null, undefined]) {
      expect(safeRedirectPath(bad), String(bad)).toBeUndefined()
    }
  })
})

test("notification emails escape user-controlled text", () => {
  const email = renderNotificationEmail({
    title: "New message from <script>alert(1)</script>",
    message: `Hi "there" & <img src=x onerror=alert(1)>`,
    actionUrl: "/messages",
    recipientName: "<b>Ali</b>",
  })
  expect(email.html).not.toContain("<script>")
  expect(email.html).not.toContain("<img src=x")
  expect(email.html).toContain("&lt;script&gt;")
  expect(email.text).toContain("New message from")
})
