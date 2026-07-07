"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Search, Calendar, CreditCard, Users } from "lucide-react"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { useSupabase } from "@/hooks/useSupabase"
import { formatPKR, formatDate } from "@/lib/utils/format"
import type { Subscription } from "@/types/database"

export default function ParentDashboardPage() {
  const { user } = useSupabase()
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const fetchData = async () => {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const { data } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("parent_id", user.id)
        .eq("status", "active")
      setSubscriptions((data || []) as Subscription[])
      setLoading(false)
    }
    fetchData()
  }, [user])

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-2xl font-display font-bold text-text-primary">Parent Dashboard</h2>
        <p className="text-text-muted">Track your children&apos;s learning journey.</p>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <JarvisCard glow="cyan" className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-text-muted">Active Subscriptions</p>
                <p className="mt-1 font-mono text-2xl font-bold text-text-primary">{subscriptions.length}</p>
              </div>
              <CreditCard className="h-8 w-8 text-accent-secondary opacity-50" />
            </div>
          </JarvisCard>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <JarvisCard glow="none" className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-text-muted">Children</p>
                <p className="mt-1 font-mono text-2xl font-bold text-text-primary">{new Set(subscriptions.map(s => s.child_name)).size}</p>
              </div>
              <Users className="h-8 w-8 text-text-disabled" />
            </div>
          </JarvisCard>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <JarvisCard glow="none" className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-text-muted">This Month</p>
                <p className="mt-1 font-mono text-2xl font-bold text-text-primary">
                  {formatPKR(subscriptions.reduce((sum, s) => sum + (s.amount_pkr || 0), 0))}
                </p>
              </div>
              <Calendar className="h-8 w-8 text-text-disabled" />
            </div>
          </JarvisCard>
        </motion.div>
      </div>

      <JarvisCard glow="none" className="p-6">
        <h3 className="font-display text-lg font-semibold text-text-primary mb-4">Quick Actions</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <a href="/parent/find-teachers" className="flex items-center gap-3 rounded-lg border border-border p-4 hover:bg-surface-elevated transition-colors">
            <Search className="h-5 w-5 text-accent-primary" />
            <span className="text-sm text-text-primary">Find Teachers</span>
          </a>
          <a href="/parent/progress" className="flex items-center gap-3 rounded-lg border border-border p-4 hover:bg-surface-elevated transition-colors">
            <Users className="h-5 w-5 text-accent-secondary" />
            <span className="text-sm text-text-primary">View Progress</span>
          </a>
        </div>
      </JarvisCard>

      {subscriptions.length > 0 && (
        <JarvisCard glow="none" className="p-6">
          <h3 className="font-display text-lg font-semibold text-text-primary mb-4">Active Subscriptions</h3>
          <div className="space-y-2">
            {subscriptions.map((sub) => (
              <div key={sub.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="font-medium text-text-primary">{sub.child_name} — {sub.subject}</p>
                  <p className="text-xs text-text-muted capitalize">{sub.tier} tier</p>
                </div>
                <p className="font-mono text-sm font-bold text-accent-secondary">{formatPKR(sub.amount_pkr || 0)}/mo</p>
              </div>
            ))}
          </div>
        </JarvisCard>
      )}
    </div>
  )
}
