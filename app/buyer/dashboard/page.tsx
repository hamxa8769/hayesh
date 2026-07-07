"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { ShoppingBag, MessageSquare } from "lucide-react"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { useSupabase } from "@/hooks/useSupabase"
import { formatPKR } from "@/lib/utils/format"

export default function BuyerDashboard() {
  const { user } = useSupabase()
  const [stats, setStats] = useState({ orders: 0, spent: 0 })

  useEffect(() => {
    if (!user) return
    const load = async () => {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const [orders, tx] = await Promise.all([
        supabase.from("gig_orders").select("id", { count: "exact", head: true }).eq("buyer_id", user.id),
        supabase.from("transactions").select("gross_amount").eq("payer_id", user.id).eq("status", "completed"),
      ])
      setStats({ orders: orders.count || 0, spent: (tx.data || []).reduce((s, t) => s + (t.gross_amount || 0), 0) })
    }
    load()
  }, [user])

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="font-display text-2xl font-bold">Buyer Dashboard</h2>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2">
        <JarvisCard glow="cyan" className="p-5">
          <p className="text-sm text-text-muted">Orders</p>
          <p className="mt-1 font-mono text-2xl font-bold text-text-primary">{stats.orders}</p>
        </JarvisCard>
        <JarvisCard glow="none" className="p-5">
          <p className="text-sm text-text-muted">Total Spent</p>
          <p className="mt-1 font-mono text-2xl font-bold text-text-primary">{formatPKR(stats.spent)}</p>
        </JarvisCard>
      </div>

      <JarvisCard glow="none" className="p-6">
        <h3 className="mb-4 font-display text-lg font-bold">Quick Actions</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/marketplace" className="flex items-center gap-3 rounded-lg border border-border p-4 hover:bg-surface-elevated transition-colors">
            <ShoppingBag className="h-5 w-5 text-accent-success" /><span className="text-sm text-text-primary">Browse Marketplace</span>
          </Link>
          <Link href="/ai-services" className="flex items-center gap-3 rounded-lg border border-border p-4 hover:bg-surface-elevated transition-colors">
            <MessageSquare className="h-5 w-5 text-accent-primary" /><span className="text-sm text-text-primary">AI Services</span>
          </Link>
        </div>
      </JarvisCard>
    </div>
  )
}
