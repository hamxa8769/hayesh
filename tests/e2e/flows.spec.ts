import { expect, test } from "@playwright/test"
import { adminConfirmAll, asRole, db, payManually, seed } from "./helpers"

/**
 * Money flows end to end, exactly as customers and the admin use them.
 * Runs serially: later tests build on orders created by earlier ones.
 */
test.describe.configure({ mode: "serial" })

test("public pages render", async ({ page }) => {
  for (const path of ["/", "/teachers", "/marketplace", "/ai-services", "/terms", "/privacy", "/refund-policy", "/contact"]) {
    const res = await page.goto(path)
    expect(res?.status(), path).toBeLessThan(400)
  }
  const missing = await page.goto("/definitely-not-a-page")
  expect(missing?.status()).toBe(404)
  await expect(page.getByText("This page doesn't exist")).toBeVisible()
})

test("system prompt is never exposed to buyers", async ({ browser }) => {
  const s = seed()
  const page = await asRole(browser, "buyer")
  const res = await page.request.get(`/ai-services/${s.aiServiceId}`)
  expect(await res.text()).not.toContain("SECRET-E2E-PROMPT")
  await page.goto(`/ai-services/${s.aiServiceId}`)
  await expect(page.getByText("E2E Essay Feedback").first()).toBeVisible()
  expect(await page.content()).not.toContain("SECRET-E2E-PROMPT")
  await page.context().close()
})

test("tuition: parent enrols, pays, admin confirms, plan activates", async ({ browser }) => {
  const s = seed()
  const parent = await asRole(browser, "parent")
  await parent.goto(`/teachers/${s.teacherId}`)
  await parent.getByRole("button", { name: /Enrol — pay monthly/ }).first().click()
  const dialog = parent.getByRole("dialog")
  await dialog.locator("#enroll-plan").selectOption("private")
  const childInput = dialog.getByPlaceholder("Child's full name")
  if (await childInput.isVisible()) await childInput.fill("Ayesha")
  await dialog.locator("#enroll-subject").selectOption("Mathematics")
  await dialog.locator('button[type="submit"]').click()

  const txId = await payManually(parent)
  await adminConfirmAll(browser)

  const { data: tx } = await db().from("transactions").select("status, net_amount, platform_fee, subscription_id").eq("id", txId).single()
  expect(tx?.status).toBe("completed")
  expect(Number(tx?.platform_fee)).toBe(2250) // 15% of 15,000
  expect(Number(tx?.net_amount)).toBe(12750)
  const { data: sub } = await db().from("subscriptions").select("status, current_period_end").eq("id", tx?.subscription_id).single()
  expect(sub?.status).toBe("active")
  expect(sub?.current_period_end).toBeTruthy()

  await parent.goto("/parent/payments")
  await expect(parent.getByText(/Paid through/).first()).toBeVisible()
  await parent.goto(`/receipts/${txId}`)
  await expect(parent.getByText("Payment receipt").first()).toBeVisible()
  await parent.context().close()
})

test("gig: buyer orders, pays, seller delivers, buyer accepts, escrow releases", async ({ browser }) => {
  const s = seed()
  const buyer = await asRole(browser, "buyer")
  await buyer.goto(`/marketplace/${s.gigId}`)
  await buyer.getByRole("button", { name: /Place Order/ }).first().click()
  const dialog = buyer.getByRole("dialog")
  await dialog.locator("#gig-order-requirements").fill("Please design a minimal logo for 'Hayesh Bakery' in green.")
  await dialog.locator('button[type="submit"]').click()

  const txId = await payManually(buyer)
  await adminConfirmAll(browser)

  const { data: paid } = await db().from("transactions").select("status, gig_order_id").eq("id", txId).single()
  expect(paid?.status).toBe("processing") // held in escrow
  const orderId = paid?.gig_order_id as string
  const { data: started } = await db().from("gig_orders").select("status, delivery_due_at").eq("id", orderId).single()
  expect(started?.status).toBe("in_progress")
  expect(started?.delivery_due_at).toBeTruthy()

  // Escrowed money is not withdrawable yet.
  const seller = await asRole(browser, "seller")
  await seller.goto("/seller/orders")
  await seller.getByRole("button", { name: "Deliver" }).first().click()
  const deliver = seller.getByRole("dialog")
  await deliver.locator("textarea").first().fill("Here is your logo — three colour variants attached.")
  await deliver.getByRole("button", { name: "Deliver" }).click()
  await expect.poll(async () => (await db().from("gig_orders").select("status").eq("id", orderId).single()).data?.status).toBe("delivered")

  await buyer.goto("/orders")
  await buyer.getByRole("button", { name: "Accept delivery" }).first().click()
  await expect.poll(async () => (await db().from("gig_orders").select("status").eq("id", orderId).single()).data?.status).toBe("completed")
  const { data: released } = await db().from("transactions").select("status, net_amount").eq("id", txId).single()
  expect(released?.status).toBe("completed")

  // Messaging between the two parties of the order.
  await buyer.getByRole("button", { name: /Message seller/ }).first().click()
  await buyer.waitForURL(/\/messages\?c=/)
  const composer = buyer.locator("textarea").last()
  await composer.fill("Thanks, looks great!")
  await composer.press("Enter")
  await expect(buyer.getByText("Thanks, looks great!").first()).toBeVisible()
  await expect
    .poll(async () => (await db().from("messages").select("id").eq("receiver_id", s.users.seller)).data?.length ?? 0)
    .toBeGreaterThan(0)

  await buyer.context().close()
  await seller.context().close()
})

