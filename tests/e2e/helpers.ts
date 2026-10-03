import { readFileSync } from "node:fs"
import { expect, type Browser, type Page } from "@playwright/test"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { E2E_SERVICE_KEY, E2E_SUPABASE_URL, EMAIL, PASSWORD, SEED_FILE, type E2ERole } from "./env"
import type { SeedData } from "./global-setup"

export function seed(): SeedData {
  return JSON.parse(readFileSync(SEED_FILE, "utf8")) as SeedData
}

export function db(): SupabaseClient {
  return createClient(E2E_SUPABASE_URL, E2E_SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
}

/** 1x1 PNG used as a payment-proof screenshot. */
export const PROOF_PNG = {
  name: "proof.png",
  mimeType: "image/png",
  buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64"),
}

export async function login(page: Page, role: E2ERole, redirect?: string): Promise<void> {
  await page.goto(redirect ? `/auth/login?redirect=${encodeURIComponent(redirect)}` : "/auth/login")
  await page.getByPlaceholder("you@example.com").fill(EMAIL[role])
  await page.locator('input[type="password"]').fill(PASSWORD)
  await page.locator('form button[type="submit"]').click()
  await page.waitForURL((url) => !url.pathname.startsWith("/auth/login"), { timeout: 30_000 })
}

export async function asRole(browser: Browser, role: E2ERole, redirect?: string): Promise<Page> {
  const context = await browser.newContext()
  const page = await context.newPage()
  await login(page, role, redirect)
  return page
}

/** On /checkout/<id>: submit a JazzCash proof and return the transaction id. */
export async function payManually(page: Page): Promise<string> {
  await page.waitForURL(/\/checkout\/[0-9a-f-]{36}/)
  const txId = page.url().split("/checkout/")[1].split(/[?#]/)[0]
  await expect(page.getByText("Reference code").first()).toBeVisible()
  await page.locator("#proof-method").selectOption("jazzcash")
  await page.locator("#proof-ref").fill("TID12345678")
  await page.locator("#proof-file").setInputFiles(PROOF_PNG)
  await page.getByRole("button", { name: "Submit payment proof" }).click()
  await expect(page.getByText(/verifying/i).first()).toBeVisible()
  return txId
}

/** Admin confirms every payment currently in the verification queue. */
export async function adminConfirmAll(browser: Browser): Promise<void> {
  const page = await asRole(browser, "admin", "/admin/payments")
  await page.goto("/admin/payments")
  page.on("dialog", (d) => d.accept())
  const confirm = page.getByRole("button", { name: "Confirm payment" })
  await expect(confirm.first()).toBeVisible()
  while ((await confirm.count()) > 0) {
    await confirm.first().click()
    await page.waitForTimeout(1500)
  }
  await expect(page.getByText("No payments waiting for verification")).toBeVisible()
  await page.context().close()
}
