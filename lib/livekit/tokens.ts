import { createHmac } from 'crypto'

// SERVER ONLY. `livekit-server-sdk` is NOT installed in this project (absent
// from package.json/package-lock.json/node_modules, and adding a dependency
// is out of scope for this change) — so a LiveKit access token is hand-minted
// here as a plain HS256 JWT signed with LIVEKIT_API_SECRET, following the
// same "no server-only package, use a manual runtime guard" idiom already
// established in lib/supabase/admin.ts and lib/crypto/field-encryption.ts.
// The `server-only` npm package is likewise NOT installed — do not import it.
if (typeof window !== 'undefined') {
  throw new Error('lib/livekit/tokens.ts must never be imported client-side')
}

// Token lifetime: short enough that a leaked/cached token stops working
// quickly, long enough to cover a full tutoring session without expiring
// mid-call (LiveKit does not currently support silent token refresh for an
// already-connected room, so this must comfortably exceed the longest
// expected meeting).
const TOKEN_TTL_SECONDS = 60 * 60 * 2 // 2 hours

interface LiveKitVideoGrant {
  room: string
  roomJoin: true
  canPublish: boolean
  canSubscribe: true
  canPublishData: true
}

interface LiveKitTokenPayload {
  iss: string
  sub: string
  name: string
  iat: number
  nbf: number
  exp: number
  video: LiveKitVideoGrant
}

export interface CreateLiveKitTokenParams {
  /** Room name to grant access to. Always derived server-side from the meeting row — never trust a client-supplied room name. */
  roomName: string
  /** Participant identity — the authenticated user's profile id. */
  identity: string
  /** Display name shown to other participants. */
  name?: string
  /** Whether this identity may publish audio/video/data. Defaults to true (both organizer and participant can publish). */
  canPublish?: boolean
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url')
}

/**
 * Mints a LiveKit access token: a plain HS256 JWT with `iss` = API key,
 * `sub` = participant identity, and a `video` grant claim. Reads
 * LIVEKIT_API_KEY / LIVEKIT_API_SECRET from process.env at CALL time (never
 * at module import time) so a missing env var surfaces as a clear, catchable
 * error from the API route rather than crashing the whole server on boot.
 */
export async function createLiveKitToken({
  roomName,
  identity,
  name,
  canPublish = true,
}: CreateLiveKitTokenParams): Promise<string> {
  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET

  if (!apiKey || !apiSecret) {
    throw new Error(
      'Video calling is not configured: LIVEKIT_API_KEY and LIVEKIT_API_SECRET must both be set in .env.local'
    )
  }

  if (!roomName) {
    throw new Error('createLiveKitToken: roomName is required')
  }

  if (!identity) {
    throw new Error('createLiveKitToken: identity is required')
  }

  const nowSeconds = Math.floor(Date.now() / 1000)

  const header = { alg: 'HS256', typ: 'JWT' }
  const payload: LiveKitTokenPayload = {
    iss: apiKey,
    sub: identity,
    name: name || identity,
    iat: nowSeconds,
    nbf: nowSeconds - 10,
    exp: nowSeconds + TOKEN_TTL_SECONDS,
    video: {
      room: roomName,
      roomJoin: true,
      canPublish,
      canSubscribe: true,
      canPublishData: true,
    },
  }

  const encodedHeader = base64UrlEncode(JSON.stringify(header))
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  const signingInput = `${encodedHeader}.${encodedPayload}`
  const signature = createHmac('sha256', apiSecret).update(signingInput).digest('base64url')

  return `${signingInput}.${signature}`
}