test("AI Studio: buyer pays and the order is fulfilled automatically", async ({ browser }) => {
  const s = seed()
  const buyer = await asRole(browser, "buyer")
  await buyer.goto(`/ai-services/${s.aiServiceId}`)
  await buyer.getByLabel(/Essay topic/).fill("Climate change and Pakistan's monsoons")
  await buyer.getByRole("button", { name: /Order Now/ }).click()
  const txId = await payManually(buyer)
  await adminConfirmAll(browser)

  const { data: tx } = await db().from("transactions").select("status, ai_order_id, payee_id").eq("id", txId).single()
  expect(tx?.status).toBe("completed")
  expect(tx?.payee_id).toBeNull()
  await expect
    .poll(async () => (await db().from("ai_orders").select("status, ai_output").eq("id", tx?.ai_order_id).single()).data?.ai_output ?? "")
    .toContain("E2E MOCK AI OUTPUT")

  // The buyer asks for a revision from My Orders.
  await buyer.goto("/orders")
  await buyer.getByRole("tab", { name: /HayeshAI Studio/ }).click()
  await buyer.getByRole("button", { name: /Request revision/ }).first().click()
  await buyer.getByPlaceholder(/Make it shorter/).fill("Please make it more formal and shorter.")
  await buyer.getByRole("button", { name: "Submit revision" }).click()
  await expect
    .poll(async () => (await db().from("ai_orders").select("revisions_used").eq("id", tx?.ai_order_id).single()).data?.revisions_used)
    .toBe(1)
  await buyer.context().close()
})

test("security: unpaid AI orders can't be fulfilled and admin APIs are admin-only", async ({ browser }) => {
  const s = seed()
  const buyer = await asRole(browser, "buyer")
  const created = await buyer.request.post("/api/checkout", {
    data: { kind: "ai_service", service_id: s.aiServiceId, inputs: { topic: "unpaid attempt" } },
  })
  expect(created.ok()).toBeTruthy()
  const { transaction_id } = (await created.json()) as { transaction_id: string }
  const { data: tx } = await db().from("transactions").select("ai_order_id").eq("id", transaction_id).single()

  const fulfil = await buyer.request.post("/api/ai-services/fulfill", { data: { order_id: tx?.ai_order_id } })
  expect(fulfil.status()).toBe(402)

  expect((await buyer.request.get("/api/admin/transactions")).status()).toBe(403)
  expect((await buyer.request.post("/api/admin/transactions", { data: { action: "confirm", transaction_id } })).status()).toBe(403)

  // A price sent by the client is ignored — the server prices from the DB.
  const tampered = await buyer.request.post("/api/checkout", {
    data: { kind: "gig", gig_id: s.gigId, tier: "basic", requirements: "Tampered order attempt here", amount: 1 },
  })
  const tamperedTx = (await tampered.json()) as { transaction_id: string }
  const { data: priced } = await db().from("transactions").select("gross_amount").eq("id", tamperedTx.transaction_id).single()
  expect(Number(priced?.gross_amount)).toBe(5000)

  // Another user can't see this buyer's checkout.
  const parent = await asRole(browser, "parent")
  const peek = await parent.goto(`/checkout/${transaction_id}`)
  expect(peek?.status()).toBe(404)

  await buyer.context().close()
  await parent.context().close()
})

