import { createHash, createHmac } from "crypto"
import { expect, test } from "@playwright/test"
import { verifyLiveKitWebhook } from "@/lib/livekit/webhook"
import { decideClassOutcome, decideRoomFinished } from "@/lib/livekit/class-outcome"
import { isWithinJoinWindow } from "@/lib/classes/join-window"
import { meetingIdFromRoomName } from "@/lib/livekit/rooms"

const KEY = "APIkey123"
const SECRET = "supersecret-supersecret-supersecret"
const NOW = 1_800_000_000
const BODY = JSON.stringify({ event: "room_started", id: "EV_1", room: { name: "hayesh-x" } })

function sign(body: string, over: Record<string, unknown> = {}, secret = SECRET): string {
  const enc = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url")
  const head = enc({ alg: "HS256", typ: "JWT" })
  const payload = enc({
    iss: KEY,
    nbf: NOW - 10,
    exp: NOW + 300,
    sha256: createHash("sha256").update(body).digest("base64"),
    ...over,
  })
  const sig = createHmac("sha256", secret).update(`${head}.${payload}`).digest("base64url")
  return `${head}.${payload}.${sig}`
}

const opts = { apiKey: KEY, apiSecret: SECRET, now: NOW }

test.describe("verifyLiveKitWebhook", () => {
  test("accepts a valid token", () => {
    expect(verifyLiveKitWebhook(BODY, sign(BODY), opts)).toBe(true)
  })
  test("rejects a wrong secret", () => {
    expect(verifyLiveKitWebhook(BODY, sign(BODY, {}, "other-secret"), opts)).toBe(false)
  })
  test("rejects a tampered body", () => {
    expect(verifyLiveKitWebhook(BODY + " ", sign(BODY), opts)).toBe(false)
  })
  test("rejects an expired token beyond leeway but accepts within it", () => {
    expect(verifyLiveKitWebhook(BODY, sign(BODY, { exp: NOW - 120 }), opts)).toBe(false)
    expect(verifyLiveKitWebhook(BODY, sign(BODY, { exp: NOW - 30 }), opts)).toBe(true)
  })
  test("rejects wrong issuer and missing header", () => {
    expect(verifyLiveKitWebhook(BODY, sign(BODY, { iss: "nope" }), opts)).toBe(false)
    expect(verifyLiveKitWebhook(BODY, null, opts)).toBe(false)
  })
})

test.describe("decideClassOutcome", () => {
  test("host never joined", () => {
    expect(decideClassOutcome({ hostJoined: false, otherAttendees: 2, expectedStudents: 2 })).toBe("no_show_teacher")
  })
  test("host joined, students expected but none came", () => {
    expect(decideClassOutcome({ hostJoined: true, otherAttendees: 0, expectedStudents: 1 })).toBe("no_show_student")
  })
  test("completed otherwise", () => {
    expect(decideClassOutcome({ hostJoined: true, otherAttendees: 1, expectedStudents: 3 })).toBe("completed")
    expect(decideClassOutcome({ hostJoined: true, otherAttendees: 0, expectedStudents: 0 })).toBe("completed")
  })
})

test.describe("meetingIdFromRoomName", () => {
  test("extracts the uuid", () => {
    expect(meetingIdFromRoomName("hayesh-0b6f2a3c-1111-4222-8333-444455556666")).toBe("0b6f2a3c-1111-4222-8333-444455556666")
  })
  test("returns null for other names", () => {
    expect(meetingIdFromRoomName("custom-room")).toBeNull()
    expect(meetingIdFromRoomName("hayesh-not-a-uuid")).toBeNull()
  })
})

test.describe("decideRoomFinished", () => {
  const scheduledAt = "2026-10-26T10:00:00.000Z"
  const base = {
    scheduledAt,
    durationMinutes: 60,
    status: "scheduled",
    hostJoined: false,
    studentAttendees: 0,
    expectedStudents: 1,
  }
  const at = (iso: string) => new Date(iso)

  test("early room finish leaves status unchanged", () => {
    expect(decideRoomFinished({ ...base, now: at("2026-10-26T09:55:00Z") })).toEqual({ status: null, notify: false })
    expect(decideRoomFinished({ ...base, now: at("2026-10-26T10:30:00Z"), status: "live" })).toEqual({ status: null, notify: false })
  })
  test("live room finished before the scheduled start goes back to scheduled", () => {
    expect(decideRoomFinished({ ...base, now: at("2026-10-26T09:55:00Z"), status: "live" })).toEqual({ status: "scheduled", notify: false })
  })
  test("after end with host absent -> no_show_teacher", () => {
    expect(decideRoomFinished({ ...base, now: at("2026-10-26T11:00:00Z"), studentAttendees: 1 })).toEqual({ status: "no_show_teacher", notify: true })
  })
  test("host present, no students, expected > 0 -> no_show_student", () => {
    expect(decideRoomFinished({ ...base, now: at("2026-10-26T11:05:00Z"), hostJoined: true })).toEqual({ status: "no_show_student", notify: true })
  })
  test("observer does not count as a student (studentAttendees stays 0)", () => {
    expect(decideRoomFinished({ ...base, now: at("2026-10-26T11:05:00Z"), hostJoined: true, studentAttendees: 0 }).status).toBe("no_show_student")
  })
  test("host and student present -> completed, no notification", () => {
    expect(decideRoomFinished({ ...base, now: at("2026-10-26T11:05:00Z"), hostJoined: true, studentAttendees: 1, status: "live" })).toEqual({ status: "completed", notify: false })
  })
  test("already-final statuses are untouched", () => {
    expect(decideRoomFinished({ ...base, now: at("2026-10-26T12:00:00Z"), status: "cancelled" })).toEqual({ status: null, notify: false })
  })
})

test.describe("restart inside the join window", () => {
  test("no_show meetings are revivable only inside the window", () => {
    const m = { scheduled_at: "2026-10-26T10:00:00.000Z", duration_minutes: 60 }
    expect(isWithinJoinWindow(m, new Date("2026-10-26T10:20:00Z"))).toBe(true)
    expect(isWithinJoinWindow(m, new Date("2026-10-26T11:20:00Z"))).toBe(false)
  })
})
