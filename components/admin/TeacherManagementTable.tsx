"use client"

import { useMemo, useState } from "react"
import { GraduationCap, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TeacherAdminCard } from "@/components/admin/TeacherAdminCard"
import { cn } from "@/lib/utils/cn"
import type { ApprovalStatus, Profile, Teacher } from "@/types/database"

/**
 * Admin teacher directory + control surface. Deliberately a responsive card
 * list rather than a literal <table>: with per-row approve/reject/feature/
 * suspend actions plus an inline edit form, a rigid grid-column table either
 * clips content or forces a wide min-width (and therefore page-body
 * horizontal scroll) on small viewports — exactly the overlapping-text /
 * misalignment complaint this rebuild is meant to fix. Cards reflow with
 * flex-wrap at every breakpoint, so nothing here ever needs its own
 * overflow-x:auto scroller and the page body never scrolls horizontally.
 *
 * All privileged writes happen inside TeacherAdminCard via PATCH
 * /api/admin/users; this component only reads (search/filter) local state.
 */

export interface TeacherWithProfile {
  teacher: Teacher
  profile: Profile | null
}

export interface TeacherManagementTableProps {
  rows: TeacherWithProfile[]
  loading: boolean
  error: string | null
  onRetry: () => void
  onTeacherUpdated: (teacher: Teacher) => void
  onProfileUpdated: (profile: Profile) => void
}

type StatusFilter = ApprovalStatus | "all"
type AccessFilter = "all" | "active" | "suspended"

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
]

const ACCESS_FILTERS: { value: AccessFilter; label: string }[] = [
  { value: "all", label: "All accounts" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
]

function FilterChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1 font-mono text-xs uppercase tracking-[0.08em] transition-colors",
        active
          ? "border-accent-primary/50 bg-accent-primary/10 text-accent-primary"
          : "border-border text-text-muted hover:border-line-strong hover:text-text-primary"
      )}
    >
      {label}
    </button>
  )
}

export function TeacherManagementTable({
  rows,
  loading,
  error,
  onRetry,
  onTeacherUpdated,
  onProfileUpdated,
}: TeacherManagementTableProps) {
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<StatusFilter>("all")
  const [access, setAccess] = useState<AccessFilter>("all")

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return rows.filter(({ teacher, profile }) => {
      const teacherStatus = teacher.status ?? "pending"
      if (status !== "all" && teacherStatus !== status) return false

      const isSuspended = profile?.is_active === false
      if (access === "active" && isSuspended) return false
      if (access === "suspended" && !isSuspended) return false

      if (!needle) return true
      return (
        teacher.display_name.toLowerCase().includes(needle) ||
        (profile?.full_name ?? "").toLowerCase().includes(needle) ||
        (profile?.email ?? "").toLowerCase().includes(needle)
      )
    })
  }, [rows, query, status, access])

  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-lg border border-border bg-surface" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-accent-danger/30 bg-accent-danger/10 p-6 text-center">
        <p className="text-sm text-accent-danger">{error}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          Try again
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by teacher name or email"
            aria-label="Search teachers by name or email"
            className="h-10 w-full rounded-lg border border-border bg-surface-elevated pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
          />
        </div>

        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {STATUS_FILTERS.map((f) => (
            <FilterChip key={f.value} label={f.label} active={status === f.value} onClick={() => setStatus(f.value)} />
          ))}
        </div>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {ACCESS_FILTERS.map((f) => (
            <FilterChip key={f.value} label={f.label} active={access === f.value} onClick={() => setAccess(f.value)} />
          ))}
        </div>

        <p className="font-mono text-xs tabular-nums text-text-muted">
          {filtered.length} of {rows.length} {rows.length === 1 ? "teacher" : "teachers"}
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-12 text-center">
          <GraduationCap className="mx-auto h-10 w-10 text-text-disabled" aria-hidden="true" />
          <p className="mt-3 text-sm text-text-primary">
            {rows.length === 0 ? "No teachers have registered yet" : "No teachers match these filters"}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            {rows.length === 0
              ? "New teacher applications will appear here automatically."
              : "Try a different search term, status, or account filter."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(({ teacher, profile }) => (
            <TeacherAdminCard
              key={teacher.id}
              teacher={teacher}
              profile={profile}
              onTeacherUpdated={onTeacherUpdated}
              onProfileUpdated={onProfileUpdated}
            />
          ))}
        </div>
      )}
    </div>
  )
}
