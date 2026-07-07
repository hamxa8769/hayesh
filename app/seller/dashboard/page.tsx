"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Package, ShoppingBag, Wallet, Plus } from "lucide-react"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { JarvisButton } from "@/components/ui/jarvis-button"
import { useSupabase } from "@/hooks/useSupabase"
import { formatPKR } from "@/lib/utils/format"

export default function SellerDashboard() {
  const { user } = useSupabase()
  const [stats, setStats] = useState({ gigs: 0, orders: 0, balance: 0 })

  useEffect(() => {
    if (!user) return
    const load = async () => {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const [gigs, orders, tx] = await Promise.all([
        supabase.from("gigs").select("id", { count: "exact", head: true }).eq("seller_id", user.id),
        supabase.from("gig_orders").select("id", { count: "exact", head: true }).eq("seller_id", user.id),
        supabase.from("transactions").select("net_amount").eq("payee_id", user.id).eq("status", "completed"),
      ])
      setStats({ gigs: gigs.count || 0, orders: orders.count || 0, balance: (tx.data || []).reduce((s, t) => s + (t.net_amount || 0), 0) })
    }
    load()
  }, [user])

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="font-display text-2xl font-bold">Seller Dashboard</h2>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Gigs", value: stats.gigs, icon: Package, color: "text-accent-success", href: "/seller/gigs" },
          { label: "Orders", value: stats.orders, icon: ShoppingBag, color: "text-accent-primary", href: "/seller/orders" },
          { label: "Balance", value: formatPKR(stats.balance), icon: Wallet, color: "text-accent-success", href: "/seller/earnings" },
        ].map((c, i) => (
          <motion.div key={c.label} custom={i} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <Link href={c.href}>
              <JarvisCard glow="green" className="p-5 cursor-pointer hover:glow-green transition-all">
                <div className="flex items-center justify-between">
                  <div><p className="text-sm text-text-muted">{c.label}</p><p className="mt-1 font-mono text-2xl font-bold text-text-primary">{c.value}</p></div>
                  <c.icon className={`h-8 w-8 ${c.color} opacity-50`} />
                </div>
              </JarvisCard>
            </Link>
          </motion.div>
        ))}
      </div>

      <JarvisCard glow="none" className="p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-bold">Quick Actions</h3>
          <Link href="/seller/gigs/new"><JarvisButton variant="primary" size="sm"><Plus className="h-3.5 w-3.5 mr-1" /> New Gig</JarvisButton></Link>
        </div>
      </JarvisCard>
    </div>
  )
}
