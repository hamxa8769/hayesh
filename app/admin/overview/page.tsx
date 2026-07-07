"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Users, GraduationCap, ShoppingBag, Bot, DollarSign } from "lucide-react"
import { JarvisCard } from "@/components/ui/jarvis-card"

export default function AdminOverview() {
  const [stats, setStats] = useState({ teachers: 0, parents: 0, sellers: 0, aiServices: 0, revenue: 0 })

  useEffect(() => {
    const load = async () => {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const [t, p, s, ai, tx] = await Promise.all([
        supabase.from("teachers").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "parent"),
        supabase.from("sellers").select("id", { count: "exact", head: true }),
        supabase.from("ai_services").select("id", { count: "exact", head: true }),
        supabase.from("transactions").select("gross_amount").eq("status", "completed"),
      ])
      setStats({
        teachers: t.count || 0, parents: p.count || 0, sellers: s.count || 0,
        aiServices: ai.count || 0, revenue: (tx.data || []).reduce((s, t) => s + (t.gross_amount || 0), 0),
      })
    }
    load()
  }, [])

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="font-display text-2xl font-bold">Admin Overview</h2>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {[
          { label: "Teachers", value: stats.teachers, icon: GraduationCap, href: "/admin/teachers", color: "cyan" as const },
          { label: "Parents", value: stats.parents, icon: Users, href: "/admin/users", color: "none" as const },
          { label: "Sellers", value: stats.sellers, icon: ShoppingBag, href: "/admin/sellers", color: "green" as const },
          { label: "AI Services", value: stats.aiServices, icon: Bot, href: "/admin/ai-services", color: "violet" as const },
          { label: "Revenue", value: `₨${(stats.revenue / 1000).toFixed(0)}k`, icon: DollarSign, href: "/admin/payments", color: "green" as const },
        ].map((c, i) => (
          <motion.div key={c.label} custom={i} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Link href={c.href}>
              <JarvisCard glow={c.color} className="p-5 cursor-pointer hover:glow-green transition-all">
                <c.icon className="h-6 w-6 text-text-muted mb-2" />
                <p className="text-sm text-text-muted">{c.label}</p>
                <p className="mt-1 font-mono text-xl font-bold text-text-primary">{c.value}</p>
              </JarvisCard>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
