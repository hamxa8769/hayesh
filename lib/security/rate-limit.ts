/**
 * Rate limiter for API routes.
 *
 * When UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are both set, limits
 * are enforced across all serverless instances with an Upstash sliding window
 * (prefix `hayesh:rl`). Otherwise — local dev, or Redis not configured — it
 * falls back to a per-instance fixed window held in module memory, which only
 * blunts abuse within a single instance.
 *
 * Redis failures (errors or timeouts) FAIL OPEN to the in-memory limiter, with a
 * single console.warn per cold start: real users are never blocked because the
 * store is down.
 */

import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()
const MAX_TRACKED_KEYS = 5000
const REDIS_TIMEOUT_MS = 1500

export interface RateLimitResult {
  ok: boolean
  retryAfterSeconds: number
}

function memoryRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
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

let redis: Redis | null = null
const limiters = new Map<string, Ratelimit>()
let warned = false

function getLimiter(limit: number, windowMs: number): Ratelimit | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null

  const id = `${limit}:${windowMs}`
  const cached = limiters.get(id)
  if (cached) return cached

  redis ??= new Redis({ url, token })
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms`),
    prefix: "hayesh:rl",
  })
  limiters.set(id, limiter)
  return limiter
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("rate-limit redis timeout")), ms)
    promise.then(
      (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      (e: unknown) => {
        clearTimeout(timer)
        reject(e)
      },
    )
  })
}

export async function rateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  try {
    const limiter = getLimiter(limit, windowMs)
    if (limiter) {
      const res = await withTimeout(limiter.limit(key), REDIS_TIMEOUT_MS)
      if (res.success) return { ok: true, retryAfterSeconds: 0 }
      return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((res.reset - Date.now()) / 1000)) }
    }
  } catch (error: unknown) {
    if (!warned) {
      warned = true
      console.warn("[rate-limit] Redis unavailable, falling back to in-memory limiter:", error instanceof Error ? error.message : error)
    }
  }
  return memoryRateLimit(key, limit, windowMs)
}

/** Best-effort client IP for anonymous rate-limit keys. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  if (forwarded) return forwarded
  return request.headers.get("x-real-ip")?.trim() || "unknown"
}
