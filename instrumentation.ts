import type { Instrumentation } from "next"

export function register(): void {}

/**
 * Every unhandled server error (pages, route handlers, server actions)
 * is logged as one structured JSON line, which Vercel's log drain / any
 * log search can alert on. No request bodies or headers are logged.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const err = error as Error & { digest?: string }
  console.error(
    JSON.stringify({
      level: "error",
      source: "next-request",
      message: err?.message ?? String(error),
      digest: err?.digest,
      method: request.method,
      path: request.path,
      routePath: context.routePath,
      routeType: context.routeType,
      time: new Date().toISOString(),
    })
  )
}
