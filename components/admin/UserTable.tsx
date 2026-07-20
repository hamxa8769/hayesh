"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ChevronRight, Search, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { StatusPill, type PillTone } from "@/components/teacher/StatusPill"
import { formatDate } from "@/lib/utils/format"
import { cn } from "@/lib/utils/cn"
import type { Profile, UserRole } from "@/types/database"

/**
 * Admin user directory. Purely presentational + client-side filtering — all
 * reads are done by the page, all privileged writes happen on the detail
 * screen via /api/admin/users (migration 001 makes browser-side writes to
 * role/is_active impossible anyway).
 */

export interface UserTableProps {
  users: Profile[]
  loading: boolean
  error: string | null
  onRetry: () => void
}

type RoleFilter = UserRole | "all"
type StateFilter = "all" | "active" | "restricted"

const ROLE_LABEL: Record<UserRole, string> = {
  admin: "Admin",
  teacher: "Teacher",
  parent: "Parent",
  seller: "Seller",
  buyer: "Buyer",
}

const ROLE_FILTERS: { value: RoleFilter; label: string }[] = [
  { value: "all", label: "All roles" },
  { value: "admin", label: "Admin" },
  { value: "teacher", label: "Teacher" },
  { value: "parent", label: "Parent" },
  { value: "seller", label: "Seller" },
  { value: "buyer", label: "Buyer" },
]

const STATE_FILTERS: { value: StateFilter; label: string }[] = [
  { value: "all", label: "All accounts" },
  { value: "active", label: "Active" },
  { value: "restricted", label: "Restricted" },
]

/** Semantic only — the jade/gold aurora accent is reserved and never encodes state. */
function accountTone(isActive: boolean | null): PillTone {
  return isActive === false ? "danger" : "success"
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
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

export function UserTable({ users, loading, error, onRetry }: UserTableProps) {
  const [query, setQuery] = useState("")
  const [role, setRole] = useState<RoleFilter>("all")
  const [state, setState] = useState<StateFilter>("all")

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return users.filter((u) => {
      if (role !== "all" && u.role !== role) return false
      if (state === "active" && u.is_active === false) return false
      if (state === "restricted" && u.is_active !== false) return false
      if (!needle) return true
      return (
        (u.full_name ?? "").toLowerCase().includes(needle) ||
        (u.email ?? "").toLowerCase().includes(needle)
      )
    })
  }, [users, query, role, state])

  if (loading) {
    return (
      <div className="space-y-2" aria-busy="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg border border-border bg-surface" />
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
            placeholder="Search by name or email"
            aria-label="Search users by name or email"
            className="h-10 w-full rounded-lg border border-border bg-surface-elevated pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
          />
        </div>

        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {ROLE_FILTERS.map((f) => (
            <FilterChip key={f.value} label={f.label} active={role === f.value} onClick={() => setRole(f.value)} />
          ))}
        </div>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {STATE_FILTERS.map((f) => (
            <FilterChip key={f.value} label={f.label} active={state === f.value} onClick={() => setState(f.value)} />
          ))}
        </div>

        <p className="font-mono text-xs tabular-nums text-text-muted">
          {filtered.length} of {users.length} {users.length === 1 ? "user" : "users"}
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-12 text-center">
          <Users className="mx-auto h-10 w-10 text-text-disabled" aria-hidden="true" />
          <p className="mt-3 text-sm text-text-primary">
            {users.length === 0 ? "No users have signed up yet" : "No users match these filters"}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            {users.length === 0
              ? "New registrations will appear here automatically."
              : "Try a different search term, role, or account state."}
          </p>
        </div>
      ) : (
        <>
          {/* Mobile: stacked cards — nothing overflows a 320px viewport. */}
          <div className="space-y-3 sm:hidden">
            {filtered.map((u) => (
              <Link
                key={u.id}
                href={`/admin/users/${u.id}`}
                className="block rounded-lg border border-border bg-surface p-4 transition-colors hover:border-line-strong hover:bg-surface-elevated"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text-primary">{u.full_name || "Unnamed user"}</p>
                    <p className="mt-0.5 truncate font-mono text-xs text-text-muted">{u.email}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-text-disabled" aria-hidden="true" />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <StatusPill label={ROLE_LABEL[u.role] ?? u.role} tone="neutral" />
                  <StatusPill label={u.is_active === false ? "Restricted" : "Active"} tone={accountTone(u.is_active)} />
                  {u.is_verified && <StatusPill label="Verified" tone="info" />}
                </div>
                <p className="mt-2 font-mono text-xs tabular-nums text-text-muted">
                  Joined {u.created_at ? formatDate(u.created_at) : "—"}
                </p>
              </Link>
            ))}
          </div>

          {/* Desktop: table scrolls inside its own container, never the page body. */}
          <div className="hidden overflow-x-auto rounded-lg border border-border bg-surface sm:block">
            <div className="min-w-[780px]">
              <div className="grid grid-cols-[1.6fr_110px_120px_110px_130px_40px] items-center gap-4 border-b border-border px-4 pb-3 pt-4 font-mono text-xs uppercase tracking-[0.1em] text-text-muted">
                <span>Name / Email</span>
                <span>Role</span>
                <span>Account</span>
                <span>Verified</span>
                <span>Joined</span>
                <span className="sr-only">Open</span>
              </div>
              {filtered.map((u) => (
                <Link
                  key={u.id}
                  href={`/admin/users/${u.id}`}
                  className="grid grid-cols-[1.6fr_110px_120px_110px_130px_40px] items-center gap-4 border-b border-border px-4 py-3 transition-colors last:border-b-0 hover:bg-surface-elevated"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text-primary">{u.full_name || "Unnamed user"}</p>
                    <p className="truncate font-mono text-xs text-text-muted">{u.email}</p>
                  </div>
                  <StatusPill label={ROLE_LABEL[u.role] ?? u.role} tone="neutral" />
                  <StatusPill label={u.is_active === false ? "Restricted" : "Active"} tone={accountTone(u.is_active)} />
                  {u.is_verified ? (
                    <StatusPill label="Verified" tone="info" />
                  ) : (
                    <span className="font-mono text-xs text-text-disabled">—</span>
                  )}
                  <span className="font-mono text-xs tabular-nums text-text-muted">
                    {u.created_at ? formatDate(u.created_at) : "—"}
                  </span>
                  <ChevronRight className="h-4 w-4 text-text-disabled" aria-hidden="true" />
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
