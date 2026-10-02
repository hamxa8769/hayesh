import { expect, test, type Browser, type Page } from "@playwright/test"
import { PASSWORD, type E2ERole } from "./env"
import { asRole, db, seed } from "./helpers"

/**
 * Non-money user workflows end to end: sign-up, navigation, demo booking,
 * student requests, withdrawals, gig approval, teacher onboarding, support
 * and meetings. Serial and self-contained: each test creates the data it
 * needs through the UI (the service client only fills gaps the UI can't).
 */
test.describe.configure({ mode: "serial" })

// The maintenance test in flows.spec.ts leaves the middleware's 30s cache stale: wait it out.
test.beforeAll(async ({ request }) => {
  await expect.poll(async () => (await request.get("/teachers")).status(), { timeout: 60_000, intervals: [2000] }).toBeLessThan(400)
})

const RUN = Date.now().toString(36)
const NEW_PARENT_EMAIL = `new-parent-${RUN}@e2e.hayesh.test`
const NEW_TEACHER_EMAIL = `new-teacher-${RUN}@e2e.hayesh.test`

async function register(page: Page, role: "parent" | "teacher", name: string, email: string): Promise<void> {
  await page.goto("/auth/register")
  await page.getByRole("button", { name: new RegExp(`^${role}`, "i") }).first().click()
  await page.getByRole("button", { name: /Continue/ }).click()
  await page.getByPlaceholder("John Doe").fill(name)
  await page.getByPlaceholder("you@example.com").fill(email)
  const pw = page.locator('input[type="password"]')
  await pw.nth(0).fill(PASSWORD)
  await pw.nth(1).fill(PASSWORD)
  await page.getByRole("button", { name: /Create Account/ }).click()
}

async function expectDashboardChrome(page: Page, label: string): Promise<void> {
  await expect(page.locator("aside").first(), `${label}: sidebar`).toBeVisible({ timeout: 20_000 })
}

