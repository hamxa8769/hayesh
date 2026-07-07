"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Search, CreditCard } from "lucide-react"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { useSupabase } from "@/hooks/useSupabase"
import { formatPKR, formatDate } from "@/lib/utils/format"
import type { Subscription } from "@/types/database"

export default function ParentDashboard() {
  const { user } = useSupabase()
  const [subs, setSubs] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const load = async () => {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const { data } = await supabase.from("subscriptions").select("*").eq("parent_id", user.id).order("created_at", { ascending: false })
      setSubs((data || []) as Subscription[])
      setLoading(false)
    }
    load()
  }, [user])

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="font-display text-2xl font-bold">Parent Dashboard</h2>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-3">
        <JarvisCard glow="cyan" className="p-5">
          <p className="text-sm text-text-muted">Active Subscriptions</p>
          <p className="mt-1 font-mono text-2xl font-bold text-text-primary">{subs.filter((s) => s.status === "active").length}</p>
        </JarvisCard>
        <JarvisCard glow="none" className="p-5">
          <p className="text-sm text-text-muted">Total Spent</p>
          <p className="mt-1 font-mono text-2xl font-bold text-text-primary">{formatPKR(subs.reduce((s, sub) => s + (sub.amount_pkr || 0), 0))}</p>
        </JarvisCard>
        <JarvisCard glow="none" className="p-5">
          <p className="text-sm text-text-muted">Children</p>
          <p className="mt-1 font-mono text-2xl font-bold text-text-primary">{new Set(subs.map((s) => s.child_name).filter(Boolean)).size}</p>
        </JarvisCard>
      </div>

      <JarvisCard glow="none" className="p-6">
        <h3 className="mb-4 font-display text-lg font-bold">Quick Actions</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/parent/find-teachers" className="flex items-center gap-3 rounded-lg border border-border p-4 hover:bg-surface-elevated transition-colors">
            <Search className="h-5 w-5 text-accent-secondary" /><span className="text-sm text-text-primary">Find Teachers</span>
          </Link>
          <Link href="/parent/payments" className="flex items-center gap-3 rounded-lg border border-border p-4 hover:bg-surface-elevated transition-colors">
            <CreditCard className="h-5 w-5 text-accent-primary" /><span className="text-sm text-text-primary">View Payments</span>
          </Link>
        </div>
      </JarvisCard>

      {loading ? <p className="text-text-muted">Loading...</p> : subs.length > 0 && (
        <JarvisCard glow="none" className="p-6">
          <h3 className="mb-4 font-display text-lg font-bold">Recent Subscriptions</h3>
          <div className="space-y-2">
            {subs.slice(0, 5).map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium text-text-primary">{s.child_name || "Child"}</p>
                  <p className="text-xs text-text-muted">{s.created_at ? formatDate(s.created_at) : ""}</p>
                </div>
                <span className={`text-xs font-medium ${s.status === "active" ? "text-accent-success" : "text-text-muted"}`}>{s.status}</span>
              </div>
            ))}
          </div>
        </JarvisCard>
      )}
    </div>
  )
}
