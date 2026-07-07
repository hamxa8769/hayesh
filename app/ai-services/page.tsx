"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Bot } from "lucide-react"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { formatPKR } from "@/lib/utils/format"
import type { AIService } from "@/types/database"

export default function AIServicesPage() {
  const [services, setServices] = useState<AIService[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data } = await supabase.from("ai_services").select("*").eq("is_active", true).order("created_at", { ascending: false })
      setServices((data || []) as AIService[])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <h1 className="font-display text-4xl font-bold text-text-primary">HayeshAI Studio</h1>
          <p className="mt-2 text-text-muted">AI-powered services at your fingertips</p>
        </motion.div>

        {loading ? (
          <div className="text-center py-20"><p className="text-text-muted">Loading services...</p></div>
        ) : services.length === 0 ? (
          <JarvisCard glow="none" className="p-12 text-center">
            <Bot className="mx-auto h-16 w-16 text-text-disabled mb-4" />
            <p className="text-text-muted">AI services coming soon</p>
          </JarvisCard>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s, i) => (
              <motion.div key={s.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Link href={`/ai-services/${s.id}`}>
                  <JarvisCard glow="violet" className="p-6 h-full cursor-pointer hover:border-accent-primary/50 transition-all">
                    <h3 className="font-display text-xl font-bold text-text-primary">{s.title}</h3>
                    <p className="text-sm text-text-muted mt-1 line-clamp-2">{s.description}</p>
                    <div className="mt-4 flex items-center justify-between">
                      <Badge variant="secondary">AI Service</Badge>
                      <span className="font-mono text-sm font-bold text-accent-primary">{formatPKR(s.price_pkr || 0)}</span>
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