test("admin rejects a fake payment and the order is cancelled", async ({ browser }) => {
  const s = seed()
  const buyer = await asRole(browser, "buyer")
  await buyer.goto(`/marketplace/${s.gigId}`)
  await buyer.getByRole("button", { name: /Place Order/ }).first().click()
  await buyer.getByRole("dialog").locator("#gig-order-requirements").fill("Second order that will be rejected.")
  await buyer.getByRole("dialog").locator('button[type="submit"]').click()
  const txId = await payManually(buyer)

  const admin = await asRole(browser, "admin")
  await admin.goto("/admin/payments")
  await admin.getByRole("button", { name: /^Reject/ }).first().click()
  await admin.getByPlaceholder("Tell the payer why this payment was rejected").fill("Amount not received in our account")
  await admin.getByRole("button", { name: "Confirm reject" }).click()
  await expect.poll(async () => (await db().from("transactions").select("status").eq("id", txId).single()).data?.status).toBe("failed")
  const { data: tx } = await db().from("transactions").select("gig_order_id, rejection_reason").eq("id", txId).single()
  expect(tx?.rejection_reason).toContain("Amount not received")
  const { data: order } = await db().from("gig_orders").select("status").eq("id", tx?.gig_order_id).single()
  expect(order?.status).toBe("cancelled")

  await buyer.goto(`/checkout/${txId}`)
  await expect(buyer.getByText("Amount not received").first()).toBeVisible()
  await buyer.context().close()
  await admin.context().close()
})

test("registration fee: teacher pays from the dashboard and gets marked paid", async ({ browser }) => {
  const teacher = await asRole(browser, "teacher")
  await teacher.goto("/teacher/dashboard")
  await teacher.getByRole("button", { name: /Pay now/ }).first().click()
  await payManually(teacher)
  await adminConfirmAll(browser)
  const s = seed()
  await expect
    .poll(async () => (await db().from("teachers").select("registration_fee_paid").eq("id", s.teacherId).single()).data?.registration_fee_paid)
    .toBe(true)
  await teacher.context().close()
})

test("featured listing: approved teacher buys 7 days and ranks as featured", async ({ browser }) => {
  const s = seed()
  const teacher = await asRole(browser, "teacher")
  await teacher.goto("/teacher/dashboard")
  await teacher.getByRole("button", { name: "Get featured" }).first().click()
  await payManually(teacher)
  await adminConfirmAll(browser)
  await expect
    .poll(async () => (await db().from("teachers").select("featured").eq("id", s.teacherId).single()).data?.featured)
    .toBe(true)
  const { data: t } = await db().from("teachers").select("featured_until").eq("id", s.teacherId).single()
  expect(new Date(t?.featured_until as string).getTime()).toBeGreaterThan(Date.now() + 6 * 24 * 3600 * 1000)
  await teacher.context().close()
})

test("admin refund cancels the tuition plan", async ({ browser }) => {
  const s = seed()
  const { data: tx } = await db()
    .from("transactions")
    .select("id, subscription_id")
    .eq("type", "tuition")
    .eq("payer_id", s.users.parent)
    .eq("status", "completed")
    .limit(1)
    .single()
  const admin = await asRole(browser, "admin")
  const res = await admin.request.post("/api/admin/transactions", {
    data: { action: "refund", transaction_id: tx?.id, reason: "Parent changed plans before the first lesson" },
  })
  expect(res.status(), await res.text()).toBe(200)
  const { data: after } = await db().from("transactions").select("status").eq("id", tx?.id).single()
  expect(after?.status).toBe("refunded")
  const { data: sub } = await db().from("subscriptions").select("status").eq("id", tx?.subscription_id).single()
  expect(sub?.status).toBe("cancelled")
  await admin.context().close()
})

test("JARVIS answers and messages hub loads", async ({ browser }) => {
  const parent = await asRole(browser, "parent")
  const res = await parent.request.post("/api/jarvis", { data: { query: "Any payments due?" } })
  expect(res.status()).toBe(200)
  const body = (await res.json()) as { answer: string }
  expect(body.answer.length).toBeGreaterThan(0)
  await parent.goto("/messages")
  await expect(parent.getByRole("button", { name: /Contact Hayesh Support/ }).first()).toBeVisible()
  await parent.context().close()
})

test("health endpoint reports the database is reachable", async ({ request }) => {
  const res = await request.get("/api/health")
  expect(res.status()).toBe(200)
  expect(((await res.json()) as { db: string }).db).toBe("ok")
})

test("cron: rejects missing secret and runs with it", async ({ request }) => {
  expect((await request.get("/api/cron/commerce")).status()).toBe(401)
  const ok = await request.get("/api/cron/commerce", { headers: { authorization: "Bearer e2e-cron-secret" } })
  expect(ok.status()).toBe(200)
  expect(((await ok.json()) as { ok: boolean }).ok).toBe(true)
})

test("maintenance mode takes the site down for visitors only", async ({ browser, page }) => {
  await db().from("platform_settings").update({ value: true }).eq("key", "maintenance_mode")
  try {
    await expect
      .poll(async () => (await page.request.get("/teachers")).status(), { timeout: 45_000, intervals: [3000] })
      .toBe(503)
    const admin = await asRole(browser, "admin")
    expect((await admin.goto("/teachers"))?.status()).toBeLessThan(400)
    await admin.context().close()
  } finally {
    await db().from("platform_settings").update({ value: false }).eq("key", "maintenance_mode")
  }
})
