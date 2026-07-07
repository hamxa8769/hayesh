"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Package, Clock, CheckCircle } from "lucide-react"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { Badge } from "@/components/ui/badge"
import { useSupabase } from "@/hooks/useSupabase"
import { formatPKR, formatDate } from "@/lib/utils/format"
import type { GigOrder } from "@/types/database"

const statusColors: Record<string, "default" | "success" | "destructive" | "warning" | "cyan"> = {
  pending: "warning",
  in_progress: "default",
  delivered: "cyan",
  completed: "success",
  cancelled: "destructive",
}

export default function OrdersPage() {
  const { user } = useSupabase()
  const [orders, setOrders] = useState<GigOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const fetchOrders = async () => {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const { data: seller } = await supabase.from("sellers").select("id").eq("user_id", user.id).single()
      if (!seller) { setLoading(false); return }
      const { data } = await supabase.from("gig_orders").select("*").eq("seller_id", seller.id).order("created_at", { ascending: false })
      setOrders((data || []) as GigOrder[])
      setLoading(false)
    }
    fetchOrders()
  }, [user])

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-2xl font-display font-bold text-text-primary">Orders</h2>
      </motion.div>

      {loading ? (
        <p className="text-text-muted">Loading orders...</p>
      ) : orders.length === 0 ? (
        <JarvisCard glow="none" className="p-8 text-center">
          <Package className="mx-auto h-12 w-12 text-text-disabled mb-3" />
          <p className="text-text-muted">No orders yet</p>
        </JarvisCard>
      ) : (
        <div className="space-y-3">
          {orders.map((order, i) => (
            <motion.div key={order.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <JarvisCard glow="none" className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Package className="h-5 w-5 text-accent-primary" />
                    <div>
                      <p className="font-medium text-text-primary capitalize">{order.package_tier} package</p>
                      <p className="text-xs text-text-muted">{order.created_at ? formatDate(order.created_at) : "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={statusColors[order.status || "pending"]}>{order.status}</Badge>
                    <p className="font-mono text-sm font-bold text-accent-secondary">{formatPKR(order.amount_pkr || 0)}</p>
                  </div>
                </div>
              </JarvisCard>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
