import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { claimWebhookEvent, finishWebhookEvent, releaseWebhookEvent } from '@/lib/payments/webhook-events'
import {
  livekitWebhookEventSchema,
  unixToIso,
  verifyLiveKitWebhook,
  type LiveKitEgressInfo,
  type LiveKitWebhookEvent,
} from '@/lib/livekit/webhook'
import { meetingIdFromRoomName } from '@/lib/livekit/rooms'
import { decideClassOutcome } from '@/lib/livekit/class-outcome'
import { notifyUser } from '@/lib/notifications'

const PROVIDER = 'livekit'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EGRESS_COMPLETE_CODE = '3'

type Admin = ReturnType<typeof createAdminClient>

interface MeetingRow {
  id: string
  title: string | null
  status: string
  organizer_id: string
  participant_id: string | null
  scheduled_at: string
}

function fail(error: string, status: number): NextResponse {
  return NextResponse.json({ error }, { status })
}

async function resolveMeeting(admin: Admin, roomName: string): Promise<MeetingRow | null> {
  const columns = 'id, title, status, organizer_id, participant_id, scheduled_at'
  const idFromName = meetingIdFromRoomName(roomName)
  if (idFromName) {
    const { data } = await admin.from('meetings').select(columns).eq('id', idFromName).maybeSingle()
    if (data) return data as MeetingRow
  }
  const { data } = await admin.from('meetings').select(columns).eq('room_url', roomName).maybeSingle()
  return (data as MeetingRow | null) ?? null
}

function must<T>(result: { data?: T; error: { message: string } | null }, what: string): T | undefined {
  if (result.error) throw new Error(`${what}: ${result.error.message}`)
  return result.data
}

async function handleParticipantJoined(admin: Admin, meeting: MeetingRow, event: LiveKitWebhookEvent): Promise<void> {
  const identity = event.participant?.identity
  if (!identity || !UUID_RE.test(identity)) return
  const { data: profile } = await admin.from('profiles').select('id').eq('id', identity).maybeSingle()
  if (!profile) return
  const { error } = await admin.from('class_attendance').upsert(
    {
      meeting_id: meeting.id,
      profile_id: identity,
      joined_at: unixToIso(event.createdAt) ?? new Date().toISOString(),
      lk_event_id: event.id,
    },
    { onConflict: 'lk_event_id', ignoreDuplicates: true }
  )
  if (error) throw new Error(`attendance insert: ${error.message}`)
}

