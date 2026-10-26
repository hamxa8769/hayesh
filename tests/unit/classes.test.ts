import { expect, test } from "@playwright/test"
import { isWithinJoinWindow, joinWindow, JOIN_EARLY_MINUTES, JOIN_LATE_MINUTES } from "@/lib/classes/join-window"
import { scheduleErrorMessage } from "@/lib/classes/errors"

const START = "2026-11-02T10:00:00.000Z"
const at = (offsetMinutes: number) => new Date(new Date(START).getTime() + offsetMinutes * 60_000)

test.describe("joinWindow", () => {
  test("opens early and closes late relative to duration", () => {
    const w = joinWindow({ scheduled_at: START, duration_minutes: 45 })
    expect(w.opensAt.getTime()).toBe(at(-JOIN_EARLY_MINUTES).getTime())
    expect(w.closesAt.getTime()).toBe(at(45 + JOIN_LATE_MINUTES).getTime())
  })

  test("falls back to 60 minutes when duration is null", () => {
    const w = joinWindow({ scheduled_at: START, duration_minutes: null })
    expect(w.closesAt.getTime()).toBe(at(60 + JOIN_LATE_MINUTES).getTime())
  })

  test("isWithinJoinWindow is inclusive at both edges and false outside", () => {
    const m = { scheduled_at: START, duration_minutes: 30 }
    expect(isWithinJoinWindow(m, at(-11))).toBe(false)
    expect(isWithinJoinWindow(m, at(-10))).toBe(true)
    expect(isWithinJoinWindow(m, at(0))).toBe(true)
    expect(isWithinJoinWindow(m, at(45))).toBe(true)
    expect(isWithinJoinWindow(m, at(46))).toBe(false)
  })

  test("invalid date is never joinable", () => {
    expect(isWithinJoinWindow({ scheduled_at: "nope", duration_minutes: 30 })).toBe(false)
  })
})

test.describe("scheduleErrorMessage", () => {
  test("extracts the human part of schedule errors", () => {
    expect(scheduleErrorMessage({ code: "P0001", message: "schedule_conflict: this time overlaps another class" })).toBe(
      "This time overlaps another class"
    )
    expect(scheduleErrorMessage({ code: "P0001", message: "private_slot_full: a private class has exactly one student" })).toBe(
      "A private class has exactly one student"
    )
    expect(scheduleErrorMessage({ code: "P0001", message: "invalid_member: not enrolled" })).toBe("Not enrolled")
  })

  test("returns null for other errors", () => {
    expect(scheduleErrorMessage(null)).toBeNull()
    expect(scheduleErrorMessage({ code: "23505", message: "schedule_conflict: x" })).toBeNull()
    expect(scheduleErrorMessage({ code: "P0001", message: "something else" })).toBeNull()
    expect(scheduleErrorMessage({ code: "P0001" })).toBeNull()
  })
})
