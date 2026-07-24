"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Bot, Star, Zap } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Reveal } from "@/components/motion/Reveal"
import { Stagger } from "@/components/motion/Stagger"
import { createClient } from "@/lib/supabase/client"
import { formatPKR } from "@/lib/utils/format"
import type { AIService } from "@/types/database"

export default function AIServicesPage() {
  const [services, setServices] = useState<AIService[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      // ai_services has a `status` enum ('active'|'paused'|'draft'), not an
      // is_active boolean — querying the wrong column returned nothing, which is
      // why HayeshAI Studio showed empty despite 10 seeded services.
      const { data } = await supabase.from("ai_services").select("*").eq("status", "active").order("created_at", { ascending: false })
      setServices((data || []) as AIService[])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-6xl px-6 py-16 sm:px-10">
        <Reveal className="max-w-2xl">
          <span className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">AI Agent Services</span>
          <h1 className="mt-3 text-balance font-display text-4xl font-bold tracking-tight sm:text-5xl">
            <span className="aurora-text">HayeshAI</span> Studio
          </h1>
          <p className="mt-3 text-text-muted">Claude-powered agents that deliver instantly — no human seller, no waiting.</p>
        </Reveal>

        <div className="mt-10">
          {loading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading AI services">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-56 animate-pulse rounded-lg border border-border bg-surface" />
              ))}
            </div>
          ) : services.length === 0 ? (
            <div className="rounded-lg border border-border bg-surface p-16 text-center">
              <Bot className="mx-auto h-10 w-10 text-text-disabled" />
              <p className="mt-4 text-text-muted">AI services coming soon</p>
            </div>
          ) : (
            <Stagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" staggerDelay={0.06}>
              {services.map((s) => (
                <Reveal key={s.id}>
                  <Link href={`/ai-services/${s.id}`} className="group block h-full">
                    <div className="relative flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface p-6 transition-all duration-150 hover:-translate-y-0.5 hover:border-line-strong hover:bg-surface-elevated hover:shadow-[0_12px_30px_rgba(0,0,0,0.45),0_0_24px_rgba(245,184,78,0.1)]">
                      <div className="absolute inset-x-0 top-0 h-[2px] aurora-bg opacity-70" />

                      <div className="flex items-center justify-between gap-3">
                        <Badge variant="secondary" className="uppercase tracking-[0.06em]">AI Service</Badge>
                        {s.delivery_time_hrs != null && (
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.08em] text-accent-secondary">
                            <Zap className="h-3 w-3" />
                            {s.delivery_time_hrs <= 1 ? "Instant" : `${s.delivery_time_hrs}h delivery`}
                          </span>
                        )}
                      </div>

                      <h3 className="mt-4 font-display text-lg font-semibold leading-snug text-text-primary">{s.title}</h3>
                      <p className="mt-2 line-clamp-2 flex-1 text-sm leading-relaxed text-text-muted">{s.description}</p>

                      {s.average_rating != null && (
                        <span className="mt-3 inline-flex items-center gap-1 font-mono text-xs tabular-nums text-text-muted">
                          <Star className="h-3 w-3 fill-accent-secondary text-accent-secondary" />
                          {s.average_rating.toFixed(1)}
                          {s.total_reviews != null && <span className="text-text-disabled">({s.total_reviews})</span>}
                        </span>
                      )}

                      <div className="mt-6 flex items-end justify-between border-t border-border pt-4">
                        <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-disabled">Price</span>
                        <span className="font-mono text-lg font-semibold tabular-nums text-accent-primary">{formatPKR(s.price_pkr || 0)}</span>
                      </div>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </Stagger>
          )}
        </div>
      </div>
    </div>
  )
}
