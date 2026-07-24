"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, Bot, Zap } from "lucide-react"
import { Reveal } from "@/components/motion/Reveal"

/**
 * HayeshAI Studio — the landing-page window into the AI service catalogue.
 *
 * Only the safe display columns are selected: migration 013 revokes
 * ai_services.system_prompt from anon/authenticated, so selecting it would
 * throw "permission denied" and blank the whole section.
 */

interface AIServiceTeaser {
  id: string
  title: string
  description: string
  category: string
  price_pkr: number | null
  delivery_time_hrs: number | null
}

export function AIStudioSection() {
  const [services, setServices] = useState<AIServiceTeaser[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client")
        const supabase = createClient()
        const { data } = await supabase
          .from("ai_services")
          .select("id, title, description, category, price_pkr, delivery_time_hrs")
          .eq("status", "active")
          .order("total_orders", { ascending: false })
          .limit(6)

        if (!cancelled) setServices((data || []) as AIServiceTeaser[])
      } catch {
        if (!cancelled) setServices([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  // Nothing to advertise yet — stay silent rather than render an empty shell.
  if (!loading && services.length === 0) return null

  return (
    <section className="relative mx-auto max-w-[1200px] px-4 py-20 sm:px-6 lg:px-8">
      <Reveal>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">
              HayeshAI Studio
            </p>
            <h2 className="mt-2 max-w-lg text-balance font-display text-3xl font-semibold tracking-[-0.02em] text-text-primary sm:text-4xl">
              Work delivered <span className="aurora-text">instantly</span> by AI
            </h2>
            <p className="mt-3 max-w-xl text-sm text-text-muted">
              Code, copy, CVs, SEO plans and more — configured by our team, fulfilled in seconds. No
              waiting on a freelancer.
            </p>
          </div>
          <Link
            href="/ai-services"
            className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-accent-primary transition-colors hover:text-text-primary"
          >
            Browse all services <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Reveal>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-lg border border-border bg-surface" />
            ))
          : services.map((service, i) => (
              <Reveal key={service.id} delay={i * 0.05}>
                <Link href={`/ai-services/${service.id}`} className="group block h-full">
                  <article className="flex h-full flex-col justify-between rounded-lg border border-border bg-surface p-6 transition-all duration-150 group-hover:border-line-strong group-hover:bg-surface-elevated">
                    <div>
                      <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4 text-accent-primary" />
                        <span className="font-mono text-[11px] uppercase tracking-wide text-text-muted">
                          {service.category}
                        </span>
                      </div>
                      <h3 className="mt-3 font-display text-base font-semibold text-text-primary">
                        {service.title}
                      </h3>
                      <p className="mt-1.5 line-clamp-2 text-sm text-text-muted">{service.description}</p>
                    </div>

                    <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                      <span className="font-mono text-sm tabular-nums text-text-primary">
                        {service.price_pkr ? `PKR ${service.price_pkr.toLocaleString("en-US")}` : "Free"}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-text-muted">
                        <Zap className="h-3 w-3" />
                        {service.delivery_time_hrs ? `${service.delivery_time_hrs}h` : "Instant"}
                      </span>
                    </div>
                  </article>
                </Link>
              </Reveal>
            ))}
      </div>
    </section>
  )
}
