"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { RefreshCw } from "lucide-react"
import { StatTile } from "@/components/dashboard/StatTile"
import { PanelGroup } from "@/components/dashboard/PanelGroup"
import { Reveal } from "@/components/motion/Reveal"
import { UserTable } from "@/components/admin/UserTable"
import { cn } from "@/lib/utils/cn"
import type { Profile } from "@/types/database"

export default function AdminUsersPage() {
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const { data, error: fetchError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false })

      if (fetchError) throw new Error(fetchError.message)
      setUsers((data ?? []) as Profile[])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load users")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const stats = useMemo(() => {
    let restricted = 0
    let teachers = 0
    let admins = 0
    for (const u of users) {
      if (u.is_active === false) restricted += 1
      if (u.role === "teacher") teachers += 1
      if (u.role === "admin") admins += 1
    }
    return { total: users.length, restricted, teachers, admins }
  }, [users])

  return (
    <div className="space-y-8">
      <Reveal>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Admin / Users</p>
            <h1 className="mt-1 font-display text-2xl font-semibold text-text-primary sm:text-3xl">User Management</h1>
            <p className="mt-2 max-w-prose text-sm text-text-muted">
              Every account on the platform. Open a user to view their full record, edit their details, change their
              role, or restrict their account.
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 font-mono text-xs text-text-muted transition-colors hover:bg-surface-elevated hover:text-text-primary"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden="true" />
            Refresh
          </button>
        </div>
      </Reveal>

      <PanelGroup className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Total Users" value={stats.total} accent />
        <StatTile label="Admins" value={stats.admins} />
        <StatTile label="Teachers" value={stats.teachers} />
        <StatTile label="Restricted" value={stats.restricted} />
      </PanelGroup>

      <UserTable users={users} loading={loading} error={error} onRetry={load} />
    </div>
  )
}
