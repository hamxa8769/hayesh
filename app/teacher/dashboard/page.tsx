"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Calendar, Users, Wallet, UserCog } from "lucide-react"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { useSupabase } from "@/hooks/useSupabase"
import { formatPKR } from "@/lib/utils/format"

export default function TeacherDashboard() {
  const { user } = useSupabase()
  const [stats, setStats] = useState({ sessions: 0, students: 0, balance: 0 })

  useEffect(() => {
    if (!user) return
    const load = async () => {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const [sessions, students, tx] = await Promise.all([
        supabase.from("sessions").select("id", { count: "exact", head: true }).eq("teacher_id", user.id),
        supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("teacher_id", user.id).eq("status", "active"),
        supabase.from("transactions").select("net_amount").eq("payee_id", user.id).eq("status", "completed"),
      ])
      setStats({
        sessions: sessions.count || 0,
        students: students.count || 0,
        balance: (tx.data || []).reduce((s, t) => s + (t.net_amount || 0), 0),
      })
    }
    load()
  }, [user])

  const cards = [
    { label: "Sessions", value: stats.sessions, icon: Calendar, color: "text-accent-primary", href: "/teacher/sessions" },
    { label: "Active Students", value: stats.students, icon: Users, color: "text-accent-secondary", href: "/teacher/students" },
    { label: "Balance", value: formatPKR(stats.balance), icon: Wallet, color: "text-accent-success", href: "/teacher/earnings" },
  ]

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="font-display text-2xl font-bold">Welcome back!</h2>
        <p className="text-text-muted">Here&apos;s your teaching overview.</p>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((c, i) => (
          <motion.div key={c.label} custom={i} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <Link href={c.href}>
              <JarvisCard glow="violet" className="p-5 hover:glow-violet transition-all cursor-pointer">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-text-muted">{c.label}</p>
                    <p className="mt-1 font-mono text-2xl font-bold text-text-primary">{c.value}</p>
                  </div>
                  <c.icon className={`h-8 w-8 ${c.color} opacity-50`} />
                </div>
              </JarvisCard>
            </Link>
          </motion.div>
        ))}
      </div>

      <JarvisCard glow="none" className="p-6">
        <h3 className="mb-4 font-display text-lg font-bold">Quick Actions</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { href: "/teacher/sessions", label: "View Sessions", icon: Calendar },
            { href: "/teacher/profile", label: "Edit Profile", icon: UserCog },
            { href: "/teacher/earnings", label: "Earnings", icon: Wallet },
            { href: "/teacher/students", label: "Students", icon: Users },
          ].map((a) => (
            <Link key={a.href} href={a.href}
              className="flex items-center gap-3 rounded-lg border border-border p-4 hover:bg-surface-elevated transition-colors">
              <a.icon className="h-5 w-5 text-accent-primary" />
              <span className="text-sm text-text-primary">{a.label}</span>
            </Link>
          ))}
        </div>
      </JarvisCard>
    </div>
  )
}
