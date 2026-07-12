"use client"

import Link from "next/link"
import { useEffect, useRef } from "react"
import { motion, useReducedMotion } from "framer-motion"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { ShieldCheck, Sparkles, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Reveal } from "@/components/motion/Reveal"

const TRUST_ITEMS = [
  { icon: ShieldCheck, label: "Verified teachers" },
  { icon: Sparkles, label: "Freelance experts" },
  { icon: Star, label: "AI services" },
]

const SESSION_SUBJECTS = ["Algebra", "Calculus", "+3"]

export function Hero() {
  const visualRef = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = useReducedMotion()

  useEffect(() => {
    if (prefersReducedMotion || !visualRef.current) return

    gsap.registerPlugin(ScrollTrigger)
    const ctx = gsap.context(() => {
      gsap.to(visualRef.current, {
        y: -56,
        rotate: -1.4,
        ease: "none",
        scrollTrigger: {
          trigger: visualRef.current,
          start: "top bottom",
          end: "bottom top",
          scrub: 0.6,
        },
      })
    })

    return () => ctx.revert()
  }, [prefersReducedMotion])

  return (
    <section className="relative overflow-hidden pb-24 pt-40 sm:pb-28 sm:pt-48">
      {/* obsidian scrim keeps hero copy legible over the AuroraField shader */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/35 via-background/75 to-background" />

      <div className="relative mx-auto w-full max-w-[1200px] px-6">
        <div className="grid items-center gap-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
          <div className="max-w-2xl">
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full border border-border px-3.5 py-1.5 font-mono text-xs uppercase tracking-[0.12em] text-text-muted">
                <span className="aurora-bg h-1.5 w-1.5 rounded-full" />
                Tutoring &middot; Freelance Services &middot; AI Agents
              </span>
            </Reveal>

            <Reveal delay={0.08}>
              <h1 className="mt-7 text-balance font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
                Teachers, freelancers, and AI
                <br />
                all <span className="aurora-text">delivered</span>.
              </h1>
            </Reveal>

            <Reveal delay={0.16}>
              <p className="mt-6 max-w-xl text-balance text-lg leading-relaxed text-text-muted">
                Book a free demo with a verified teacher, hire a freelance expert
                for one-time work, or get instant results from Claude-powered AI
                agents &mdash; one marketplace for every way you want to learn,
                hire, or ship.
              </p>
            </Reveal>

            <Reveal delay={0.24}>
              <div className="mt-10 flex flex-wrap items-center gap-4">
                <Button asChild variant="aurora" size="lg">
                  <Link href="/teachers">Find a teacher</Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/marketplace">Browse services</Link>
                </Button>
              </div>
            </Reveal>

            <Reveal delay={0.32}>
              <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3">
                {TRUST_ITEMS.map((item, index) => (
                  <span key={item.label} className="flex items-center gap-2 text-sm text-text-muted">
                    <item.icon className="h-4 w-4 text-text-disabled" />
                    {item.label}
                    {index < TRUST_ITEMS.length - 1 && (
                      <span className="ml-4 hidden h-1 w-1 rounded-full bg-text-disabled sm:inline-block" />
                    )}
                  </span>
                ))}
              </div>
            </Reveal>
          </div>

          <div className="relative hidden lg:block">
            <motion.div
              ref={visualRef}
              animate={prefersReducedMotion ? undefined : { y: [0, -10, 0] }}
              transition={prefersReducedMotion ? undefined : { duration: 6, repeat: Infinity, ease: "easeInOut" }}
              className="relative"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.94, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="relative mx-auto max-w-sm rounded-lg border border-border bg-surface/90 p-6 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-text-muted">
                    Live session
                  </span>
                  <span className="flex items-center gap-1.5 rounded-full border border-accent-primary/30 bg-accent-primary/10 px-2 py-0.5 font-mono text-[10px] text-accent-primary">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-primary" />
                    ON AIR
                  </span>
                </div>

                <div className="mt-5 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface-elevated font-mono text-sm font-semibold text-text-primary">
                    AR
                  </div>
                  <div>
                    <p className="font-display text-base font-semibold text-text-primary">Ayesha R.</p>
                    <p className="text-xs text-text-muted">Mathematics &middot; O-Level</p>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {SESSION_SUBJECTS.map((subject) => (
                    <span key={subject} className="rounded-full border border-border px-2.5 py-1 text-xs text-text-muted">
                      {subject}
                    </span>
                  ))}
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
                  <span className="flex items-center gap-1.5 font-mono text-sm tabular-nums text-text-primary">
                    <Star className="h-3.5 w-3.5 fill-accent-secondary text-accent-secondary" />
                    4.9
                  </span>
                  <span className="font-mono text-sm font-semibold tabular-nums text-accent-primary">
                    &#8360;4,500/mo
                  </span>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.55 }}
                className="absolute -right-6 -top-6 w-48 rounded-lg border border-line-strong bg-surface-elevated/95 p-4 shadow-[0_12px_30px_rgba(0,0,0,0.5)] backdrop-blur"
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">HayeshAI Studio</p>
                <p className="mt-1.5 text-xs text-text-primary">Delivered in 47s</p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface">
                  <div className="aurora-bg h-full w-full" />
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  )
}
