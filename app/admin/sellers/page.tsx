"use client"

import { useEffect, useState } from "react"
import { ShoppingBag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PanelGroup } from "@/components/dashboard/PanelGroup"
import { Reveal } from "@/components/motion/Reveal"
import { formatDate } from "@/lib/utils/format"
import type { Seller, Gig, ApprovalStatus } from "@/types/database"

const STATUS_BADGE: Record<ApprovalStatus, "warning" | "success" | "destructive"> = {
  pending: "warning",
  approved: "success",
  rejected: "destructive",
  suspended: "destructive",
}

export default function AdminSellersPage() {
  const [sellers, setSellers] = useState<Seller[]>([])
  const [gigs, setGigs] = useState<Gig[]>([])
  const [gigError, setGigError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const { createClient } = await import("@/lib/supabase/client")
    const supabase = createClient()
    const [sellerRes, gigRes] = await Promise.all([
      supabase.from("sellers").select("*").order("created_at", { ascending: false }),
      supabase.from("gigs").select("*").order("created_at", { ascending: false }),
    ])
    setSellers((sellerRes.data || []) as Seller[])
    setGigs((gigRes.data || []) as Gig[])
    setLoading(false)
  }

  const decideGig = async (gigId: string, status: "approved" | "rejected") => {
    setGigError(null)
    const res = await fetch("/api/admin/gigs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gig_id: gigId, status }),
    })
    if (!res.ok) {
      const json = (await res.json().catch(() => null)) as { error?: string } | null
      setGigError(json?.error ?? "Could not update the gig")
      return
    }
    load()
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

      <section aria-label="Gig approvals" className="space-y-3">
        <h2 className="font-display text-xl font-semibold text-text-primary">Gig approvals</h2>
        {gigError && <p className="text-sm text-accent-danger">{gigError}</p>}
        {!loading && gigs.length === 0 ? (
          <p className="text-sm text-text-muted">No gigs yet</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-surface">
            <div className="min-w-[640px]">
              {gigs.map((g) => (
                <div
                  key={g.id}
                  data-testid="admin-gig-row"
                  className="grid grid-cols-[1fr_140px_200px] items-center gap-4 border-b border-border px-4 py-3 last:border-b-0"
                >
                  <p className="truncate text-sm font-medium text-text-primary">{g.title}</p>
                  <Badge variant={g.status ? STATUS_BADGE[g.status] : "secondary"}>{g.status || "unknown"}</Badge>
                  <div className="flex justify-end gap-2">
                    {g.status === "pending" && (
                      <>
                        <Button variant="aurora" size="sm" onClick={() => decideGig(g.id, "approved")}>Approve gig</Button>
                        <Button variant="outline" size="sm" onClick={() => decideGig(g.id, "rejected")}>Reject gig</Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
