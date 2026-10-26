import Link from "next/link"
import { redirect } from "next/navigation"
import { AlertTriangle, ScrollText } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { AuditLogTable, type AuditLogRow } from "@/components/admin/AuditLogTable"

export const dynamic = "force-dynamic"
export const metadata = { title: "Audit log" }

const PAGE_SIZE = 50
/** Action prefixes are dotted verbs: letters, digits, underscore, dot only. */
const PREFIX_PATTERN = /^[a-z0-9_.]{1,40}$/

interface PageProps {
  searchParams: Promise<{ before?: string; action?: string }>
}

interface RawRow {
  id: number
  actor_id: string | null
  created_at: string
  action: string
  target_table: string | null
  target_id: string | null
  reason: string | null
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
}

function pageHref(params: { before?: number; action?: string }): string {
  const qs = new URLSearchParams()
  if (params.action) qs.set("action", params.action)
  if (params.before) qs.set("before", String(params.before))
  const text = qs.toString()
  return text ? `/admin/audit?${text}` : "/admin/audit"
}

export default async function AdminAuditPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
  if (me?.role !== "admin") redirect("/")

  const sp = await searchParams
  const beforeId = /^\d{1,15}$/.test(sp.before ?? "") ? Number(sp.before) : null
  const actionPrefix = sp.action && PREFIX_PATTERN.test(sp.action) ? sp.action : ""

  let rows: AuditLogRow[] = []
  let hasMore = false
  let loadError: string | null = null

  // Read through the session client so RLS (admin-only SELECT) is enforced too.
  let query = supabase
    .from("admin_audit_log")
    .select("id, actor_id, created_at, action, target_table, target_id, reason, before, after")
    .order("id", { ascending: false })
    .limit(PAGE_SIZE + 1)
  if (beforeId) query = query.lt("id", beforeId)
  if (actionPrefix) query = query.like("action", `${actionPrefix}%`)

  const { data, error } = await query
  if (error) {
    console.error("[admin/audit] load failed", error.message)
    loadError = "Could not load the audit log. Make sure migration 026 has been applied."
  } else {
    const raw = (data ?? []) as RawRow[]
    hasMore = raw.length > PAGE_SIZE
    const pageRows = raw.slice(0, PAGE_SIZE)
    const actorIds = Array.from(new Set(pageRows.map((r) => r.actor_id).filter((v): v is string => Boolean(v))))
    const { data: actors } = actorIds.length
      ? await createAdminClient().from("profiles").select("id, full_name, email").in("id", actorIds)
      : { data: [] as Array<{ id: string; full_name: string | null; email: string | null }> }
    const byId = new Map((actors ?? []).map((a: { id: string; full_name: string | null; email: string | null }) => [a.id, a]))
    rows = pageRows.map((r) => {
      const actor = r.actor_id ? byId.get(r.actor_id) : undefined
      return { ...r, actor_name: actor?.full_name ?? null, actor_email: actor?.email ?? null }
    })
  }

  const lastId = rows.length ? rows[rows.length - 1].id : undefined

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Admin / Audit log</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-text-primary sm:text-3xl">Audit log</h1>
        <p className="mt-1 text-sm text-text-muted">
          Append-only record of admin actions on money, roles, approvals and settings.
        </p>
      </div>

      <form method="get" action="/admin/audit" className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Action prefix</span>
          <input
            name="action"
            defaultValue={actionPrefix}
            placeholder="e.g. transaction"
            maxLength={40}
            className="h-10 w-56 rounded-lg border border-border bg-surface px-3 text-sm text-text-primary placeholder:text-text-disabled focus:border-line-strong focus:outline-none"
          />
        </label>
        <button type="submit" className="h-10 rounded-lg border border-border bg-surface-elevated px-4 text-sm text-text-primary hover:border-line-strong">
          Filter
        </button>
        {actionPrefix ? (
          <Link href="/admin/audit" className="h-10 content-center text-sm text-text-muted hover:text-text-primary">
            Clear
          </Link>
        ) : null}
      </form>

      {loadError ? (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-accent-danger/30 bg-accent-danger/10 p-4 text-sm text-accent-danger">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {loadError}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-12 text-center">
          <ScrollText className="mx-auto h-10 w-10 text-text-disabled" />
          <p className="mt-3 text-text-primary">No audit entries{actionPrefix ? ` for "${actionPrefix}"` : ""}</p>
          <p className="mt-1 text-sm text-text-muted">Admin actions will appear here as they happen.</p>
        </div>
      ) : (
        <>
          <AuditLogTable rows={rows} />
          <div className="flex items-center justify-between text-sm">
            {beforeId ? (
              <Link href={pageHref({ action: actionPrefix })} className="text-text-muted hover:text-text-primary">
                Newest entries
              </Link>
            ) : (
              <span />
            )}
            {hasMore && lastId ? (
              <Link href={pageHref({ before: lastId, action: actionPrefix })} className="text-accent-primary hover:underline">
                Older entries
              </Link>
            ) : null}
          </div>
        </>
      )}
    </div>
  )
}
