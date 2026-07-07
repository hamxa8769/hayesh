"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { JarvisInput } from "@/components/ui/jarvis-input"
import { JarvisButton } from "@/components/ui/jarvis-button"
import { useSupabase } from "@/hooks/useSupabase"

export default function NewGigPage() {
  const router = useRouter()
  const { user } = useSupabase()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("")
  const [basicPrice, setBasicPrice] = useState("")
  const [standardPrice, setStandardPrice] = useState("")
  const [premiumPrice, setPremiumPrice] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!user || !title || !category) { setError("Title and category are required"); return }
    setLoading(true); setError(null)
    const { createClient } = await import("@/lib/supabase/client")
    const supabase = createClient()
    const { error: e } = await supabase.from("gigs").insert({
      seller_id: user.id, title, description, category,
      basic_price_pkr: basicPrice ? parseInt(basicPrice) : null,
      standard_price_pkr: standardPrice ? parseInt(standardPrice) : null,
      premium_price_pkr: premiumPrice ? parseInt(premiumPrice) : null,
    })
    if (e) { setError(e.message); setLoading(false); return }
    router.push("/seller/gigs")
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="font-display text-2xl font-bold">Create New Gig</h2>
      </motion.div>

      <JarvisCard glow="green" className="p-6 max-w-lg">
        <div className="space-y-4">
          <JarvisInput label="Gig Title" placeholder="I will design..." value={title} onChange={(e) => setTitle(e.target.value)} />
          <JarvisInput label="Category" placeholder="Design, Programming, Writing..." value={category} onChange={(e) => setCategory(e.target.value)} />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">Description</label>
            <textarea className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm text-text-primary placeholder:text-text-disabled focus:border-accent-primary focus:outline-none" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe your service..." />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <JarvisInput label="Basic ₨" placeholder="Price" value={basicPrice} onChange={(e) => setBasicPrice(e.target.value)} />
            <JarvisInput label="Standard ₨" placeholder="Price" value={standardPrice} onChange={(e) => setStandardPrice(e.target.value)} />
            <JarvisInput label="Premium ₨" placeholder="Price" value={premiumPrice} onChange={(e) => setPremiumPrice(e.target.value)} />
          </div>
          {error && <p className="text-sm text-accent-danger">{error}</p>}
          <JarvisButton variant="primary" onClick={submit} loading={loading} className="w-full">
            Create Gig <ArrowRight className="h-4 w-4" />
          </JarvisButton>
        </div>
      </JarvisCard>
    </div>
  )
}
