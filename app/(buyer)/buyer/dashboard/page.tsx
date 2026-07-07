"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Package, MessageSquare } from "lucide-react"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { useSupabase } from "@/hooks/useSupabase"
import { formatPKR, formatDate } from "@/lib/utils/format"
import type { GigOrder, AIOrder } from "@/types/database"

export default function BuyerDashboardPage() {
  const { user } = useSupabase()
  const [gigOrders, setGigOrders] = useState<GigOrder[]>([])
  const [aiOrders, setAiOrders] = useState<AIOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const fetchData = async () => {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const [gigs, ai] = await Promise.all([
        supabase.from("gig_orders").select("*").eq("buyer_id", user.id).order("created_at", { ascending: false }).limit(10),
        supabase.from("ai_orders").select("*").eq("buyer_id", user.id).order("created_at", { ascending: false }).limit(10),
      ])
      setGigOrders((gigs.data || []) as GigOrder[])
      setAiOrders((ai.data || []) as AIOrder[])
      setLoading(false)
    }
    fetchData()
  }, [user])

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-2xl font-display font-bold text-text-primary">My Orders</h2>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2">
        <JarvisCard glow="violet" className="p-5">
          <p className="text-sm text-text-muted">Gig Orders</p>
          <p className="mt-1 font-mono text-2xl font-bold text-text-primary">{gigOrders.length}</p>
        </JarvisCard>
        <JarvisCard glow="green" className="p-5">
          <p className="text-sm text-text-muted">AI Orders</p>
          <p className="mt-1 font-mono text-2xl font-bold text-text-primary">{aiOrders.length}</p>
        </JarvisCard>
      </div>

      {loading ? (
        <p className="text-text-muted">Loading...</p>
      ) : gigOrders.length === 0 && aiOrders.length === 0 ? (
        <JarvisCard glow="none" className="p-8 text-center">
          <Package className="mx-auto h-12 w-12 text-text-disabled mb-3" />
          <p className="text-text-muted">No orders yet. Browse the marketplace!</p>
        </JarvisCard>
      ) : (
        <div className="space-y-3">
          {gigOrders.map((order) => (
            <JarvisCard key={order.id} glow="none" className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Package className="h-5 w-5 text-accent-primary" />
                  <div>
                    <p className="font-medium text-text-primary capitalize">{order.package_tier} package</p>
                    <p className="text-xs text-text-muted">{order.created_at ? formatDate(order.created_at) : "—"}</p>
                  </div>
                </div>
                <p className="font-mono text-sm font-bold text-accent-secondary">{formatPKR(order.amount_pkr || 0)}</p>
              </div>
            </JarvisCard>
          ))}
        </div>
      )}
    </div>
  )
}
