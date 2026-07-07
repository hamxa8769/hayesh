"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Package, Plus } from "lucide-react"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { JarvisButton } from "@/components/ui/jarvis-button"
import { Badge } from "@/components/ui/badge"
import { useSupabase } from "@/hooks/useSupabase"
import { formatPKR } from "@/lib/utils/format"
import type { Gig } from "@/types/database"

export default function GigsPage() {
  const { user } = useSupabase()
  const [gigs, setGigs] = useState<Gig[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const load = async () => {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const { data } = await supabase.from("gigs").select("*").eq("seller_id", user.id).order("created_at", { ascending: false })
      setGigs((data || []) as Gig[])
      setLoading(false)
    }
    load()
  }, [user])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="font-display text-2xl font-bold">My Gigs</h2>
        </motion.div>
        <Link href="/seller/gigs/new"><JarvisButton variant="primary" size="sm"><Plus className="h-3.5 w-3.5 mr-1" /> Create Gig</JarvisButton></Link>
      </div>

      {loading ? <p className="text-text-muted">Loading...</p> : gigs.length === 0 ? (
        <JarvisCard glow="none" className="p-8 text-center">
          <Package className="mx-auto h-12 w-12 text-text-disabled mb-3" />
          <p className="text-text-muted mb-4">No gigs yet</p>
          <Link href="/seller/gigs/new"><JarvisButton variant="primary">Create Your First Gig</JarvisButton></Link>
        </JarvisCard>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {gigs.map((g, i) => (
            <motion.div key={g.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <JarvisCard glow="none" className="p-5">
                <h3 className="font-display font-bold text-text-primary">{g.title}</h3>
                <p className="mt-1 text-sm text-text-muted line-clamp-2">{g.description}</p>
                <div className="mt-3 flex items-center justify-between">
                  <Badge variant={g.status === "approved" ? "success" : g.status === "pending" ? "warning" : "default"}>{g.status}</Badge>
                  <span className="font-mono text-sm font-bold text-accent-success">{formatPKR(g.basic_price_pkr || 0)}</span>
                </div>
              </JarvisCard>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
