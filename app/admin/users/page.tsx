"use client"

import { useEffect, useState } from "react"
import { Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { PanelGroup } from "@/components/dashboard/PanelGroup"
import { Reveal } from "@/components/motion/Reveal"
import { formatDate } from "@/lib/utils/format"
import type { Profile, UserRole } from "@/types/database"

const ROLE_LABEL: Record<UserRole, string> = {
  admin: "Admin",
  teacher: "Teacher",
  parent: "Parent",
  seller: "Seller",
  buyer: "Buyer",
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false })
      setUsers((data || []) as Profile[])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="space-y-8">
      <Reveal>
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Admin / Users</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-text-primary sm:text-3xl">All Users</h1>
      </Reveal>

      {loading ? (
        <p className="font-mono text-sm text-text-muted">Loading…</p>
      ) : users.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-12 text-center">
          <Users className="mx-auto h-10 w-10 text-text-disabled" />
          <p className="mt-3 text-sm text-text-muted">No users yet</p>
        </div>
      ) : (
        <PanelGroup>
          <div className="hidden gap-4 border-b border-border px-4 pb-3 font-mono text-xs uppercase tracking-[0.12em] text-text-muted sm:grid sm:grid-cols-[1fr_160px_100px]">
            <span>Name / Email</span>
            <span>Joined</span>
            <span>Role</span>
          </div>
          <div className="overflow-x-auto rounded-lg border border-border bg-surface">
            <div className="min-w-[560px]">
              {users.map((u) => (
                <div
                  key={u.id}
                  className="grid grid-cols-[1fr_160px_100px] items-center gap-4 border-b border-border px-4 py-3 transition-colors last:border-b-0 hover:bg-surface-elevated"
                >
                  <p className="truncate text-sm font-medium text-text-primary">{u.full_name || u.email || "Unknown"}</p>
                  <p className="font-mono text-xs tabular-nums text-text-muted">{u.created_at ? formatDate(u.created_at) : "—"}</p>
                  <Badge variant="outline">{ROLE_LABEL[u.role] || u.role}</Badge>
                </div>
              ))}
            </div>
          </div>
        </PanelGroup>
      )}
    </div>
  )
}
