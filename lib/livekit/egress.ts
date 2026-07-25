import { createHmac } from 'crypto'
import { livekitHttpBase } from '@/lib/livekit/room-service'

// SERVER ONLY. Wraps LiveKit's Egress Twirp API to record a room. Like
// lib/livekit/room-service.ts, it hand-mints its own short-lived access token
// (livekit-server-sdk is not installed) — here with a `roomRecord` grant, the
// credential the Egress API requires.
if (typeof window !== 'undefined') {
  throw new Error('lib/livekit/egress.ts must never be imported client-side')
}

const EGRESS_TOKEN_TTL_SECONDS = 60 * 5 // 5 minutes
const EGRESS_IDENTITY = 'hayesh-egress'

/**
 * Recording is only actually available when an S3-compatible output target is
 * configured. Until then the record route reports a clean "not configured"
 * instead of failing — the UI stays usable, it just tells the host to ask the
 * operator to set this up. All four vars must be present.
 */
export function isEgressConfigured(): boolean {
  return Boolean(
    process.env.LIVEKIT_EGRESS_S3_BUCKET &&
      process.env.LIVEKIT_EGRESS_S3_ACCESS_KEY &&
      process.env.LIVEKIT_EGRESS_S3_SECRET &&
      process.env.LIVEKIT_EGRESS_S3_REGION
  )
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url')
}

interface EgressTokenPayload {
  iss: string
  sub: string
  iat: number
  nbf: number
  exp: number
  video: { roomRecord: true }
}

/** Mints a short-lived HS256 token with a `roomRecord` grant for Egress calls. */
async function mintEgressToken(): Promise<string> {
  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET

  if (!apiKey || !apiSecret) {
    throw new Error(
      'Recording is not configured: LIVEKIT_API_KEY and LIVEKIT_API_SECRET must both be set in .env.local'
    )
  }

  const nowSeconds = Math.floor(Date.now() / 1000)
  const header = { alg: 'HS256', typ: 'JWT' }
  const payload: EgressTokenPayload = {
    iss: apiKey,
    sub: EGRESS_IDENTITY,
    iat: nowSeconds,
    nbf: nowSeconds - 10,
    exp: nowSeconds + EGRESS_TOKEN_TTL_SECONDS,
    video: { roomRecord: true },
  }

  const encodedHeader = base64UrlEncode(JSON.stringify(header))
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  const signingInput = `${encodedHeader}.${encodedPayload}`
  const signature = createHmac('sha256', apiSecret).update(signingInput).digest('base64url')

  return `${signingInput}.${signature}`
}

/** POSTs one method of LiveKit's Egress Twirp service, throwing on non-2xx. */
async function callEgress<T>(method: string, body: object): Promise<T> {
  const token = await mintEgressToken()
  const url = `${livekitHttpBase()}/twirp/livekit.Egress/${method}`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`LiveKit Egress.${method} failed (${response.status}): ${text}`)
  }

  return (await response.json()) as T
}

interface StartEgressResponse {
  egress_id?: string
}

/**
 * Starts recording the whole room as a single MP4 to the configured S3 bucket.
 * Throws the exact message "Recording is not configured" (which the route maps
 * to a clean 501) when the storage target is not set up yet.
 */
export async function startRoomRecording(roomName: string): Promise<{ egressId: string }> {
  if (!isEgressConfigured()) {
    throw new Error('Recording is not configured')
  }

  const data = await callEgress<StartEgressResponse>('StartRoomCompositeEgress', {
    room_name: roomName,
    layout: 'speaker',
    file_outputs: [
      {
        file_type: 'MP4',
        filepath: `hayesh/${roomName}-${Date.now()}.mp4`,
        s3: {
          access_key: process.env.LIVEKIT_EGRESS_S3_ACCESS_KEY,
          secret: process.env.LIVEKIT_EGRESS_S3_SECRET,
          bucket: process.env.LIVEKIT_EGRESS_S3_BUCKET,
          region: process.env.LIVEKIT_EGRESS_S3_REGION,
        },
      },
    ],
  })

  if (!data.egress_id) {
    throw new Error('Recording did not start (no egress id returned)')
  }

  return { egressId: data.egress_id }
}

/** Stops an in-progress recording by its egress id. */
export async function stopRoomRecording(egressId: string): Promise<void> {
  await callEgress('StopEgress', { egress_id: egressId })
}
