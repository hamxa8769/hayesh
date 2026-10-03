"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { AlertTriangle, ShoppingBag } from "lucide-react"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { Button } from "@/components/ui/button"
import { useSupabase } from "@/hooks/useSupabase"
import { cn } from "@/lib/utils/cn"
import { SellerOrderCard } from "@/components/orders/SellerOrderCard"
import type { GigOrder } from "@/types/database"

type Filter = "active" | "delivered" | "completed" | "other"

const FILTER_LABEL: Record<Filter, string> = {
  active: "Active",
  delivered: "Delivered",
  completed: "Completed",
  other: "Other",
}

function filterFor(status: string | null): Filter {
  if (status === "in_progress" || status === "revision_requested") return "active"
  if (status === "delivered") return "delivered"
  if (status === "completed") return "completed"
  return "other"
}

export default function OrdersPage() {
  const { user } = useSupabase()
  const [orders, setOrders] = useState<GigOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>("active")

  const load = useCallback(async () => {
    if (!user) return
    setError(null)
    try {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      // gig_orders.seller_id is sellers.id, not the auth user id.
      const sellerRes = await supabase.from("sellers").select("id").eq("user_id", user.id).maybeSingle()
      if (sellerRes.error) {
        setError(sellerRes.error.message)
        return
      }
      if (!sellerRes.data) {
        setOrders([])
        return
      }
      const { data, error: ordersError } = await supabase
        .from("gig_orders")
        .select("*")
        .eq("seller_id", sellerRes.data.id)
        .order("created_at", { ascending: false })
      if (ordersError) {
        setError(ordersError.message)
        return
      }
      setOrders((data || []) as GigOrder[])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load your orders.")
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { active: 0, delivered: 0, completed: 0, other: 0 }
    for (const o of orders) c[filterFor(o.status)] += 1
    return c
  }, [orders])

  const visible = useMemo(() => orders.filter((o) => filterFor(o.status) === filter), [orders, filter])

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="font-display text-2xl font-bold">Orders</h2>
      </motion.div>

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
      ) : orders.length === 0 ? (
        <JarvisCard glow="none" className="p-8 text-center">
          <ShoppingBag className="mx-auto mb-3 h-12 w-12 text-text-disabled" />
          <p className="text-text-muted">No orders yet</p>
        </JarvisCard>
      ) : (
        <>
          <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-border">
            {(Object.keys(FILTER_LABEL) as Filter[]).map((f) => (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={filter === f}
                onClick={() => setFilter(f)}
                className={cn(
                  "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors",
                  filter === f
                    ? "border-accent-primary text-text-primary"
                    : "border-transparent text-text-muted hover:text-text-primary"
                )}
              >
                {FILTER_LABEL[f]}
                <span className="ml-2 font-mono text-xs tabular-nums text-text-muted">{counts[f]}</span>
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <JarvisCard glow="none" className="p-8 text-center">
              <p className="text-text-muted">No {FILTER_LABEL[filter].toLowerCase()} orders</p>
            </JarvisCard>
          ) : (
            <div className="space-y-3">
              {visible.map((o) => (
                <SellerOrderCard key={o.id} order={o} onChanged={load} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
