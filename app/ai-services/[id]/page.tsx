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
import type { AIService } from "@/types/database"

export default function AIServiceDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [service, setService] = useState<AIService | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data } = await supabase.from("ai_services").select("*").eq("id", id).single()
      setService(data as AIService | null)
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return <div className="flex min-h-screen items-center justify-center"><p className="text-text-muted">Loading...</p></div>
  if (!service) return <div className="flex min-h-screen items-center justify-center"><p className="text-text-muted">Service not found</p></div>

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-4xl px-4 py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <button onClick={() => router.back()} className="mb-6 flex items-center gap-2 text-sm text-text-muted hover:text-text-primary transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>

          <JarvisCard glow="violet" className="p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-primary/10">
                <span className="text-xl">🤖</span>
              </div>
              <div>
                <h1 className="font-display text-2xl font-bold text-text-primary">{service.title}</h1>
                <Badge variant="success">HayeshAI Studio</Badge>
              </div>
            </div>
            <p className="text-text-muted">{service.description}</p>

            <div className="mt-6 rounded-lg border border-accent-primary/30 bg-accent-primary/5 p-4">
              <p className="text-sm text-text-muted">Price</p>
              <p className="font-mono text-2xl font-bold text-accent-primary">{formatPKR(service.price_pkr || 0)}</p>
            </div>

            <div className="mt-8">
              <JarvisButton variant="primary" className="w-full">Order Now</JarvisButton>
            </div>
          </JarvisCard>
        </motion.div>
      </div>
    </div>
  )
}