async function handleParticipantLeft(admin: Admin, meeting: MeetingRow, event: LiveKitWebhookEvent): Promise<void> {
  const identity = event.participant?.identity
  if (!identity || !UUID_RE.test(identity)) return
  const { data: open } = await admin
    .from('class_attendance')
    .select('id')
    .eq('meeting_id', meeting.id)
    .eq('profile_id', identity)
    .is('left_at', null)
    .order('joined_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!open) return
  must(
    await admin
      .from('class_attendance')
      .update({ left_at: unixToIso(event.createdAt) ?? new Date().toISOString() })
      .eq('id', (open as { id: number }).id),
    'attendance left'
  )
}

async function handleRoomFinished(admin: Admin, meeting: MeetingRow, event: LiveKitWebhookEvent): Promise<void> {
  const endedAt = unixToIso(event.createdAt) ?? new Date().toISOString()
  must(await admin.from('meetings').update({ ended_at: endedAt }).eq('id', meeting.id), 'meeting ended_at')
  must(
    await admin.from('class_attendance').update({ left_at: endedAt }).eq('meeting_id', meeting.id).is('left_at', null),
    'close attendance'
  )

  if (meeting.status !== 'scheduled' && meeting.status !== 'live') return

  const { data: attendance } = await admin.from('class_attendance').select('profile_id').eq('meeting_id', meeting.id)
  const attendees = new Set(((attendance ?? []) as { profile_id: string }[]).map((r) => r.profile_id))
  const otherAttendees = [...attendees].filter((id) => id !== meeting.organizer_id).length

  const { data: invites } = await admin.from('meeting_invitations').select('invitee_id').eq('meeting_id', meeting.id)
  const invitees = new Set(((invites ?? []) as { invitee_id: string }[]).map((r) => r.invitee_id))
  const expectedStudents = invitees.size + (meeting.participant_id && !invitees.has(meeting.participant_id) ? 1 : 0)

  const outcome = decideClassOutcome({
    hostJoined: attendees.has(meeting.organizer_id),
    otherAttendees,
    expectedStudents,
  })

  const { data: updated } = await admin
    .from('meetings')
    .update({ status: outcome })
    .eq('id', meeting.id)
    .in('status', ['scheduled', 'live'])
    .select('id')
    .maybeSingle()
  if (!updated || outcome === 'completed') return

  const title = meeting.title ?? 'Class'
  const students = new Set(invitees)
  if (meeting.participant_id) students.add(meeting.participant_id)
  const recipients = [meeting.organizer_id, ...students]
  const message =
    outcome === 'no_show_teacher'
      ? `${title} did not take place because the teacher did not join.`
      : `${title} ended without any students joining.`
  await Promise.all(
    recipients.map((userId) =>
      notifyUser({ userId, type: 'meeting_cancelled', title: 'Class missed', message, actionUrl: '/meetings' })
    )
  )
}

function storageKeyFor(file: { filename?: string; location?: string }): string | null {
  if (file.filename) return file.filename
  if (!file.location) return null
  try {
    const path = decodeURIComponent(new URL(file.location).pathname).replace(/^\/+/, '')
    const bucket = process.env.LIVEKIT_EGRESS_S3_BUCKET
    return bucket && path.startsWith(`${bucket}/`) ? path.slice(bucket.length + 1) : path
  } catch {
    return null
  }
}

function toNumber(value: string | number | undefined): number | null {
  if (value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

async function handleEgress(admin: Admin, meeting: MeetingRow, event: LiveKitWebhookEvent, info: LiveKitEgressInfo): Promise<void> {
  const startedAt = unixToIso(info.startedAt)
  const base: Record<string, unknown> = { meeting_id: meeting.id, egress_id: info.egressId }
  if (startedAt) base.started_at = startedAt

  if (event.event !== 'egress_ended') {
    const { error } = await admin
      .from('meeting_recordings')
      .upsert(base, { onConflict: 'egress_id', ignoreDuplicates: true })
    if (error) throw new Error(`recording upsert: ${error.message}`)
    return
  }

  const file = info.fileResults?.[0] ?? info.file
  const key = file ? storageKeyFor(file) : null
  const complete = String(info.status ?? '') === 'EGRESS_COMPLETE' || String(info.status ?? '') === EGRESS_COMPLETE_CODE
  const ready = Boolean(file && key && complete)
  const endedAt = unixToIso(info.endedAt) ?? unixToIso(event.createdAt) ?? new Date().toISOString()

  const rawDuration = toNumber(file?.duration)
  // Protobuf JSON durations are nanoseconds; tolerate plain seconds.
  const durationSeconds = rawDuration === null ? null : Math.round(rawDuration > 1e7 ? rawDuration / 1e9 : rawDuration)
  const sizeBytes = toNumber(file?.size)

  let expiresAt: string | null = null
  if (ready) {
    const rpc = await admin.rpc('recording_retention_days_for', { p_meeting: meeting.id })
    const days = typeof rpc.data === 'number' ? rpc.data : 30
    expiresAt = new Date(new Date(endedAt).getTime() + days * 86_400_000).toISOString()
  }

  const { error } = await admin.from('meeting_recordings').upsert(
    {
      ...base,
      status: ready ? 'ready' : 'failed',
      storage_key: ready ? key : null,
      duration_seconds: ready ? durationSeconds : null,
      size_bytes: ready ? sizeBytes : null,
      ended_at: endedAt,
      expires_at: expiresAt,
    },
    { onConflict: 'egress_id' }
  )
  if (error) throw new Error(`recording finish: ${error.message}`)
}

async function processEvent(event: LiveKitWebhookEvent): Promise<string> {
  const admin = createAdminClient()
  const roomName = event.room?.name ?? event.egressInfo?.roomName
  if (!roomName) return 'ignored_no_room'
  const meeting = await resolveMeeting(admin, roomName)
  if (!meeting) return 'ignored_unknown_room'

  switch (event.event) {
    case 'room_started':
      if (meeting.status === 'scheduled') {
        must(
          await admin
            .from('meetings')
            .update({ status: 'live', started_at: unixToIso(event.createdAt) ?? new Date().toISOString() })
            .eq('id', meeting.id)
            .eq('status', 'scheduled'),
          'room_started'
        )
      }
      break
    case 'participant_joined':
      await handleParticipantJoined(admin, meeting, event)
      break
    case 'participant_left':
      await handleParticipantLeft(admin, meeting, event)
      break
    case 'room_finished':
      await handleRoomFinished(admin, meeting, event)
      break
    case 'egress_started':
    case 'egress_updated':
    case 'egress_ended':
      if (event.egressInfo) await handleEgress(admin, meeting, event, event.egressInfo)
      break
    default:
      return 'ignored_event'
  }
  return event.event
}

/** POST /api/webhooks/livekit — signed LiveKit room/participant/egress events. */
export async function POST(request: Request): Promise<NextResponse> {
  const rawBody = await request.text()
  if (!verifyLiveKitWebhook(rawBody, request.headers.get('authorization'))) {
    return fail('Invalid signature', 401)
  }

  let parsed: ReturnType<typeof livekitWebhookEventSchema.safeParse>
  try {
    parsed = livekitWebhookEventSchema.safeParse(JSON.parse(rawBody))
  } catch {
    return fail('Invalid JSON', 400)
  }
  if (!parsed.success) return fail('Invalid event', 400)
  const event = parsed.data

  let claim: Awaited<ReturnType<typeof claimWebhookEvent>>
  try {
    claim = await claimWebhookEvent(PROVIDER, event.id)
  } catch (error: unknown) {
    console.error('livekit webhook claim failed', error instanceof Error ? error.message : error)
    return fail('Could not record event', 500)
  }
  if (claim === 'duplicate') return NextResponse.json({ ok: true, duplicate: true })
  if (claim === 'in_progress') return fail('Event is being processed', 503)

  try {
    const outcome = await processEvent(event)
    await finishWebhookEvent(PROVIDER, event.id, outcome)
    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    console.error('livekit webhook failed', event.event, error instanceof Error ? error.message : error)
    await releaseWebhookEvent(PROVIDER, event.id)
    return fail('Processing failed', 500)
  }
}
