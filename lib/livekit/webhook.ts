import { createHash, createHmac, timingSafeEqual } from 'crypto'
import { z } from 'zod'

// SERVER ONLY. Verifies LiveKit webhooks without livekit-server-sdk: the
// Authorization header is an HS256 JWT signed with LIVEKIT_API_SECRET whose
// `sha256` claim is the base64 SHA-256 of the raw request body.
if (typeof window !== 'undefined') {
  throw new Error('lib/livekit/webhook.ts must never be imported client-side')
}

export { decideClassOutcome } from '@/lib/livekit/class-outcome'

export const WEBHOOK_LEEWAY_SECONDS = 60

const timestamp = z.union([z.string(), z.number()]).optional()

const fileSchema = z
  .object({
    filename: z.string().optional(),
    location: z.string().optional(),
    duration: z.union([z.string(), z.number()]).optional(),
    size: z.union([z.string(), z.number()]).optional(),
  })
  .passthrough()

const egressInfoSchema = z
  .object({
    egressId: z.string(),
    roomName: z.string().optional(),
    status: z.union([z.string(), z.number()]).optional(),
    startedAt: timestamp,
    endedAt: timestamp,
    fileResults: z.array(fileSchema).optional(),
    file: fileSchema.optional(),
  })
  .passthrough()

export const livekitWebhookEventSchema = z
  .object({
    event: z.string(),
    id: z.string().min(1),
    createdAt: timestamp,
    room: z.object({ name: z.string().optional() }).passthrough().optional(),
    participant: z.object({ identity: z.string().optional() }).passthrough().optional(),
    egressInfo: egressInfoSchema.optional(),
  })
  .passthrough()

export type LiveKitWebhookEvent = z.infer<typeof livekitWebhookEventSchema>
export type LiveKitEgressInfo = z.infer<typeof egressInfoSchema>

const jwtHeaderSchema = z.object({ alg: z.string() }).passthrough()
const jwtClaimsSchema = z
  .object({
    iss: z.string().optional(),
    exp: z.number().optional(),
    nbf: z.number().optional(),
    sha256: z.string().optional(),
  })
  .passthrough()

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

function decodeJson(segment: string): unknown {
  try {
    return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

export interface VerifyOptions {
  apiKey?: string
  apiSecret?: string
  /** Seconds since epoch; injectable for tests. */
  now?: number
}

/** True when `authHeader` is a valid LiveKit webhook JWT for exactly this raw body. */
export function verifyLiveKitWebhook(rawBody: string, authHeader: string | null, options: VerifyOptions = {}): boolean {
  const apiKey = options.apiKey ?? process.env.LIVEKIT_API_KEY
  const apiSecret = options.apiSecret ?? process.env.LIVEKIT_API_SECRET
  if (!apiKey || !apiSecret || !authHeader) return false

  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  const parts = token.split('.')
  if (parts.length !== 3) return false
  const [encodedHeader, encodedPayload, signature] = parts

  const header = jwtHeaderSchema.safeParse(decodeJson(encodedHeader))
  if (!header.success || header.data.alg !== 'HS256') return false

  const expected = createHmac('sha256', apiSecret).update(`${encodedHeader}.${encodedPayload}`).digest('base64url')
  if (!safeEqual(signature, expected)) return false

  const claims = jwtClaimsSchema.safeParse(decodeJson(encodedPayload))
  if (!claims.success) return false
  const { iss, exp, nbf, sha256 } = claims.data
  if (iss !== apiKey) return false

  const now = options.now ?? Math.floor(Date.now() / 1000)
  if (typeof exp !== 'number' || now > exp + WEBHOOK_LEEWAY_SECONDS) return false
  if (typeof nbf !== 'number' || now < nbf - WEBHOOK_LEEWAY_SECONDS) return false

  if (typeof sha256 !== 'string') return false
  const bodyHash = createHash('sha256').update(rawBody, 'utf8').digest('base64')
  // LiveKit may emit base64 or hex; accept the base64 form (and its url-safe/hex variants).
  const hashBytes = createHash('sha256').update(rawBody, 'utf8').digest()
  return safeEqual(sha256, bodyHash) || safeEqual(sha256, hashBytes.toString('hex'))
}

/** Unix seconds (string or number) -> ISO string, or null. */
export function unixToIso(value: string | number | undefined): string | null {
  if (value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  // LiveKit sends seconds for createdAt/startedAt; egress startedAt/endedAt may be nanoseconds.
  const ms = n > 1e17 ? n / 1e6 : n > 1e14 ? n / 1e3 : n > 1e11 ? n : n * 1000
  return new Date(ms).toISOString()
}
