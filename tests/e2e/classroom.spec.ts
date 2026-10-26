import { expect, test } from "@playwright/test"
import { asRole, db, seed } from "./helpers"

/**
 * Classroom core: a teacher builds a weekly timetable, classes are generated
 * for the parent, and the Join button follows the join window.
 * Self-contained: it creates (and removes) its own ACTIVE subscription so it
 * never collides with other specs.
 */
test.describe.configure({ mode: "serial" })

const RUN = Date.now().toString(36)
const CHILD = `Class Kid ${RUN}`
const TITLE = `Algebra ${RUN}`
const OVERLAP_TITLE = `Overlap ${RUN}`
const ZONE = "Asia/Karachi" // default timezone of the Add class modal

let subscriptionId = ""

/** Weekday name and HH:MM of `hoursAhead` from now, in the slot timezone. */
function slotTarget(hoursAhead: number, offsetMinutes = 0): { weekday: string; time: string } {
  const d = new Date(Date.now() + hoursAhead * 3_600_000 + offsetMinutes * 60_000)
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: ZONE, weekday: "long", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d)
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? ""
  const hour = get("hour") === "24" ? "00" : get("hour")
  return { weekday: get("weekday"), time: `${hour}:${get("minute")}` }
}

async function cleanup(): Promise<void> {
  const s = seed()
  const { data: slots } = await db().from("timetable_slots").select("id").eq("teacher_id", s.teacherId)
  const slotIds = (slots ?? []).map((r: { id: string }) => r.id)
  if (slotIds.length > 0) {
    await db().from("meetings").delete().in("timetable_slot_id", slotIds)
    await db().from("timetable_slots").delete().in("id", slotIds)
  }
  if (subscriptionId) await db().from("subscriptions").delete().eq("id", subscriptionId)
}

test.beforeAll(async () => {
  const s = seed()
  await cleanup()
  const { data, error } = await db()
    .from("subscriptions")
    .insert({
      teacher_id: s.teacherId,
      parent_id: s.users.parent,
      child_name: CHILD,
      subject: "Mathematics",
      tier: "private",
      status: "active",
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    })
    .select("id")
    .single()
  if (error || !data) throw new Error(`subscription: ${error?.message}`)
  subscriptionId = (data as { id: string }).id
})

test.afterAll(async () => {
  await cleanup()
})

test("classroom: timetable class is generated, conflicts are rejected, Join follows the window", async ({ browser }) => {
  const s = seed()
  const target = slotTarget(26)

  // ── Teacher adds a private class ────────────────────────────────────────
  const teacher = await asRole(browser, "teacher", "/teacher/timetable")
  await teacher.goto("/teacher/timetable")
  await expect(teacher.getByRole("heading", { name: "Timetable" })).toBeVisible()
  await teacher.getByRole("button", { name: "Add class" }).click()

  const dialog = teacher.getByRole("dialog")
  await dialog.locator("#slot-title").fill(TITLE)
  await dialog.locator("#slot-subject").fill("Mathematics")
  await dialog.locator("#slot-day").selectOption({ label: target.weekday })
  await dialog.locator("#slot-start").fill(target.time)
  await dialog.locator("#slot-duration").selectOption("60")
  await dialog.getByText(CHILD).click()
  await dialog.getByRole("button", { name: "Add class" }).click()
  await expect(teacher.getByRole("dialog")).toBeHidden()

  await expect(teacher.getByTestId("timetable-grid").getByText(TITLE).first()).toBeVisible()
  await expect(teacher.getByRole("region", { name: "Next 14 days" }).getByText(TITLE).first()).toBeVisible()

  // ── Overlapping class is rejected inline ────────────────────────────────
  const overlap = slotTarget(26, 15)
  await teacher.getByRole("button", { name: "Add class" }).click()
  const second = teacher.getByRole("dialog")
  await second.locator("#slot-title").fill(OVERLAP_TITLE)
  await second.locator("#slot-day").selectOption({ label: overlap.weekday })
  await second.locator("#slot-start").fill(overlap.time)
  await second.getByText(CHILD).click()
  await second.getByRole("button", { name: "Add class" }).click()
  await expect(second.getByRole("alert")).toContainText(/overlap|conflict/i)
  await second.getByRole("button", { name: "Cancel" }).click()
  await expect(teacher.getByTestId("timetable-grid").getByText(OVERLAP_TITLE)).toHaveCount(0)

  // ── Parent sees the class, Join disabled ────────────────────────────────
  const parent = await asRole(browser, "parent", "/parent/dashboard")
  await parent.goto("/parent/dashboard")
  const upcoming = parent.getByRole("region", { name: "Upcoming classes" })
  await expect(upcoming.getByText(TITLE).first()).toBeVisible()
  const disabledJoin = upcoming.getByRole("button", { name: /Opens at/ }).first()
  await expect(disabledJoin).toBeVisible()
  await expect(disabledJoin).toBeDisabled()

  // ── A class starting in 5 minutes: Join is enabled ──────────────────────
  const { data: slot } = await db().from("timetable_slots").select("id").eq("teacher_id", s.teacherId).eq("title", TITLE).single()
  const slotId = (slot as { id: string }).id
  const soonTitle = `Starting soon ${RUN}`
  const { data: meeting, error } = await db()
    .from("meetings")
    .insert({
      organizer_id: s.users.teacher,
      participant_id: s.users.parent,
      context: "tutoring",
      title: soonTitle,
      scheduled_at: new Date(Date.now() + 5 * 60_000).toISOString(),
      duration_minutes: 30,
      status: "scheduled",
      timetable_slot_id: slotId,
    })
    .select("id")
    .single()
  expect(error?.message).toBeUndefined()
  const meetingId = (meeting as { id: string }).id
  await db().from("meeting_invitations").insert({
    meeting_id: meetingId,
    invitee_id: s.users.parent,
    invited_by: s.users.teacher,
    status: "accepted",
  })

  await parent.reload()
  const soon = parent.getByTestId("upcoming-class").filter({ hasText: soonTitle })
  await expect(soon).toBeVisible()
  const join = soon.getByRole("link", { name: /Join/ })
  await expect(join).toBeVisible()
  await expect(join).toHaveAttribute("href", `/meet/${meetingId}`)

  await teacher.context().close()
  await parent.context().close()
})
