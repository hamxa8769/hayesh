"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Package, Plus, Edit, Eye } from "lucide-react"
import Link from "next/link"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { JarvisButton } from "@/components/ui/jarvis-button"
import { Badge } from "@/components/ui/badge"
import { useSupabase } from "@/hooks/useSupabase"
import { formatPKR } from "@/lib/utils/format"
import type { Gig } from "@/types/database"

const statusColors: Record<string, "default" | "success" | "destructive" | "warning"> = {
  pending: "warning",
  approved: "success",
  rejected: "destructive",
}

export default function MyGigsPage() {
  const { user } = useSupabase()
  const [gigs, setGigs] = useState<Gig[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const fetchGigs = async () => {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const { data: seller } = await supabase.from("sellers").select("id").eq("user_id", user.id).single()
      if (!seller) { setLoading(false); return }
      const { data } = await supabase.from("gigs").select("*").eq("seller_id", seller.id).order("created_at", { ascending: false })
      setGigs((data || []) as Gig[])
      setLoading(false)
    }
    fetchGigs()
  }, [user])

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <h2 className="text-2xl font-display font-bold text-text-primary">My Gigs</h2>
        <Link href="/seller/gigs/new">
          <JarvisButton variant="primary" size="sm"><Plus className="h-4 w-4" /> Create Gig</JarvisButton>
        </Link>
      </motion.div>

      {loading ? (
        <p className="text-text-muted">Loading gigs...</p>
      ) : gigs.length === 0 ? (
        <JarvisCard glow="none" className="p-8 text-center">
          <Package className="mx-auto h-12 w-12 text-text-disabled mb-3" />
          <p className="text-text-muted mb-4">No gigs yet</p>
          <Link href="/seller/gigs/new"><JarvisButton variant="primary">Create Your First Gig</JarvisButton></Link>
        </JarvisCard>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {gigs.map((gig, i) => (
            <motion.div key={gig.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <JarvisCard glow="violet" className="p-5 flex flex-col h-full">
                <div className="flex items-start justify-between mb-2">
                  <Badge variant={statusColors[gig.status || "pending"]}>{gig.status}</Badge>
                  <span className="text-xs text-text-muted">{gig.category}</span>
                </div>
                <h3 className="font-display text-lg font-semibold text-text-primary mb-1">{gig.title}</h3>
                <p className="text-sm text-text-muted line-clamp-2 mb-3">{gig.description}</p>
                <div className="mt-auto flex items-center justify-between">
                  <p className="font-mono text-lg font-bold text-accent-primary">
                    ₨{(gig.basic_price_pkr || gig.standard_price_pkr || 0).toLocaleString()}
                  </p>
                  <div className="flex gap-2">
                    <Link href={`/gigs/${gig.id}/edit`}>
                      <JarvisButton variant="ghost" size="sm"><Edit className="h-3.5 w-3.5" /></JarvisButton>
                    </Link>
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
