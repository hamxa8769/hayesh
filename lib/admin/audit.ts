import { reportError } from "@/lib/observability/report-error"
import { createAdminClient } from "@/lib/supabase/admin"

if (typeof window !== "undefined") {
  throw new Error("lib/admin/audit.ts must never be imported client-side")
}

export interface AdminAuditInput {
  actorId: string
  /** Dotted verb, e.g. `transaction.confirm`, `user.role_change`. */
  action: string
  targetTable?: string
  targetId?: string
  before?: Record<string, unknown> | null
  after?: Record<string, unknown> | null
  reason?: string | null
  request?: Request
}

const MAX_SHORT = 200
const MAX_REASON = 2000
const MAX_JSON_BYTES = 20_000

function truncate(value: string | null | undefined, max: number): string | null {
  if (!value) return null
  return value.length > max ? value.slice(0, max) : value
}

function clampJson(value: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!value) return null
  try {
    const json = JSON.stringify(value)
    if (json.length <= MAX_JSON_BYTES) return JSON.parse(json) as Record<string, unknown>
    return { _truncated: true, preview: json.slice(0, MAX_JSON_BYTES) }
  } catch {
    return { _unserializable: true }
  }
}

function clientIp(request?: Request): string | null {
  const forwarded = request?.headers.get("x-forwarded-for")
  const first = forwarded?.split(",")[0]?.trim()
  return truncate(first || request?.headers.get("x-real-ip") || null, 64)
}

function reportFailure(error: unknown, input: AdminAuditInput): void {
  reportError(error, {
    event: "admin_audit_log_failed",
    action: input.action,
    targetTable: input.targetTable ?? null,
    targetId: input.targetId ?? null,
  })
}

/** Appends an admin action to the audit log. Never throws. */
export async function logAdminAction(input: AdminAuditInput): Promise<void> {
  try {
    const admin = createAdminClient()
    const { error } = await admin.from("admin_audit_log").insert({
      actor_id: input.actorId,
      action: truncate(input.action, MAX_SHORT) ?? "unknown",
      target_table: truncate(input.targetTable, MAX_SHORT),
      target_id: truncate(input.targetId, MAX_SHORT),
      before: clampJson(input.before),
      after: clampJson(input.after),
      reason: truncate(input.reason, MAX_REASON),
      ip: clientIp(input.request),
      user_agent: truncate(input.request?.headers.get("user-agent"), MAX_SHORT),
    })
    if (error) reportFailure(error, input)
  } catch (error) {
    reportFailure(error, input)
  }
}
