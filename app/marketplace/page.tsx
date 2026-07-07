"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Search } from "lucide-react"
import { JarvisInput } from "@/components/ui/jarvis-input"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { formatPKR } from "@/lib/utils/format"
import type { Gig } from "@/types/database"

export default function MarketplacePage() {
  const [gigs, setGigs] = useState<Gig[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data } = await supabase.from("gigs").select("*").eq("status", "approved").order("created_at", { ascending: false })
      setGigs((data || []) as Gig[])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = gigs.filter((g) => {
    if (!search) return true
    const q = search.toLowerCase()
    return g.title?.toLowerCase().includes(q) || g.description?.toLowerCase().includes(q) || g.category?.toLowerCase().includes(q)
  })

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <h1 className="font-display text-4xl font-bold text-text-primary">Marketplace</h1>
          <p className="mt-2 text-text-muted">Find freelance services from verified sellers</p>
        </motion.div>

        <JarvisInput placeholder="Search gigs..." icon={<Search className="h-4 w-4" />} value={search} onChange={(e) => setSearch(e.target.value)} className="mb-8" />

        {loading ? (
          <div className="text-center py-20"><p className="text-text-muted">Loading gigs...</p></div>
        ) : filtered.length === 0 ? (
          <JarvisCard glow="none" className="p-12 text-center"><p className="text-text-muted">No gigs found</p></JarvisCard>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((g, i) => (
              <motion.div key={g.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Link href={`/marketplace/${g.id}`}>
                  <JarvisCard glow="green" className="p-6 h-full cursor-pointer hover:border-accent-success/50 transition-all">
                    <h3 className="font-display text-xl font-bold text-text-primary">{g.title}</h3>
                    <p className="text-sm text-text-muted mt-1 line-clamp-2">{g.description}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <Badge variant="secondary">{g.category}</Badge>
                      <span className="font-mono text-sm font-bold text-accent-success">{formatPKR(g.basic_price_pkr || 0)}</span>
                    </div>
                  </JarvisCard>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
