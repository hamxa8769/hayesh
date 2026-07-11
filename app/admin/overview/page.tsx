"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Users, GraduationCap, ShoppingBag, Bot, DollarSign, ArrowUpRight } from "lucide-react"
import { StatTile } from "@/components/dashboard/StatTile"
import { PanelGroup } from "@/components/dashboard/PanelGroup"
import { Badge } from "@/components/ui/badge"
import { Reveal } from "@/components/motion/Reveal"
import { formatPKR, formatDate } from "@/lib/utils/format"
import type { Transaction, PaymentStatus } from "@/types/database"

interface AdminStats {
  teachers: number
  parents: number
  sellers: number
  aiServices: number
  revenue: number
}

interface ApprovalQueueItem {
  label: string
  count: number
  href: string
}

type RecentTransaction = Pick<Transaction, "id" | "type" | "gross_amount" | "status" | "created_at">

const TX_STATUS_BADGE: Record<PaymentStatus, "warning" | "secondary" | "success" | "destructive" | "outline"> = {
  pending: "warning",
  processing: "secondary",
  completed: "success",
  failed: "destructive",
  refunded: "outline",
}

export default function AdminOverview() {
  const [stats, setStats] = useState<AdminStats>({ teachers: 0, parents: 0, sellers: 0, aiServices: 0, revenue: 0 })
  const [queue, setQueue] = useState<ApprovalQueueItem[]>([])
  const [activity, setActivity] = useState<RecentTransaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const [t, p, s, ai, tx, pendingTeachers, pendingSellers, recentTx] = await Promise.all([
        supabase.from("teachers").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "parent"),
        supabase.from("sellers").select("id", { count: "exact", head: true }),
        supabase.from("ai_services").select("id", { count: "exact", head: true }),
        supabase.from("transactions").select("gross_amount").eq("status", "completed"),
        supabase.from("teachers").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("sellers").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("transactions").select("id,type,gross_amount,status,created_at").order("created_at", { ascending: false }).limit(5),
      ])
      setStats({
        teachers: t.count || 0, parents: p.count || 0, sellers: s.count || 0,
        aiServices: ai.count || 0, revenue: (tx.data || []).reduce((sum, row) => sum + (row.gross_amount || 0), 0),
      })
      setQueue([
        { label: "Pending Teachers", count: pendingTeachers.count || 0, href: "/admin/teachers" },
        { label: "Pending Sellers", count: pendingSellers.count || 0, href: "/admin/sellers" },
      ])
      setActivity((recentTx.data || []) as RecentTransaction[])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="space-y-8">
      <Reveal>
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Admin / Overview</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-text-primary sm:text-3xl">Platform Overview</h1>
      </Reveal>

      <PanelGroup title="Platform Metrics" className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <Link href="/admin/teachers">
          <StatTile label="Teachers" value={stats.teachers} />
        </Link>
        <Link href="/admin/users">
          <StatTile label="Parents" value={stats.parents} />
        </Link>
        <Link href="/admin/sellers">
          <StatTile label="Sellers" value={stats.sellers} />
        </Link>
        <Link href="/admin/ai-services">
          <StatTile label="AI Services" value={stats.aiServices} />
        </Link>
        <Link href="/admin/payments">
          <StatTile label="Revenue" value={formatPKR(stats.revenue)} accent />
        </Link>
      </PanelGroup>

      <div className="grid gap-6 lg:grid-cols-2">
        <PanelGroup title="Approval Queue">
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            {queue.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="flex items-center justify-between border-b border-border p-4 last:border-b-0 transition-colors hover:bg-surface-elevated"
              >
                <div className="flex items-center gap-3">
                  {item.label.includes("Teacher") ? (
                    <GraduationCap className="h-4 w-4 text-text-muted" />
                  ) : (
                    <ShoppingBag className="h-4 w-4 text-text-muted" />
                  )}
                  <span className="text-sm text-text-primary">{item.label}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={item.count > 0 ? "warning" : "secondary"}>{item.count}</Badge>
                  <ArrowUpRight className="h-4 w-4 text-text-muted" />
                </div>
              </Link>
            ))}
          </div>
        </PanelGroup>

        <PanelGroup title="Recent Activity">
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            {loading ? (
              <p className="p-4 font-mono text-sm text-text-muted">Loading…</p>
            ) : activity.length === 0 ? (
              <p className="p-4 text-sm text-text-muted">No transactions yet</p>
            ) : (
              activity.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between border-b border-border p-4 last:border-b-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-text-primary capitalize">{tx.type.replace("_", " ")}</p>
                    <p className="font-mono text-xs text-text-muted">{tx.created_at ? formatDate(tx.created_at) : ""}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <Badge variant={tx.status ? TX_STATUS_BADGE[tx.status] : "secondary"}>{tx.status || "unknown"}</Badge>
                    <span className="font-mono text-sm tabular-nums text-text-primary">{formatPKR(tx.gross_amount || 0)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </PanelGroup>
      </div>
    </div>
  )
}
