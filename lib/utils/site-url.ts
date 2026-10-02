/** Canonical public origin, e.g. https://hayesh.com. Set NEXT_PUBLIC_APP_URL in production. */
export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  return raw.replace(/\/+$/, "")
}
