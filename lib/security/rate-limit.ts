/**
 * Lightweight fixed-window rate limiter for API routes.
 *
 * State lives in module memory, so on Vercel it is per serverless instance —
 * enough to blunt scripted abuse of expensive endpoints (LLM calls, uploads,
 * checkout) without an external store. Swap for Upstash/Redis if traffic
 * grows to the point where cross-instance limits matter.
 */

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()
const MAX_TRACKED_KEYS = 5000

export interface RateLimitResult {
  ok: boolean
  retryAfterSeconds: number
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()

  if (buckets.size > MAX_TRACKED_KEYS) {
    for (const [k, b] of buckets) {
      if (b.resetAt <= now) buckets.delete(k)
    }
  }

  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, retryAfterSeconds: 0 }
  }

  if (bucket.count >= limit) {
    return { ok: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) }
  }

  buckets.set(key, { count: bucket.count + 1, resetAt: bucket.resetAt })
  return { ok: true, retryAfterSeconds: 0 }
}
