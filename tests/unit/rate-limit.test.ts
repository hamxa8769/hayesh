import { expect, test } from "@playwright/test"
import { clientIp, rateLimit } from "@/lib/security/rate-limit"

test.describe("rate limiter (in-memory fallback)", () => {
  test("allows up to the limit then blocks with a retry hint", async () => {
    const key = `unit-${Date.now()}-a`
    for (let i = 0; i < 3; i++) expect((await rateLimit(key, 3, 60_000)).ok).toBe(true)
    const blocked = await rateLimit(key, 3, 60_000)
    expect(blocked.ok).toBe(false)
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0)
  })

  test("keeps separate keys independent", async () => {
    const a = `unit-${Date.now()}-b1`
    const b = `unit-${Date.now()}-b2`
    expect((await rateLimit(a, 1, 60_000)).ok).toBe(true)
    expect((await rateLimit(a, 1, 60_000)).ok).toBe(false)
    expect((await rateLimit(b, 1, 60_000)).ok).toBe(true)
  })

  test("resets after the window elapses", async () => {
    const key = `unit-${Date.now()}-c`
    expect((await rateLimit(key, 1, 50)).ok).toBe(true)
    expect((await rateLimit(key, 1, 50)).ok).toBe(false)
    await new Promise((r) => setTimeout(r, 80))
    expect((await rateLimit(key, 1, 50)).ok).toBe(true)
  })
})

test.describe("clientIp", () => {
  test("prefers the first x-forwarded-for hop, then x-real-ip, then unknown", () => {
    expect(clientIp(new Request("http://x", { headers: { "x-forwarded-for": "1.1.1.1, 2.2.2.2" } }))).toBe("1.1.1.1")
    expect(clientIp(new Request("http://x", { headers: { "x-real-ip": "3.3.3.3" } }))).toBe("3.3.3.3")
    expect(clientIp(new Request("http://x"))).toBe("unknown")
  })
})
