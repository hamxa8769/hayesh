"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Bot } from "lucide-react"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { JarvisButton } from "@/components/ui/jarvis-button"
import { Badge } from "@/components/ui/badge"
import type { AIService } from "@/types/database"

export default function AdminAIServicesPage() {
  const [services, setServices] = useState<AIService[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const { data } = await supabase.from("ai_services").select("*").order("created_at", { ascending: false })
      setServices((data || []) as AIService[])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="font-display text-2xl font-bold">AI Service Builder</h2>
      </motion.div>

      {loading ? <p className="text-text-muted">Loading...</p> : services.length === 0 ? (
        <JarvisCard glow="violet" className="p-8 text-center">
          <Bot className="mx-auto h-12 w-12 text-text-disabled mb-3" />
          <p className="text-text-muted mb-4">No AI services yet</p>
          <JarvisButton variant="primary">Create AI Service</JarvisButton>
        </JarvisCard>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s, i) => (
            <motion.div key={s.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <JarvisCard glow="violet" className="p-5">
                <h3 className="font-display font-bold text-text-primary">{s.title}</h3>
                <p className="mt-1 text-sm text-text-muted line-clamp-2">{s.description}</p>
                <div className="mt-3 flex items-center justify-between">
                  <Badge variant={s.status === "active" ? "success" : "default"}>{s.status || "draft"}</Badge>
                  <span className="font-mono text-sm font-bold text-accent-primary">₨{s.price_pkr || 0}</span>
                </div>
              </JarvisCard>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