function futureLocal(hoursAhead: number): string {
  const d = new Date(Date.now() + hoursAhead * 3_600_000)
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

test("sign-up: a new parent registers and lands on the parent dashboard", async ({ page }) => {
  await register(page, "parent", "Newly Signed Parent", NEW_PARENT_EMAIL)
  await page.waitForURL(/\/parent\/dashboard/, { timeout: 45_000 })
  await expectDashboardChrome(page, "parent dashboard")
  const { data: profile } = await db().from("profiles").select("role, full_name").eq("email", NEW_PARENT_EMAIL).single()
  expect(profile?.role).toBe("parent")
  expect(profile?.full_name).toBe("Newly Signed Parent")
})

test("navigation: shared pages keep the dashboard chrome, public pages keep the site header", async ({ browser }) => {
  const s = seed()
  const parent = await asRole(browser, "parent")
  const parentId = s.users.parent

  // A checkout page needs a transaction: use one the parent owns, else create one.
  let { data: tx } = await db().from("transactions").select("id").eq("payer_id", parentId).limit(1).maybeSingle()
  if (!tx) {
    const ins = await db()
      .from("transactions")
      .insert({ type: "tuition", status: "pending", payer_id: parentId, gross_amount: 1000, net_amount: 1000, currency: "PKR", reference_code: `HYS-NAV${RUN}`.toUpperCase().slice(0, 12) })
      .select("id")
      .single()
    tx = ins.data
  }

  for (const path of ["/orders", "/messages", "/meetings", `/checkout/${tx?.id}`]) {
    const res = await parent.goto(path)
    expect(res?.status(), path).toBeLessThan(400)
    await expectDashboardChrome(parent, path)
    await expect(parent.locator('aside a[href="/parent/dashboard"]').first(), `${path}: Dashboard link`).toBeVisible()
    await expect(parent.locator('aside a[href="/explore"]').first(), `${path}: Explore link`).toBeVisible()
  }

  // /explore is the public catalogue: site header with a Dashboard way back, not the sidebar.
  const publicPages = ["/explore", "/marketplace", "/teachers", "/ai-services", `/marketplace/${s.gigId}`, `/teachers/${s.teacherId}`, `/sellers/${s.sellerId}`]
  for (const path of publicPages) {
    const res = await parent.goto(path)
    expect(res?.status(), path).toBeLessThan(400)
    await expect(parent.getByRole("navigation").getByRole("link", { name: "Marketplace" }).first(), `${path}: header nav`).toBeVisible()
    if (path === "/explore") {
      await expect(parent.getByRole("navigation").getByRole("link", { name: "Dashboard" }).first()).toHaveAttribute("href", "/parent/dashboard")
    }
  }

  // Detail pages opened directly (no history): Back must go somewhere valid.
  for (const path of [`/marketplace/${s.gigId}`, `/teachers/${s.teacherId}`, `/sellers/${s.sellerId}`, `/ai-services/${s.aiServiceId}`]) {
    const fresh = await (await browser.newContext()).newPage()
    await fresh.goto(path)
    const back = fresh.getByRole("button", { name: "Back" }).first()
    await expect(back, `${path}: Back button`).toBeVisible()
    await back.click()
    await fresh.waitForURL((u) => u.pathname !== path, { timeout: 15_000 })
    const res = await fresh.request.get(fresh.url())
    expect(res.status(), `Back from ${path} -> ${fresh.url()}`).toBeLessThan(400)
    await fresh.context().close()
  }
  await parent.context().close()
})

test("navigation: every sidebar link for every role stays inside the dashboard", async ({ browser }) => {
  test.setTimeout(300_000)
  const roles: E2ERole[] = ["admin", "teacher", "parent", "seller", "buyer"]
  const problems: string[] = []
  for (const role of roles) {
    const page = await asRole(browser, role)
    await expectDashboardChrome(page, `${role} landing`)
    const hrefs = await page.locator("aside").first().locator("a[href]").evaluateAll((els) =>
      Array.from(new Set(els.map((e) => (e as HTMLAnchorElement).getAttribute("href") ?? ""))).filter((h) => h.startsWith("/") && h !== "/" && h !== "/explore")
    )
    expect(hrefs.length, `${role} sidebar links`).toBeGreaterThan(3)
    for (const href of hrefs) {
      const res = await page.goto(href)
      const status = res?.status() ?? 0
      if (status >= 400) problems.push(`${role} ${href}: HTTP ${status}`)
      const hasSidebar = await page
        .locator("aside")
        .first()
        .waitFor({ state: "visible", timeout: 15_000 })
        .then(() => true)
        .catch(() => false)
      if (!hasSidebar) problems.push(`${role} ${href}: sidebar missing (dropped out of dashboard)`)
      else if (page.url().includes("/auth/login")) problems.push(`${role} ${href}: bounced to login`)
    }
    // Real clicks too, to exercise client-side navigation from a dashboard page.
    await page.goto(hrefs[0])
    for (const href of hrefs.slice(0, 4)) {
      await page.locator(`aside a[href="${href}"]`).first().click()
      await page.waitForURL((u) => u.pathname.startsWith(href), { timeout: 15_000 })
      await expectDashboardChrome(page, `${role} click ${href}`)
    }
    await page.context().close()
  }
  expect(problems, problems.join("\n")).toEqual([])
})

test("demo booking: parent books, teacher confirms, parent sees the new status", async ({ browser }) => {
  const s = seed()
  const child = `Demo Kid ${RUN}`
  const parent = await asRole(browser, "parent")
  await parent.goto(`/teachers/${s.teacherId}`)
  await parent.getByRole("button", { name: "Book a Free Demo" }).first().click()
  const dialog = parent.getByRole("dialog")
  await dialog.locator("#demo-child-name").fill(child)
  await dialog.locator("#demo-subject").selectOption("Mathematics")
  await dialog.locator("#demo-scheduled-at").fill(futureLocal(48))
  await dialog.getByRole("button", { name: "Request Demo" }).click()
  await expect(parent.getByText(/Demo requested/)).toBeVisible()

  const { data: booking } = await db().from("demo_bookings").select("id, status").eq("child_name", child).single()
  expect(booking?.status).toBe("pending")

  const teacher = await asRole(browser, "teacher", "/teacher/sessions")
  await teacher.goto("/teacher/sessions")
  await expect(teacher.getByText(child).first()).toBeVisible()
  await teacher.getByRole("button", { name: "Confirm", exact: true }).first().click()
  await expect.poll(async () => (await db().from("demo_bookings").select("status").eq("id", booking?.id).single()).data?.status).toBe("confirmed")
  await teacher.context().close()

  await parent.goto("/parent/requests")
  const panel = parent.getByRole("region", { name: "Demo lessons" })
  await expect(panel.getByText(child)).toBeVisible()
  await expect(panel.getByText("Confirmed")).toBeVisible()
  await parent.context().close()
})

test("student workflow: parent adds a child and requests a teacher, admin assigns, parent sees it", async ({ browser }) => {
  const childName = `Zayn ${RUN}`
  const subject = `Algebra ${RUN}`
  await db().from("student_requests").delete().neq("id", "00000000-0000-0000-0000-000000000000")

  const parent = await asRole(browser, "parent", "/parent/students")
  await parent.goto("/parent/students")
  await parent.getByRole("button", { name: /Add Child|Add Your First Child/ }).first().click()
  const addDialog = parent.getByRole("dialog")
  await addDialog.locator("#student-full-name").fill(childName)
  await addDialog.locator("#student-grade").fill("Grade 7")
  await addDialog.locator('button[type="submit"]').click()
  await expect(parent.getByText(childName).first()).toBeVisible()

  await parent.goto("/parent/requests")
  await parent.getByRole("button", { name: "Request a Teacher" }).first().click()
  const reqDialog = parent.getByRole("dialog")
  await reqDialog.locator("#request-student").selectOption({ label: childName })
  await reqDialog.locator("#request-subject").fill(subject)
  await reqDialog.locator('button[type="submit"]').click()
  await expect(parent.getByText(subject).first()).toBeVisible()

  const admin = await asRole(browser, "admin", "/admin/requests")
  await admin.goto("/admin/requests")
  await expect(admin.getByText(subject).and(admin.locator(":visible")).first()).toBeVisible()
  await admin.getByRole("button", { name: "Assign", exact: true }).first().click()
  const assign = admin.getByRole("dialog")
  await assign.getByRole("button", { name: /E2E Teacher/ }).click()
  await assign.getByRole("button", { name: "Assign Teacher" }).click()
  await expect(admin.getByRole("dialog")).toBeHidden()
  await admin.context().close()

  await parent.goto("/parent/requests")
  await expect(parent.getByText("Assigned to").first()).toBeVisible()
  await expect(parent.getByText("E2E Teacher").first()).toBeVisible()
  await parent.context().close()
})

test("withdrawals: seller saves an encrypted account, withdraws, admin approves; over-balance is rejected", async ({ browser }) => {
  const s = seed()
  // Make sure the seller has settled earnings (the gig flow may or may not have produced them).
  await db().from("transactions").insert({
    type: "gig", status: "completed", payee_id: s.users.seller, gross_amount: 5000, platform_fee: 0, net_amount: 5000, currency: "PKR",
    description: `e2e earnings ${RUN}`,
  })
  const sellerPage = await asRole(browser, "seller", "/seller/profile")
  await sellerPage.goto("/seller/profile")
  await sellerPage.getByRole("button", { name: "Add Account" }).first().click()
  const acct = sellerPage.getByRole("dialog")
  await acct.locator("#payout-method").selectOption("easypaisa")
  await acct.locator("#payout-account-title").fill("Hamza Iqbal")
  await acct.locator("#payout-account-number").fill("03415150824")
  await acct.getByRole("button", { name: "Add Account" }).click()
  await expect(sellerPage.getByText(/5150824|0824/).first()).toBeVisible()

  const { data: methods } = await db().from("payment_methods").select("*").eq("user_id", s.users.seller)
  expect(methods?.length).toBeGreaterThan(0)
  for (const m of methods ?? []) {
    expect(JSON.stringify(m)).not.toContain("03415150824")
    if (m.account_reference) expect(String(m.account_reference).startsWith("v1:")).toBe(true)
  }

  await sellerPage.goto("/seller/earnings")
  await expect(sellerPage.getByRole("button", { name: "Request Withdrawal" })).toBeEnabled()
  await sellerPage.getByRole("button", { name: "Request Withdrawal" }).click()
  const wd = sellerPage.getByRole("dialog")

  // More than the available balance is rejected with a clear message.
  await wd.locator("#wd-amount").fill("99999999")
  await wd.locator("#wd-method").selectOption("easypaisa")
  await wd.locator("#wd-account").fill("03415150824")
  await wd.getByRole("button", { name: "Submit Request" }).click()
  await expect(wd.getByText(/Cannot exceed your available balance/)).toBeVisible()

  await wd.locator("#wd-amount").fill("1000")
  await wd.getByRole("button", { name: "Submit Request" }).click()
  await expect(sellerPage.getByRole("dialog")).toBeHidden()
  await expect(sellerPage.getByText("Withdrawal History")).toBeVisible()

  const { data: payout } = await db().from("payouts").select("*").eq("recipient_id", s.users.seller).eq("amount", 1000).order("created_at", { ascending: false }).limit(1).single()
  expect(payout?.status).toBe("pending")
  expect(payout?.recipient_type).toBe("seller")
  expect(String(payout?.account_number).startsWith("v1:")).toBe(true)
  expect(String(payout?.account_number)).not.toContain("03415150824")

  const admin = await asRole(browser, "admin", "/admin/payments")
  await admin.goto("/admin/payments")
  await expect(admin.getByText("Withdrawal Requests")).toBeVisible()
  await admin.getByRole("button", { name: /Approve & Release/ }).first().click()
  await expect.poll(async () => (await db().from("payouts").select("status").eq("id", payout?.id).single()).data?.status).toBe("completed")
  await admin.context().close()

  await sellerPage.goto("/seller/earnings")
  await expect(sellerPage.getByText("Completed").first()).toBeVisible()
  await sellerPage.context().close()
})

test("gig: seller creates a gig through the wizard, admin approves it, it shows on the marketplace", async ({ browser }) => {
  const title = `E2E Wizard Gig ${RUN} brand identity`
  const seller = await asRole(browser, "seller", "/seller/gigs/new")
  await seller.goto("/seller/gigs/new")
  await seller.locator("#gig-title").fill(title)
  await seller.locator("#gig-category").selectOption("Design")
  await seller.locator("#gig-description").fill("I will design a complete brand identity including logo, colours and typography for your new business, delivered as editable files.")
  await seller.getByRole("button", { name: /^Next/ }).click()

  const tiers: Array<[string, string, number, number]> = [["Basic", "Starter", 5000, 20], ["Standard", "Business", 9000, 40], ["Premium", "Brand kit", 15000, 70]]
  for (const [i, [, name, pkr, usd]] of tiers.entries()) {
    const card = seller.locator("div.rounded-lg.border.bg-surface.p-5").nth(i)
    await card.getByPlaceholder(/ package$/).fill(name)
    await card.getByPlaceholder("What's included in this package...").fill(`${name} package with everything you need.`)
    await card.getByPlaceholder("5000").fill(String(pkr))
    await card.getByPlaceholder("25").fill(String(usd))
    const feature = card.getByPlaceholder("Add a feature and press Enter")
    await feature.fill("Source files")
    await feature.press("Enter")
  }
  await seller.getByRole("button", { name: /^Next/ }).click()
  await seller.getByRole("button", { name: /^Next/ }).click() // gallery & FAQ are optional
  await seller.getByRole("button", { name: /Publish Gig/ }).click({ noWaitAfter: true })
  await seller.waitForURL(/\/seller\/gigs$/, { waitUntil: "commit", timeout: 30_000 })
  await expect(seller.getByText(title)).toBeVisible()
  await expect(seller.getByText("pending").first()).toBeVisible()

  // Pending gigs are not public.
  const pub = await (await browser.newContext()).newPage()
  await pub.goto("/marketplace")
  await expect(pub.getByText("E2E Logo Design").first()).toBeVisible()
  await expect(pub.getByText(title)).toHaveCount(0)

  const admin = await asRole(browser, "admin", "/admin/sellers")
  await admin.goto("/admin/sellers")
  const row = admin.getByTestId("admin-gig-row").filter({ hasText: title })
  await expect(row).toBeVisible()
  await row.getByRole("button", { name: "Approve gig" }).click()
  await expect(row.getByText("approved")).toBeVisible()
  await admin.context().close()

  await pub.goto("/marketplace")
  await expect(pub.getByText(title)).toBeVisible()
  await pub.context().close()
  await seller.goto("/seller/gigs")
  await expect(seller.getByText("approved").first()).toBeVisible()
  await seller.context().close()
})

test("teacher onboarding: new teacher signs up, completes the wizard, admin approves, listed on /teachers", async ({ browser }) => {
  const name = `Onboarded Teacher ${RUN}`
  const context = await browser.newContext()
  const page = await context.newPage()
  await register(page, "teacher", name, NEW_TEACHER_EMAIL)
  await page.waitForURL(/\/teacher\/onboarding/, { timeout: 45_000 })

  const next = page.getByRole("button", { name: /^Next/ })
  await page.locator("#onboarding-phone").fill("+92 300 1234567")
  await expect(page.locator("#onboarding-display-name")).toHaveValue(name)
  await page.locator("#onboarding-tagline").fill("Physics made simple")
  await next.click()
  await page.getByPlaceholder("BSc, MSc, PhD").fill("MSc")
  await page.getByPlaceholder("University name").fill("LUMS")
  await next.click() // experience (optional)
  await next.click()
  await page.getByPlaceholder("Mathematics").fill("Physics")
  await next.click()
  await next.click() // documents (optional)
  await page.locator("#onboarding-private-price").fill("12000")
  await next.click()
  await next.click() // availability (optional)
  await page.getByRole("button", { name: /Finish Setup/ }).click()
  await page.waitForURL(/\/teacher\/dashboard/, { timeout: 30_000 })
  await context.close()

  const { data: t } = await db().from("teachers").select("id, status").eq("display_name", name).single()
  expect(t?.status).toBe("pending")

  const pub = await (await browser.newContext()).newPage()
  await pub.goto("/teachers")
  await expect(pub.getByText("E2E Teacher").first()).toBeVisible()
  await expect(pub.getByText(name)).toHaveCount(0)

  const admin = await asRole(browser, "admin", "/admin/teachers")
  await admin.goto("/admin/teachers")
  const card = admin.locator("div").filter({ hasText: name }).filter({ has: admin.getByRole("button", { name: "Approve", exact: true }) }).last()
  await card.getByRole("button", { name: "Approve", exact: true }).click()
  await expect.poll(async () => (await db().from("teachers").select("status").eq("id", t?.id).single()).data?.status).toBe("approved")
  await admin.context().close()

  await pub.goto("/teachers")
  await expect(pub.getByText(name).first()).toBeVisible()
  await pub.context().close()
})

test("support: teacher opens a ticket, admin replies, teacher sees the reply", async ({ browser }) => {
  const subject = `Cannot upload document ${RUN}`
  const reply = `We fixed the upload issue ${RUN}`
  const teacher = await asRole(browser, "teacher", "/teacher/support")
  await teacher.goto("/teacher/support")
  await teacher.getByRole("button", { name: "Raise a Ticket" }).click()
  await teacher.locator("#ticket-subject").fill(subject)
  await teacher.locator("#ticket-message").fill("The document upload spinner never finishes on my side.")
  await teacher.getByRole("button", { name: "Submit Ticket" }).click()
  await expect(teacher.getByText(subject).first()).toBeVisible()

  const { data: ticket } = await db().from("support_tickets").select("id").eq("subject", subject).single()
  const admin = await asRole(browser, "admin", `/admin/support/${ticket?.id}`)
  await admin.goto(`/admin/support/${ticket?.id}`)
  await expectDashboardChrome(admin, "admin ticket")
  await admin.getByPlaceholder(/Write a reply/).fill(reply)
  await admin.getByRole("button", { name: "Send Reply" }).click()
  // The reply must be persisted (not just echoed from the textarea) before we move on.
  await expect.poll(async () => (await db().from("support_ticket_messages").select("id").eq("ticket_id", ticket?.id).eq("body", reply)).data?.length).toBe(1)
  await expect(admin.locator("p", { hasText: reply })).toBeVisible()
  await admin.context().close()

  await teacher.goto("/teacher/support")
  await teacher.getByRole("button", { name: new RegExp(subject) }).click()
  await expect(teacher.getByText(reply)).toBeVisible()
  await teacher.context().close()
})

async function openAs(browser: Browser, role: E2ERole, path: string): Promise<Page> {
  const page = await asRole(browser, role, path)
  await page.goto(path)
  return page
}

test("meetings: teacher hosts a meeting inviting the parent, parent accepts, pre-join page is graceful", async ({ browser }) => {
  const title = `Progress check-in ${RUN}`
  // Teachers may only invite parents they serve. Earlier tests normally establish that
  // (tuition subscription / assigned request); make sure it holds even when run alone.
  const s = seed()
  const { data: served } = await db().from("student_requests").select("id").eq("parent_id", s.users.parent).eq("assigned_teacher_id", s.teacherId).limit(1)
  const { data: subs } = await db().from("subscriptions").select("id").eq("parent_id", s.users.parent).eq("teacher_id", s.teacherId).limit(1)
  if (!served?.length && !subs?.length) {
    const { data: student } = await db().from("students").insert({ parent_id: s.users.parent, full_name: `Meeting Kid ${RUN}` }).select("id").single()
    await db().from("student_requests").insert({ student_id: student?.id, parent_id: s.users.parent, subject: "Maths", status: "assigned", assigned_teacher_id: s.teacherId })
  }
  const teacher = await openAs(browser, "teacher", "/meetings")
  await teacher.getByRole("button", { name: "Host a Meeting" }).click()
  const dialog = teacher.getByRole("dialog")
  await dialog.getByRole("button", { name: "Schedule for later" }).click()
  await dialog.locator("#meeting-title").fill(title)
  await dialog.locator("#meeting-scheduled-at").fill(futureLocal(24))
  const invitee = dialog.locator("#meeting-invitees")
  await invitee.fill("E2E Parent")
  await dialog.getByRole("option", { name: /E2E Parent/ }).first().click()
  await dialog.getByRole("button", { name: "Schedule Meeting" }).click()
  await expect(teacher.getByRole("dialog")).toBeHidden()
  await expect(teacher.getByText(title).first()).toBeVisible()

  const { data: meeting } = await db().from("meetings").select("id").eq("title", title).single()
  expect(meeting?.id).toBeTruthy()

  const parent = await openAs(browser, "parent", "/meetings")
  await expect(parent.getByText(title).first()).toBeVisible()
  await parent.getByRole("button", { name: "Accept" }).first().click()
  await expect(parent.getByText(/accepted/i).first()).toBeVisible()

  // LiveKit isn't running: the pre-join page must render, not crash.
  const res = await parent.goto(`/meet/${meeting?.id}`)
  expect(res?.status()).toBeLessThan(500)
  await expect(parent.getByText(title).first()).toBeVisible()
  expect(await parent.getByText(/Application error|Internal Server Error/).count()).toBe(0)

  await teacher.context().close()
  await parent.context().close()
})
