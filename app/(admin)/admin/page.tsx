"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Users, GraduationCap, ShoppingBag, Wallet, AlertTriangle } from "lucide-react"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { createClient } from "@/lib/supabase/client"
import { formatPKR } from "@/lib/utils/format"

export default function AdminOverviewPage() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    teachers: 0,
    sellers: 0,
    pendingApprovals: 0,
    totalRevenue: 0,
  })

  useEffect(() => {
    const fetchStats = async () => {
      const supabase = createClient()
      const [users, teachers, sellers, pending, revenue] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("teachers").select("id", { count: "exact", head: true }),
        supabase.from("sellers").select("id", { count: "exact", head: true }),
        supabase.from("teachers").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("transactions").select("gross_amount").eq("status", "completed"),
      ])

      setStats({
        totalUsers: users.count || 0,
        teachers: teachers.count || 0,
        sellers: sellers.count || 0,
        pendingApprovals: (pending.count || 0) + 0,
        totalRevenue: (revenue.data || []).reduce((sum, t) => sum + (t.gross_amount || 0), 0),
      })
    }
    fetchStats()
  }, [])

  const cards = [
    { label: "Total Users", value: stats.totalUsers, icon: Users, color: "text-accent-primary" },
    { label: "Teachers", value: stats.teachers, icon: GraduationCap, color: "text-accent-secondary" },
    { label: "Sellers", value: stats.sellers, icon: ShoppingBag, color: "text-accent-success" },
    { label: "Pending Approvals", value: stats.pendingApprovals, icon: AlertTriangle, color: "text-accent-warning" },
    { label: "Total Revenue", value: formatPKR(stats.totalRevenue), icon: Wallet, color: "text-accent-success" },
  ]

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-2xl font-display font-bold text-text-primary">Admin Overview</h2>
        <p className="text-text-muted">Platform-wide metrics and quick actions.</p>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((card, i) => (
          <motion.div key={card.label} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <JarvisCard glow="violet" className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-text-muted">{card.label}</p>
                  <p className="mt-1 font-mono text-2xl font-bold text-text-primary">{card.value}</p>
                </div>
                <card.icon className={`h-8 w-8 ${card.color} opacity-50`} />
              </div>
            </JarvisCard>
          </motion.div>
        ))}
      </div>

      <JarvisCard glow="none" className="p-6">
        <h3 className="font-display text-lg font-semibold text-text-primary mb-4">Quick Actions</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { href: "/admin/teachers", label: "Approve Teachers", icon: GraduationCap },
            { href: "/admin/sellers", label: "Approve Sellers", icon: ShoppingBag },
            { href: "/admin/users", label: "Manage Users", icon: Users },
            { href: "/admin/payments", label: "View Payments", icon: Wallet },
          ].map((action) => (
            <a key={action.href} href={action.href} className="flex items-center gap-3 rounded-lg border border-border p-4 hover:bg-surface-elevated transition-colors">
              <action.icon className="h-5 w-5 text-accent-primary" />
              <span className="text-sm text-text-primary">{action.label}</span>
            </a>
          ))}
        </div>
      </JarvisCard>
    </div>
  )
}
