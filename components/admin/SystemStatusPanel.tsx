"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, CheckCircle2, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils/cn"

interface ConfigCheck {
  key: string
  label: string
  level: "required" | "recommended" | "optional"
  ok: boolean
  impact: string
}

/**
 * Admin overview banner: flags missing server configuration (e.g.
 * FIELD_ENCRYPTION_KEY) before customers run into it.
 */
export function SystemStatusPanel() {
  const [checks, setChecks] = useState<ConfigCheck[] | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch("/api/admin/system-status", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { checks: ConfigCheck[] } | null) => {
        if (!cancelled && body) setChecks(body.checks)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  if (!checks) return null
  const missingRequired = checks.filter((c) => !c.ok && c.level === "required")
  const missingOther = checks.filter((c) => !c.ok && c.level !== "required")
  const allGood = missingRequired.length === 0 && missingOther.length === 0

  return (
    <section
      aria-label="System configuration"
      className={cn(
        "rounded-lg border p-4",
        missingRequired.length > 0
          ? "border-accent-danger/40 bg-accent-danger/5"
          : missingOther.length > 0
            ? "border-accent-warning/40 bg-accent-warning/5"
            : "border-border bg-surface"
      )}
    >
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-3 text-left">
        <span className="flex items-center gap-2">
          {allGood ? (
            <CheckCircle2 className="h-4 w-4 text-accent-success" aria-hidden="true" />
          ) : (
            <AlertTriangle className={cn("h-4 w-4", missingRequired.length ? "text-accent-danger" : "text-accent-warning")} aria-hidden="true" />
          )}
          <span className="text-sm font-medium text-text-primary">
            {allGood
              ? "All server settings are configured"
              : missingRequired.length > 0
                ? `${missingRequired.length} required setting${missingRequired.length > 1 ? "s" : ""} missing — some features will fail for customers`
                : `${missingOther.length} recommended setting${missingOther.length > 1 ? "s" : ""} not configured`}
          </span>
        </span>
        <ChevronDown className={cn("h-4 w-4 text-text-muted transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>

      {open && (
        <ul className="mt-4 divide-y divide-border">
          {checks.map((c) => (
            <li key={c.key} className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <p className="text-sm text-text-primary">
                  {c.label} <span className="font-mono text-xs text-text-muted">{c.key}</span>
                </p>
                {!c.ok && <p className="text-xs text-text-muted">{c.impact}</p>}
              </div>
              <span
                className={cn(
                  "shrink-0 font-mono text-xs uppercase tracking-[0.12em]",
                  c.ok ? "text-accent-success" : c.level === "required" ? "text-accent-danger" : "text-accent-warning"
                )}
              >
                {c.ok ? "Configured" : c.level === "required" ? "Missing" : "Not set"}
              </span>
            </li>
          ))}
          <li className="pt-3 text-xs text-text-muted">
            Set these in Vercel → Project → Settings → Environment Variables, then redeploy. See docs/PRODUCTION.md.
          </li>
        </ul>
      )}
    </section>
  )
}
