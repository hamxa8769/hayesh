"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { LifeBuoy, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/utils/format"
import { cn } from "@/lib/utils/cn"

export type SupportTicketStatus = "open" | "pending" | "resolved" | "closed"
export type SupportTicketPriority = "low" | "normal" | "high"

export interface SupportTicket {
  id: string
  user_id: string
  subject: string
  category: string | null
  status: SupportTicketStatus
  priority: SupportTicketPriority
  assigned_admin_id: string | null
  created_at: string | null
  updated_at: string | null
  resolved_at: string | null
}

export interface AdminSupportTicketRow extends SupportTicket {
  requester_name: string
  requester_email: string
  requester_role: string
}

const STATUS_TABS: { value: SupportTicketStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "pending", label: "Pending" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
]

const STATUS_BADGE: Record<SupportTicketStatus, "warning" | "outline" | "success" | "secondary"> = {
  open: "warning",
  pending: "outline",
  resolved: "success",
  closed: "secondary",
}

const PRIORITY_BADGE: Record<SupportTicketPriority, "secondary" | "outline" | "destructive"> = {
  low: "secondary",
  normal: "outline",
  high: "destructive",
}

interface RawTicketRow extends SupportTicket {
  profiles: { full_name: string; email: string; role: string } | null
}

export function TicketList() {
  const [tickets, setTickets] = useState<AdminSupportTicketRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<SupportTicketStatus | "all">("all")
  const [priorityFilter, setPriorityFilter] = useState<SupportTicketPriority | "all">("all")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const { data, error: fetchError } = await supabase
        .from("support_tickets")
        // Disambiguate: support_tickets has TWO FKs to profiles (user_id and
        // assigned_admin_id), so a bare profiles(...) embed is rejected as
        // ambiguous. Pin it to the requester (user_id).
        .select("*, profiles!user_id(full_name, email, role)")
        .order("created_at", { ascending: false })

      if (fetchError) throw new Error(fetchError.message)

      const rows = (data ?? []) as unknown as RawTicketRow[]
      setTickets(
        rows.map((t) => ({
          ...t,
          requester_name: t.profiles?.full_name ?? "Unknown user",
          requester_email: t.profiles?.email ?? "",
          requester_role: t.profiles?.role ?? "",
        }))
      )
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load tickets")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const counts = useMemo(() => {
    const base: Record<SupportTicketStatus, number> = { open: 0, pending: 0, resolved: 0, closed: 0 }
    for (const t of tickets) base[t.status] = (base[t.status] ?? 0) + 1
    return base
  }, [tickets])

  const filtered = useMemo(
    () =>
      tickets.filter(
        (t) => (statusFilter === "all" || t.status === statusFilter) && (priorityFilter === "all" || t.priority === priorityFilter)
      ),
    [tickets, statusFilter, priorityFilter]
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-2 border-b border-border pb-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={cn(
                "relative flex items-center gap-2 px-3 py-2 font-mono text-xs uppercase tracking-[0.1em] transition-colors",
                statusFilter === tab.value ? "text-text-primary" : "text-text-muted hover:text-text-primary"
              )}
            >
              {tab.label}
              {tab.value !== "all" && (
                <span className="rounded-full bg-surface-elevated px-1.5 py-0.5 text-[10px] tabular-nums text-text-muted">
                  {counts[tab.value]}
                </span>
              )}
              {statusFilter === tab.value && (
                <span className="absolute inset-x-0 -bottom-[5px] h-[2px] [background:linear-gradient(110deg,#27C4A0,#5AD1B0_40%,#F5B84E)]" />
              )}
            </button>
          ))}
        </div>

        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value as SupportTicketPriority | "all")}
          className="h-9 rounded-lg border border-border bg-surface-elevated px-3 text-xs text-text-primary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
        >
          <option value="all">All priorities</option>
          <option value="low">Low priority</option>
          <option value="normal">Normal priority</option>
          <option value="high">High priority</option>
        </select>

        <button
          onClick={() => load()}
          aria-label="Refresh"
          className="ml-auto flex items-center gap-1.5 rounded-md px-2 py-1.5 font-mono text-xs text-text-muted transition-colors hover:bg-surface-elevated hover:text-text-primary"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg border border-border bg-surface" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-accent-danger/30 bg-accent-danger/10 p-6 text-center">
          <p className="text-sm text-accent-danger">{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => load()}>
            Try again
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-12 text-center">
          <LifeBuoy className="mx-auto h-10 w-10 text-text-disabled" />
          <p className="mt-3 text-sm text-text-muted">No tickets match this filter</p>
        </div>
      ) : (
        <>
          {/* Mobile: stacked cards */}
          <div className="space-y-3 sm:hidden">
            {filtered.map((t) => (
              <Link
                key={t.id}
                href={`/admin/support/${t.id}`}
                className="block rounded-lg border border-border bg-surface p-4 transition-colors hover:bg-surface-elevated"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text-primary">{t.subject}</p>
                    <p className="mt-0.5 truncate text-xs text-text-muted">
                      {t.requester_name} &middot; {t.category ?? "General"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge variant={STATUS_BADGE[t.status]}>{t.status}</Badge>
                    <Badge variant={PRIORITY_BADGE[t.priority]}>{t.priority}</Badge>
                  </div>
                </div>
                <p className="mt-2 font-mono text-xs tabular-nums text-text-muted">
                  {t.created_at ? formatDate(t.created_at) : "—"}
                </p>
              </Link>
            ))}
          </div>

          {/* Desktop / tablet: table */}
          <div className="hidden overflow-x-auto rounded-lg border border-border bg-surface sm:block">
            <div className="min-w-[820px]">
              <div className="grid grid-cols-[1.6fr_1fr_120px_110px_110px_140px] gap-4 border-b border-border px-4 pb-3 pt-4 font-mono text-xs uppercase tracking-[0.1em] text-text-muted">
                <span>Subject</span>
                <span>Requester</span>
                <span>Category</span>
                <span>Priority</span>
                <span>Status</span>
                <span>Created</span>
              </div>
              {filtered.map((t) => (
                <Link
                  key={t.id}
                  href={`/admin/support/${t.id}`}
                  className="grid grid-cols-[1.6fr_1fr_120px_110px_110px_140px] items-center gap-4 border-b border-border px-4 py-3 transition-colors last:border-b-0 hover:bg-surface-elevated"
                >
                  <p className="truncate text-sm font-medium text-text-primary">{t.subject}</p>
                  <div className="min-w-0">
                    <p className="truncate text-sm text-text-muted">{t.requester_name}</p>
                    <p className="truncate text-xs text-text-disabled">{t.requester_role}</p>
                  </div>
                  <p className="truncate text-sm text-text-muted">{t.category ?? "General"}</p>
                  <Badge variant={PRIORITY_BADGE[t.priority]}>{t.priority}</Badge>
                  <Badge variant={STATUS_BADGE[t.status]}>{t.status}</Badge>
                  <p className="font-mono text-xs tabular-nums text-text-muted">
                    {t.created_at ? formatDate(t.created_at) : "—"}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
