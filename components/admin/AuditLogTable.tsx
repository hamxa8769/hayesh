"use client"

import { Fragment, useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils/cn"
import { formatDateTime } from "@/lib/utils/format"

export interface AuditLogRow {
  id: number
  created_at: string
  action: string
  target_table: string | null
  target_id: string | null
  reason: string | null
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  actor_name: string | null
  actor_email: string | null
}

function actionTone(action: string): string {
  if (/(reject|refund|suspend|delete|fail)/.test(action)) return "border-accent-danger/30 bg-accent-danger/10 text-accent-danger"
  if (/(approve|confirm|release|publish|reactivate)/.test(action)) return "border-accent-success/30 bg-accent-success/10 text-accent-success"
  return "border-accent-warning/30 bg-accent-warning/10 text-accent-warning"
}

function JsonBlock({ label, value }: { label: string; value: Record<string, unknown> | null }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">{label}</p>
      <pre className="mt-1 max-h-64 overflow-auto rounded-lg border border-border bg-background p-3 font-mono text-xs text-text-primary">
        {value ? JSON.stringify(value, null, 2) : "—"}
      </pre>
    </div>
  )
}

export function AuditLogTable({ rows }: { rows: AuditLogRow[] }) {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-border font-mono text-xs uppercase tracking-[0.12em] text-text-muted">
            <th className="w-8 px-3 py-3" aria-label="Details" />
            <th className="px-3 py-3 font-normal">Time</th>
            <th className="px-3 py-3 font-normal">Actor</th>
            <th className="px-3 py-3 font-normal">Action</th>
            <th className="px-3 py-3 font-normal">Target</th>
            <th className="px-3 py-3 font-normal">Reason</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isOpen = open === row.id
            const hasDetail = Boolean(row.before || row.after)
            return (
              <Fragment key={row.id}>
                <tr className="border-b border-border/60 align-top last:border-0">
                  <td className="px-3 py-3">
                    {hasDetail ? (
                      <button
                        type="button"
                        onClick={() => setOpen(isOpen ? null : row.id)}
                        aria-expanded={isOpen}
                        aria-label={isOpen ? "Hide changes" : "Show changes"}
                        className="text-text-muted hover:text-text-primary"
                      >
                        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 font-mono text-xs tabular-nums text-text-muted">
                    {formatDateTime(row.created_at)}
                  </td>
                  <td className="px-3 py-3">
                    <p className="text-text-primary">{row.actor_name ?? "Deleted user"}</p>
                    {row.actor_email ? <p className="text-xs text-text-muted">{row.actor_email}</p> : null}
                  </td>
                  <td className="px-3 py-3">
                    <span className={cn("inline-block whitespace-nowrap rounded-full border px-2.5 py-0.5 font-mono text-xs", actionTone(row.action))}>
                      {row.action}
                    </span>
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-text-muted">
                    {row.target_table ?? "—"}
                    {row.target_id ? <span className="block max-w-[180px] truncate text-text-disabled" title={row.target_id}>{row.target_id}</span> : null}
                  </td>
                  <td className="max-w-[260px] px-3 py-3 text-text-muted">{row.reason ?? "—"}</td>
                </tr>
                {isOpen ? (
                  <tr className="border-b border-border/60 bg-surface-elevated">
                    <td />
                    <td colSpan={5} className="px-3 py-3">
                      <div className="flex flex-col gap-3 sm:flex-row">
                        <JsonBlock label="Before" value={row.before} />
                        <JsonBlock label="After" value={row.after} />
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
