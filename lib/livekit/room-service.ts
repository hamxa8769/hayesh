import { createHmac } from 'crypto'

// SERVER ONLY. Mirrors the hand-minted JWT approach in lib/livekit/tokens.ts:
// livekit-server-sdk is NOT installed in this project, so the LiveKit
// RoomService Twirp API is called directly over HTTP with a hand-minted
// HS256 admin access token instead of pulling in the SDK.
if (typeof window !== 'undefined') {
  throw new Error('lib/livekit/room-service.ts must never be imported client-side')
}

// Short TTL: this token is minted fresh for every moderation call and only
// needs to live long enough for that single Twirp round trip.
const ADMIN_TOKEN_TTL_SECONDS = 60 * 5 // 5 minutes

const MODERATOR_IDENTITY = 'hayesh-moderator'

interface RoomAdminVideoGrant {
  room: string
  roomAdmin: true
}

interface RoomAdminTokenPayload {
  iss: string
  sub: string
  iat: number
  nbf: number
  exp: number
  video: RoomAdminVideoGrant
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url')
}

/**
 * Reads NEXT_PUBLIC_LIVEKIT_URL and converts it from the ws(s):// scheme the
 * client SDK uses to the http(s):// scheme the RoomService Twirp/REST API
 * expects. Strips any trailing slash so callers can safely template
 * `${livekitHttpBase()}/twirp/...`.
 */
export function livekitHttpBase(): string {
  const rawUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL
  if (!rawUrl) {
    throw new Error('Video moderation is not configured (missing NEXT_PUBLIC_LIVEKIT_URL)')
  }

  const httpUrl = rawUrl.replace(/^wss:\/\//, 'https://').replace(/^ws:\/\//, 'http://')

  return httpUrl.replace(/\/+$/, '')
}

/**
 * Mints a short-lived HS256 LiveKit access token granting `roomAdmin` on a
 * single room — the credential the RoomService Twirp API requires for
 * server-to-server moderation calls (mute/remove/list). Never granted to a
 * real participant identity; always the fixed `hayesh-moderator` identity so
 * it's unambiguous in room state and never collides with a real user id.
 */
export async function mintRoomAdminToken(roomName: string): Promise<string> {
  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET

  if (!apiKey || !apiSecret) {
    throw new Error(
      'Video moderation is not configured: LIVEKIT_API_KEY and LIVEKIT_API_SECRET must both be set in .env.local'
    )
  }

  if (!roomName) {
    throw new Error('mintRoomAdminToken: roomName is required')
  }

  const nowSeconds = Math.floor(Date.now() / 1000)

  const header = { alg: 'HS256', typ: 'JWT' }
  const payload: RoomAdminTokenPayload = {
    iss: apiKey,
    sub: MODERATOR_IDENTITY,
    iat: nowSeconds,
    nbf: nowSeconds - 10,
    exp: nowSeconds + ADMIN_TOKEN_TTL_SECONDS,
    video: {
      room: roomName,
      roomAdmin: true,
    },
  }

  const encodedHeader = base64UrlEncode(JSON.stringify(header))
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  const signingInput = `${encodedHeader}.${encodedPayload}`
  const signature = createHmac('sha256', apiSecret).update(signingInput).digest('base64url')

  return `${signingInput}.${signature}`
}

/**
 * Calls one method of LiveKit's Twirp-based RoomService
 * (`POST /twirp/livekit.RoomService/<Method>`) with a fresh roomAdmin token
 * scoped to `roomName`. Throws with the response body text on any non-2xx
 * status so callers get a real error message instead of a silently empty
 * result.
 */
async function callRoomService<T>(method: string, body: object, roomName: string): Promise<T> {
  const adminToken = await mintRoomAdminToken(roomName)
  const url = `${livekitHttpBase()}/twirp/livekit.RoomService/${method}`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`LiveKit RoomService.${method} failed (${response.status}): ${text}`)
  }

  return (await response.json()) as T
}

export interface RoomServiceTrackInfo {
  sid: string
  type: string
  muted: boolean
}

export interface RoomServiceParticipant {
  identity: string
  tracks: RoomServiceTrackInfo[]
}

interface ListParticipantsResponse {
  participants?: RoomServiceParticipant[]
}

/** Lists all participants currently in `roomName`, each with their published tracks. */
export async function listParticipants(roomName: string): Promise<RoomServiceParticipant[]> {
  const data = await callRoomService<ListParticipantsResponse>('ListParticipants', { room: roomName }, roomName)
  return data.participants ?? []
}

/**
 * Mutes every AUDIO track currently published by `identity` in `roomName`
 * that isn't muted already. No-op if the participant has no unmuted audio
 * track (already muted, or audio-only never published).
 */
export async function muteParticipantAudio(roomName: string, identity: string): Promise<void> {
  const participants = await listParticipants(roomName)
  const participant = participants.find((candidate) => candidate.identity === identity)
  if (!participant) return

  const audioTracks = participant.tracks.filter((track) => track.type === 'AUDIO' && !track.muted)

  for (const track of audioTracks) {
    await callRoomService(
      'MutePublishedTrack',
      { room: roomName, identity, track_sid: track.sid, muted: true },
      roomName
    )
  }
}

/** Forcibly disconnects `identity` from `roomName`. */
export async function removeParticipant(roomName: string, identity: string): Promise<void> {
  await callRoomService('RemoveParticipant', { room: roomName, identity }, roomName)
}
