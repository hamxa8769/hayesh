"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { motion } from "framer-motion"
import { Package, Star, ArrowLeft, Clock, CheckCircle } from "lucide-react"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { JarvisButton } from "@/components/ui/jarvis-button"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { formatPKR } from "@/lib/utils/format"
import Link from "next/link"
import type { Gig } from "@/types/database"

export default function GigDetailPage() {
  const params = useParams()
  const [gig, setGig] = useState<Gig | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchGig = async () => {
      const supabase = createClient()
      const { data } = await supabase.from("gigs").select("*").eq("id", params.id).single()
      setGig(data as Gig | null)
      setLoading(false)
    }
    if (params.id) fetchGig()
  }, [params.id])

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <motion.div key={i} className="h-2 w-2 rounded-full bg-accent-primary" animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} />
          ))}
        </div>
      </div>
    )
  }

  if (!gig) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
        <p className="text-text-muted">Gig not found</p>
        <Link href="/marketplace"><JarvisButton variant="secondary"><ArrowLeft className="h-4 w-4 mr-1" /> Back to Marketplace</JarvisButton></Link>
      </div>
    )
  }

  const packages = [
    gig.basic_title && { name: "Basic", title: gig.basic_title, description: gig.basic_description, price: gig.basic_price_pkr, days: gig.basic_delivery_days, revisions: gig.basic_revisions, features: gig.basic_features },
    gig.standard_title && { name: "Standard", title: gig.standard_title, description: gig.standard_description, price: gig.standard_price_pkr, days: gig.standard_delivery_days, revisions: gig.standard_revisions, features: gig.standard_features },
    gig.premium_title && { name: "Premium", title: gig.premium_title, description: gig.premium_description, price: gig.premium_price_pkr, days: gig.premium_delivery_days, revisions: gig.premium_revisions, features: gig.premium_features },
  ].filter(Boolean) as Array<{ name: string; title: string; description: string | null; price: number | null; days: number | null; revisions: number | null; features: string[] | null }>

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Link href="/marketplace" className="mb-6 inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-primary transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Marketplace
        </Link>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <JarvisCard glow="green" className="p-6 mb-6">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-success/20">
                <Package className="h-8 w-8 text-accent-success" />
              </div>
              <div className="flex-1">
                <h1 className="font-display text-2xl font-bold text-text-primary">{gig.title}</h1>
                {gig.description && <p className="mt-2 text-text-muted">{gig.description}</p>}
                <div className="mt-3 flex flex-wrap gap-3 text-sm text-text-muted">
                  {gig.category && <Badge variant="default">{gig.category}</Badge>}
                  <span className="flex items-center gap-1"><Star className="h-4 w-4 text-accent-warning" /> {gig.average_rating || "New"}</span>
                  <span className="flex items-center gap-1"><Package className="h-4 w-4" /> {gig.total_orders || 0} orders</span>
                </div>
              </div>
            </div>
          </JarvisCard>

          {packages.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-3">
              {packages.map((pkg, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                  <JarvisCard glow={i === 1 ? "cyan" : "none"} className={`p-5 h-full flex flex-col ${i === 1 ? "border-accent-secondary/50" : ""}`}>
                    <h3 className="font-display text-lg font-bold text-text-primary">{pkg.name}</h3>
                    <p className="mt-1 text-sm font-medium text-text-muted">{pkg.title}</p>
                    {pkg.description && <p className="mt-2 flex-1 text-sm text-text-muted">{pkg.description}</p>}
                    <div className="mt-4 space-y-2">
                      {pkg.days && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-text-muted">Delivery</span>
                          <span className="text-sm text-text-primary">{pkg.days} days</span>
                        </div>
                      )}
                      {pkg.revisions != null && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-text-muted">Revisions</span>
                          <span className="text-sm text-text-primary">{pkg.revisions}</span>
                        </div>
                      )}
                    </div>
                    {pkg.features && pkg.features.length > 0 && (
                      <div className="mt-3 space-y-1">
                        {pkg.features.map((f, fi) => (
                          <div key={fi} className="flex items-center gap-2 text-xs text-text-muted">
                            <CheckCircle className="h-3 w-3 text-accent-success" /> {f}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="mt-4 border-t border-border pt-4">
                      <p className="font-mono text-2xl font-bold text-accent-success">{formatPKR(pkg.price || 0)}</p>
                      <JarvisButton variant={i === 1 ? "primary" : "secondary"} className="w-full mt-3">
                        Select {pkg.name}
                      </JarvisButton>
                    </div>
                  </JarvisCard>
                </motion.div>
              ))}
            </div>
          ) : (
            <JarvisCard glow="none" className="p-8 text-center">
              <Package className="mx-auto h-12 w-12 text-text-disabled mb-3" />
              <p className="text-text-muted">No packages configured yet.</p>
            </JarvisCard>
          )}
        </motion.div>
      </div>
    </div>
  )
}
