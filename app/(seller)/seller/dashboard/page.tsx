"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Package, ShoppingCart, Wallet, TrendingUp, Plus } from "lucide-react"
import Link from "next/link"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { JarvisButton } from "@/components/ui/jarvis-button"
import { useSupabase } from "@/hooks/useSupabase"
import { formatPKR } from "@/lib/utils/format"
import type { Gig, GigOrder } from "@/types/database"

export default function SellerDashboardPage() {
  const { user } = useSupabase()
  const [gigs, setGigs] = useState<Gig[]>([])
  const [orders, setOrders] = useState<GigOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const fetchData = async () => {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()

      const { data: seller } = await supabase
        .from("sellers")
        .select("id")
        .eq("user_id", user.id)
        .single()

      if (!seller) { setLoading(false); return }

      const [gigsRes, ordersRes] = await Promise.all([
        supabase.from("gigs").select("*").eq("seller_id", seller.id),
        supabase.from("gig_orders").select("*").eq("seller_id", seller.id).order("created_at", { ascending: false }).limit(10),
      ])

      setGigs((gigsRes.data || []) as Gig[])
      setOrders((ordersRes.data || []) as GigOrder[])
      setLoading(false)
    }
    fetchData()
  }, [user])

  const activeGigs = gigs.filter(g => g.status === "approved").length
  const pendingOrders = orders.filter(o => o.status === "pending" || o.status === "in_progress").length
  const totalEarnings = orders.filter(o => o.status === "completed").reduce((sum, o) => sum + (o.seller_payout_amt || 0), 0)

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-text-primary">Seller Dashboard</h2>
          <p className="text-text-muted">Manage your gigs and orders.</p>
        </div>
        <Link href="/seller/gigs/new">
          <JarvisButton variant="primary" size="sm">
            <Plus className="h-4 w-4" /> New Gig
          </JarvisButton>
        </Link>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Active Gigs", value: activeGigs, icon: Package, color: "text-accent-success" },
          { label: "Pending Orders", value: pendingOrders, icon: ShoppingCart, color: "text-accent-warning" },
          { label: "Total Gigs", value: gigs.length, icon: Package, color: "text-accent-primary" },
          { label: "Earnings", value: formatPKR(totalEarnings), icon: Wallet, color: "text-accent-secondary" },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <JarvisCard glow="violet" className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-text-muted">{stat.label}</p>
                  <p className="mt-1 font-mono text-2xl font-bold text-text-primary">{stat.value}</p>
                </div>
                <stat.icon className={`h-8 w-8 ${stat.color} opacity-50`} />
              </div>
            </JarvisCard>
          </motion.div>
        ))}
      </div>

      <JarvisCard glow="none" className="p-6">
        <h3 className="font-display text-lg font-semibold text-text-primary mb-4">Recent Orders</h3>
        {loading ? (
          <p className="text-text-muted">Loading...</p>
        ) : orders.length === 0 ? (
          <p className="text-text-muted text-center py-4">No orders yet</p>
        ) : (
          <div className="space-y-2">
            {orders.slice(0, 5).map((order) => (
              <div key={order.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium text-text-primary">{order.package_tier} package</p>
                  <p className="text-xs text-text-muted">{order.status}</p>
                </div>
                <p className="font-mono text-sm font-bold text-accent-secondary">{formatPKR(order.amount_pkr || 0)}</p>
              </div>
            ))}
          </div>
        )}
      </JarvisCard>
    </div>
  )
}
