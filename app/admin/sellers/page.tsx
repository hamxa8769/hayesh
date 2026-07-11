"use client"

import { useEffect, useState } from "react"
import { ShoppingBag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PanelGroup } from "@/components/dashboard/PanelGroup"
import { Reveal } from "@/components/motion/Reveal"
import { formatDate } from "@/lib/utils/format"
import type { Seller, ApprovalStatus } from "@/types/database"

const STATUS_BADGE: Record<ApprovalStatus, "warning" | "success" | "destructive"> = {
  pending: "warning",
  approved: "success",
  rejected: "destructive",
  suspended: "destructive",
}

export default function AdminSellersPage() {
  const [sellers, setSellers] = useState<Seller[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const { createClient } = await import("@/lib/supabase/client")
    const supabase = createClient()
    const { data } = await supabase.from("sellers").select("*").order("created_at", { ascending: false })
    setSellers((data || []) as Seller[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const approve = async (id: string) => {
    const { createClient } = await import("@/lib/supabase/client")
    const supabase = createClient()
    await supabase.from("sellers").update({ status: "approved" }).eq("id", id)
    load()
  }

  return (
    <div className="space-y-8">
      <Reveal>
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Admin / Sellers</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-text-primary sm:text-3xl">Seller Management</h1>
      </Reveal>

      {loading ? (
        <p className="font-mono text-sm text-text-muted">Loading…</p>
      ) : sellers.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-12 text-center">
          <ShoppingBag className="mx-auto h-10 w-10 text-text-disabled" />
          <p className="mt-3 text-sm text-text-muted">No sellers yet</p>
        </div>
      ) : (
        <PanelGroup>
          <div className="hidden gap-4 border-b border-border px-4 pb-3 font-mono text-xs uppercase tracking-[0.12em] text-text-muted sm:grid sm:grid-cols-[1fr_140px_160px_120px]">
            <span>Seller</span>
            <span>Joined</span>
            <span>Status</span>
            <span className="text-right">Action</span>
          </div>
          <div className="overflow-x-auto rounded-lg border border-border bg-surface">
            <div className="min-w-[640px]">
              {sellers.map((s) => (
                <div
                  key={s.id}
                  className="grid grid-cols-[1fr_140px_160px_120px] items-center gap-4 border-b border-border px-4 py-3 transition-colors last:border-b-0 hover:bg-surface-elevated"
                >
                  <p className="truncate text-sm font-medium text-text-primary">{s.display_name || "Unnamed"}</p>
                  <p className="font-mono text-xs tabular-nums text-text-muted">{s.created_at ? formatDate(s.created_at) : "—"}</p>
                  <Badge variant={s.status ? STATUS_BADGE[s.status] : "secondary"}>{s.status || "unknown"}</Badge>
                  <div className="flex justify-end">
                    {s.status === "pending" && (
                      <Button variant="aurora" size="sm" onClick={() => approve(s.id)}>Approve</Button>
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
