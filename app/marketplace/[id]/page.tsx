"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { ArrowLeft } from "lucide-react"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { JarvisButton } from "@/components/ui/jarvis-button"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { formatPKR } from "@/lib/utils/format"
import type { Gig } from "@/types/database"

export default function GigDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [gig, setGig] = useState<Gig | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data } = await supabase.from("gigs").select("*").eq("id", id).single()
      setGig(data as Gig | null)
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return <div className="flex min-h-screen items-center justify-center"><p className="text-text-muted">Loading...</p></div>
  if (!gig) return <div className="flex min-h-screen items-center justify-center"><p className="text-text-muted">Gig not found</p></div>

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-4xl px-4 py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <button onClick={() => router.back()} className="mb-6 flex items-center gap-2 text-sm text-text-muted hover:text-text-primary transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>

          <JarvisCard glow="green" className="p-8">
            <h1 className="font-display text-3xl font-bold text-text-primary">{gig.title}</h1>
            <p className="mt-2 text-text-muted">{gig.description}</p>
            <Badge variant="secondary" className="mt-3">{gig.category}</Badge>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-border p-4 text-center">
                <p className="text-xs text-text-muted">Basic Package</p>
                <p className="font-mono text-lg font-bold text-accent-primary mt-1">{formatPKR(gig.basic_price_pkr || 0)}</p>
              </div>
              <div className="rounded-lg border border-accent-success/50 p-4 text-center">
                <p className="text-xs text-text-muted">Standard Package</p>
                <p className="font-mono text-lg font-bold text-accent-success mt-1">{formatPKR(gig.standard_price_pkr || 0)}</p>
              </div>
              <div className="rounded-lg border border-border p-4 text-center">
                <p className="text-xs text-text-muted">Premium Package</p>
                <p className="font-mono text-lg font-bold text-accent-primary mt-1">{formatPKR(gig.premium_price_pkr || 0)}</p>
              </div>
            </div>

            <div className="mt-8">
              <JarvisButton variant="primary" className="w-full">Place Order</JarvisButton>
            </div>
          </JarvisCard>
        </motion.div>
      </div>
    </div>
  )
}
