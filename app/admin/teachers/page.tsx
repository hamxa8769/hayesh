"use client"

import { useEffect, useState } from "react"
import { GraduationCap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PanelGroup } from "@/components/dashboard/PanelGroup"
import { Reveal } from "@/components/motion/Reveal"
import { formatDate } from "@/lib/utils/format"
import type { Teacher, ApprovalStatus } from "@/types/database"

const STATUS_BADGE: Record<ApprovalStatus, "warning" | "success" | "destructive"> = {
  pending: "warning",
  approved: "success",
  rejected: "destructive",
  suspended: "destructive",
}

export default function AdminTeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const { createClient } = await import("@/lib/supabase/client")
    const supabase = createClient()
    const { data } = await supabase.from("teachers").select("*").order("created_at", { ascending: false })
    setTeachers((data || []) as Teacher[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const approve = async (id: string) => {
    const { createClient } = await import("@/lib/supabase/client")
    const supabase = createClient()
    await supabase.from("teachers").update({ status: "approved" }).eq("id", id)
    load()
  }

  const revoke = async (id: string) => {
    const { createClient } = await import("@/lib/supabase/client")
    const supabase = createClient()
    await supabase.from("teachers").update({ status: "revoked" }).eq("id", id)
    load()
  }

  return (
    <div className="space-y-8">
      <Reveal>
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Admin / Teachers</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-text-primary sm:text-3xl">Teacher Management</h1>
      </Reveal>

      {loading ? (
        <p className="font-mono text-sm text-text-muted">Loading…</p>
      ) : teachers.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-12 text-center">
          <GraduationCap className="mx-auto h-10 w-10 text-text-disabled" />
          <p className="mt-3 text-sm text-text-muted">No teachers yet</p>
        </div>
      ) : (
        <PanelGroup>
          <div className="hidden gap-4 border-b border-border px-4 pb-3 font-mono text-xs uppercase tracking-[0.12em] text-text-muted sm:grid sm:grid-cols-[1fr_140px_160px_120px]">
            <span>Teacher</span>
            <span>Joined</span>
            <span>Status</span>
            <span className="text-right">Action</span>
          </div>
          <div className="overflow-x-auto rounded-lg border border-border bg-surface">
            <div className="min-w-[640px]">
              {teachers.map((t) => (
                <div
                  key={t.id}
                  className="grid grid-cols-[1fr_140px_160px_120px] items-center gap-4 border-b border-border px-4 py-3 transition-colors last:border-b-0 hover:bg-surface-elevated"
                >
                  <p className="truncate text-sm font-medium text-text-primary">{t.display_name || "Unnamed"}</p>
                  <p className="font-mono text-xs tabular-nums text-text-muted">{t.created_at ? formatDate(t.created_at) : "—"}</p>
                  <Badge variant={t.status ? STATUS_BADGE[t.status] : "secondary"}>{t.status || "unknown"}</Badge>
                  <div className="flex justify-end">
                    {t.status === "pending" && (
                      <Button variant="aurora" size="sm" onClick={() => approve(t.id)}>Approve</Button>
                    )}
                    {t.status === "approved" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-accent-danger/40 text-accent-danger hover:border-accent-danger/60 hover:bg-accent-danger/10"
                        onClick={() => revoke(t.id)}
                      >
                        Revoke
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </PanelGroup>
      )}
    </div>
  )
}
