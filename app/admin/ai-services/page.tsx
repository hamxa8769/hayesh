"use client"

import { useEffect, useState } from "react"
import { Bot } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PanelGroup } from "@/components/dashboard/PanelGroup"
import { Reveal } from "@/components/motion/Reveal"
import type { AIService, AIServiceStatus } from "@/types/database"

const STATUS_BADGE: Record<AIServiceStatus, "success" | "warning" | "secondary"> = {
  active: "success",
  paused: "warning",
  draft: "secondary",
}

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
    <div className="space-y-8">
      <Reveal>
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Admin / AI Services</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-text-primary sm:text-3xl">HayeshAI Studio Builder</h1>
      </Reveal>

      {loading ? (
        <p className="font-mono text-sm text-text-muted">Loading…</p>
      ) : services.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-12 text-center">
          <Bot className="mx-auto h-10 w-10 text-text-disabled" />
          <p className="mt-3 mb-4 text-sm text-text-muted">No AI services yet</p>
          <Button variant="aurora">Create AI Service</Button>
        </div>
      ) : (
        <PanelGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <div key={s.id} className="rounded-lg border border-border bg-surface p-5 transition-colors hover:bg-surface-elevated hover:border-line-strong">
              <h3 className="font-display font-semibold text-text-primary">{s.title}</h3>
              <p className="mt-1 line-clamp-2 text-sm text-text-muted">{s.description}</p>
              <div className="mt-4 flex items-center justify-between">
                <Badge variant={s.status ? STATUS_BADGE[s.status] : "secondary"}>{s.status || "draft"}</Badge>
                <span className="font-mono text-sm font-semibold tabular-nums text-accent-primary">₨{s.price_pkr || 0}</span>
              </div>
            </div>
          ))}
        </PanelGroup>
      )}
    </div>
  )
}
