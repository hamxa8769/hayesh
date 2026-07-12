"use client"

import { useEffect, useRef, useState } from "react"
import { useInView, useReducedMotion } from "framer-motion"
import { createClient } from "@/lib/supabase/client"
import { Reveal } from "@/components/motion/Reveal"

interface LiveCounts {
  teachers: number
  gigs: number
  aiServices: number
}

function useCountUp(target: number, active: boolean, prefersReducedMotion: boolean): number {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!active) return

    if (prefersReducedMotion) {
      setValue(target)
      return
    }

    const durationMs = 1400
    const startTime = performance.now()
    let frameId: number

    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / durationMs, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(eased * target))
      if (progress < 1) {
        frameId = requestAnimationFrame(tick)
      }
    }

    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [active, target, prefersReducedMotion])

  return value
}

interface CountTileProps {
  label: string
  target: number
  suffix?: string
  active: boolean
  prefersReducedMotion: boolean
}

function CountTile({ label, target, suffix = "+", active, prefersReducedMotion }: CountTileProps) {
  const value = useCountUp(target, active, prefersReducedMotion)

  return (
    <div className="text-center">
      <p className="font-mono text-3xl font-semibold tabular-nums text-text-primary sm:text-4xl">
        {value.toLocaleString()}
        {suffix}
      </p>
      <p className="mt-2 font-mono text-xs uppercase tracking-[0.12em] text-text-muted">{label}</p>
    </div>
  )
}

export function StatStrip() {
  const [counts, setCounts] = useState<LiveCounts>({ teachers: 0, gigs: 0, aiServices: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const isInView = useInView(containerRef, { once: true, margin: "-80px" })
  const prefersReducedMotion = useReducedMotion() ?? false

  useEffect(() => {
    const loadCounts = async () => {
      const supabase = createClient()
      const [teachersResult, gigsResult, aiServicesResult] = await Promise.all([
        supabase.from("teachers").select("id", { count: "exact", head: true }).eq("status", "approved"),
        supabase.from("gigs").select("id", { count: "exact", head: true }).eq("status", "approved"),
        supabase.from("ai_services").select("id", { count: "exact", head: true }).eq("status", "active"),
      ])

      setCounts({
        teachers: teachersResult.count ?? 0,
        gigs: gigsResult.count ?? 0,
        aiServices: aiServicesResult.count ?? 0,
      })
    }

    loadCounts()
  }, [])

  return (
    <section className="relative border-y border-border bg-surface/40 py-14">
      <div ref={containerRef} className="mx-auto w-full max-w-[1200px] px-6">
        <Reveal className="grid grid-cols-2 gap-y-10 sm:grid-cols-4 sm:gap-y-0">
          <CountTile label="Verified teachers" target={counts.teachers} active={isInView} prefersReducedMotion={prefersReducedMotion} />
          <CountTile label="Freelance services" target={counts.gigs} active={isInView} prefersReducedMotion={prefersReducedMotion} />
          <CountTile label="AI services live" target={counts.aiServices} active={isInView} prefersReducedMotion={prefersReducedMotion} />
          <div className="text-center">
            <p className="font-mono text-3xl font-semibold tabular-nums text-text-primary sm:text-4xl">&lt;2h</p>
            <p className="mt-2 font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Avg. demo response</p>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
