import { expect, test } from "@playwright/test"
import { getAutomaticProviders, getProvider } from "@/lib/payments/providers"
import { isSimpaisaEnabled, simpaisaProvider } from "@/lib/payments/providers/simpaisa"
import { ProviderNotImplementedError } from "@/lib/payments/providers/types"
import { isStaleClaim, STALE_CLAIM_MS } from "@/lib/payments/webhook-events"

const KEYS = [
  "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "SIMPAISA_ENABLED", "SIMPAISA_MERCHANT_ID",
  "SIMPAISA_API_KEY", "SIMPAISA_WEBHOOK_SECRET", "SIMPAISA_BASE_URL",
] as const

test.describe("payment provider registry", () => {
  const saved: Record<string, string | undefined> = {}
  test.beforeEach(() => {
    for (const k of KEYS) { saved[k] = process.env[k]; delete process.env[k] }
  })
  test.afterEach(() => {
    for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k] }
  })

  function setSimpaisa() {
    process.env.SIMPAISA_MERCHANT_ID = "m"
    process.env.SIMPAISA_API_KEY = "k"
    process.env.SIMPAISA_WEBHOOK_SECRET = "s"
    process.env.SIMPAISA_BASE_URL = "https://sandbox.example"
  }

  test("returns no automatic providers when env is empty", () => {
    expect(getAutomaticProviders("PKR")).toEqual([])
    expect(getAutomaticProviders("USD")).toEqual([])
  })

  test("simpaisa needs the flag and every variable", () => {
    setSimpaisa()
    expect(isSimpaisaEnabled()).toBe(false)
    process.env.SIMPAISA_ENABLED = "true"
    expect(isSimpaisaEnabled()).toBe(true)
    delete process.env.SIMPAISA_API_KEY
    expect(isSimpaisaEnabled()).toBe(false)
    process.env.SIMPAISA_API_KEY = "k"
    process.env.SIMPAISA_ENABLED = "1"
    expect(isSimpaisaEnabled()).toBe(false)
  })

  test("simpaisa is PKR-only and stripe needs both keys", () => {
    setSimpaisa()
    process.env.SIMPAISA_ENABLED = "true"
    expect(getAutomaticProviders("PKR").map((p) => p.id)).toEqual(["simpaisa"])
    expect(getAutomaticProviders("USD")).toEqual([])
    process.env.STRIPE_SECRET_KEY = "sk_test_x"
    expect(getProvider("stripe")?.isEnabled()).toBe(false)
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_x"
    expect(getAutomaticProviders("USD").map((p) => p.id)).toEqual(["stripe"])
  })

  test("simpaisa scaffold throws ProviderNotImplementedError", async () => {
    await expect(simpaisaProvider.parseWebhook("{}", new Headers())).rejects.toBeInstanceOf(ProviderNotImplementedError)
  })
})

test("stale webhook claims are only unfinished and older than 10 minutes", () => {
  const now = Date.now()
  const iso = (ms: number) => new Date(now - ms).toISOString()
  expect(isStaleClaim({ processed_at: null, received_at: iso(STALE_CLAIM_MS + 1000) }, now)).toBe(true)
  expect(isStaleClaim({ processed_at: null, received_at: iso(60_000) }, now)).toBe(false)
  expect(isStaleClaim({ processed_at: iso(0), received_at: iso(STALE_CLAIM_MS * 2) }, now)).toBe(false)
})
