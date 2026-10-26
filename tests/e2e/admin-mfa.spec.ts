import { createHmac } from "node:crypto"
import { expect, test } from "@playwright/test"
import { db, login, seed } from "./helpers"

const STEP_SECONDS = 30
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"

/** RFC 4648 base32 decode (no padding required). */
function base32Decode(input: string): Buffer {
  const clean = input.replace(/[\s=]/g, "").toUpperCase()
  let bits = 0
  let value = 0
  const bytes: number[] = []
  for (const ch of clean) {
    const idx = BASE32.indexOf(ch)
    if (idx < 0) throw new Error(`Invalid base32 character: ${ch}`)
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(bytes)
}

/** RFC 6238 TOTP: HMAC-SHA1, 30 s step, 6 digits. */
function totp(secret: string, atMs: number = Date.now()): string {
  const counter = Math.floor(atMs / 1000 / STEP_SECONDS)
  const msg = Buffer.alloc(8)
  msg.writeBigUInt64BE(BigInt(counter))
  const hmac = createHmac("sha1", base32Decode(secret)).update(msg).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const bin = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3]
  return String(bin % 1_000_000).padStart(6, "0")
}

/** A code for the current step that differs from `previous` (waits for the next step if needed). */
async function freshCode(secret: string, previous: string): Promise<string> {
  for (let i = 0; i < 70; i++) {
    const code = totp(secret)
    if (code !== previous) return code
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error("Timed out waiting for a new TOTP step")
}

test("admin enrols TOTP, then must pass the challenge on next sign-in", async ({ page, context }) => {
  const adminId = seed().users.admin
  const admin = db()

  try {
    // Enrol
    await login(page, "admin", "/admin/security")
    await page.goto("/admin/security")
    await page.getByRole("button", { name: "Set up authenticator app" }).click()
    const secret = (await page.getByTestId("mfa-secret").innerText()).trim()
    expect(secret.length).toBeGreaterThanOrEqual(16)
    const enrolCode = totp(secret)
    await page.locator("#mfa-enroll-code").fill(enrolCode)
    await page.getByRole("button", { name: "Activate" }).click()
    await expect(page.getByText("Two-factor authentication is now active")).toBeVisible()

    // Sign out (drop the session cookies) and sign in again
    await context.clearCookies()
    await login(page, "admin")
    await page.waitForURL(/\/auth\/mfa/)
    expect(new URL(page.url()).searchParams.get("redirect")).toBe("/admin")

    // Wrong code
    await page.locator("#mfa-code").fill("000000")
    await page.getByRole("button", { name: "Verify" }).click()
    await expect(page.getByRole("alert").filter({ hasText: /not correct/i })).toBeVisible()

    // Correct code
    await page.locator("#mfa-code").fill(await freshCode(secret, enrolCode))
    await page.getByRole("button", { name: "Verify" }).click()
    await page.waitForURL((url) => url.pathname === "/admin")
  } finally {
    // Leave the shared admin without factors so other specs can sign in normally.
    const { data } = await admin.auth.admin.mfa.listFactors({ userId: adminId })
    for (const factor of data?.factors ?? []) {
      await admin.auth.admin.mfa.deleteFactor({ id: factor.id, userId: adminId })
    }
  }
})
