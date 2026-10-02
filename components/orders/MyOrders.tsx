"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { AlertTriangle, Bot, ShoppingBag } from "lucide-react"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { Button } from "@/components/ui/button"
import { useSupabase } from "@/hooks/useSupabase"
import { cn } from "@/lib/utils/cn"
import { GigOrderCard } from "@/components/orders/GigOrderCard"
import { AIOrderCard } from "@/components/orders/AIOrderCard"
import {
  indexTransactions,
  ORDER_TRANSACTION_COLUMNS,
  type OrderTransaction,
} from "@/components/orders/order-status"
import type { AIOrder, GigOrder } from "@/types/database"

type Tab = "service" | "ai"

/** "My Orders" for any signed-in user — rendered by /orders (all roles) and /buyer/orders. */
export function MyOrders() {
  const { user } = useSupabase()
  const [gigOrders, setGigOrders] = useState<GigOrder[]>([])
  const [aiOrders, setAiOrders] = useState<AIOrder[]>([])
  const [aiTitles, setAiTitles] = useState<Record<string, string>>({})
  const [transactions, setTransactions] = useState<OrderTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>("service")

  const load = useCallback(async () => {
    if (!user) return
    setError(null)
    try {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const [gigRes, aiRes, txRes] = await Promise.all([
        supabase.from("gig_orders").select("*").eq("buyer_id", user.id).order("created_at", { ascending: false }),
        supabase.from("ai_orders").select("*").eq("buyer_id", user.id).order("created_at", { ascending: false }),
        supabase
          .from("transactions")
          .select(ORDER_TRANSACTION_COLUMNS)
          .eq("payer_id", user.id)
          .order("created_at", { ascending: false }),
      ])
      const firstError = gigRes.error ?? aiRes.error ?? txRes.error
      if (firstError) {
        setError(firstError.message)
        return
      }
      const ai = (aiRes.data || []) as AIOrder[]
      let titles: Record<string, string> = {}
      const serviceIds = Array.from(new Set(ai.map((o) => o.service_id)))
      if (serviceIds.length > 0) {
        // Never select system_prompt — only id + title.
        const svcRes = await supabase.from("ai_services").select("id, title").in("id", serviceIds)
        titles = Object.fromEntries(((svcRes.data || []) as { id: string; title: string }[]).map((s) => [s.id, s.title]))
      }
      setGigOrders((gigRes.data || []) as GigOrder[])
      setAiOrders(ai)
      setAiTitles(titles)
      setTransactions((txRes.data || []) as OrderTransaction[])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load your orders.")
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  const { byGig, byAI } = useMemo(() => indexTransactions(transactions), [transactions])

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "service", label: "Service orders", count: gigOrders.length },
    { id: "ai", label: "HayeshAI Studio", count: aiOrders.length },
  ]

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="font-display text-2xl font-bold">My Orders</h2>
      </motion.div>

      <div role="tablist" className="flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm transition-colors",
              tab === t.id
                ? "border-accent-primary text-text-primary"
                : "border-transparent text-text-muted hover:text-text-primary"
            )}
          >
            {t.label}
            <span className="ml-2 font-mono text-xs tabular-nums text-text-muted">{t.count}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-lg border border-border bg-surface-elevated/60" />
          ))}
        </div>
      ) : error ? (
        <JarvisCard glow="none" className="p-8 text-center">
          <AlertTriangle className="mx-auto mb-3 h-12 w-12 text-accent-danger" />
          <p className="text-text-primary">Couldn&apos;t load your orders</p>
          <p className="mt-1 text-sm text-text-muted">{error}</p>
          <Button type="button" variant="secondary" className="mt-4" onClick={load}>
            Try Again
          </Button>
        </JarvisCard>
      ) : tab === "service" ? (
        gigOrders.length === 0 ? (
          <JarvisCard glow="none" className="p-8 text-center">
            <ShoppingBag className="mx-auto mb-3 h-12 w-12 text-text-disabled" />
            <p className="text-text-muted">No service orders yet</p>
          </JarvisCard>
        ) : (
          <div className="space-y-3">
            {gigOrders.map((o) => (
              <GigOrderCard key={o.id} order={o} transaction={byGig[o.id]} onChanged={load} />
            ))}
          </div>
        )
      ) : aiOrders.length === 0 ? (
        <JarvisCard glow="none" className="p-8 text-center">
          <Bot className="mx-auto mb-3 h-12 w-12 text-text-disabled" />
          <p className="text-text-muted">No HayeshAI Studio orders yet</p>
        </JarvisCard>
      ) : (
        <div className="space-y-3">
          {aiOrders.map((o) => (
            <AIOrderCard
              key={o.id}
              order={o}
              title={aiTitles[o.service_id] ?? "AI service"}
              transaction={byAI[o.id]}
              onChanged={load}
            />
          ))}
        </div>
      )}
    </div>
  )
}
