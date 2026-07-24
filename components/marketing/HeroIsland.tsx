"use client"

import { useMemo } from "react"
import Link from "next/link"
import { GraduationCap, Store, Sparkles, ShieldCheck, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Reveal } from "@/components/motion/Reveal"
import { VoxelIsland } from "@/components/three/VoxelIsland"
import { buildShowcaseModel } from "@/components/three/voxel-island-model"

// The three platform layers, surfaced as clickable "landmarks" beneath the
// island. Kept separate from the 3D meshes on purpose: raycasting individual
// voxels under an auto-rotating OrbitControls camera is fiddly and inaccessible,
// so the buildings on the island are the visual cue and these labelled links
// are the real, keyboard-reachable navigation targets.
const LANDMARKS = [
  { icon: GraduationCap, label: "Teachers", href: "/teachers", blurb: "Verified tutors, monthly plans" },
  { icon: Store, label: "Marketplace", href: "/marketplace", blurb: "Freelance experts, one-time work" },
  { icon: Sparkles, label: "HayeshAI Studio", href: "/ai-services", blurb: "Instant AI-fulfilled services" },
] as const

const TRUST_ITEMS = [
  { icon: ShieldCheck, label: "Verified teachers" },
  { icon: Sparkles, label: "Freelance experts" },
  { icon: Star, label: "AI services" },
]

export function HeroIsland() {
  // Built once — the showcase model is fully deterministic, so there is no
  // reason to recompute it on re-render.
  const model = useMemo(() => buildShowcaseModel(), [])

  return (
    <section className="relative overflow-hidden pb-24 pt-36 sm:pb-28 sm:pt-44">
      <div className="relative mx-auto w-full max-w-[1200px] px-6">
        <div className="grid items-center gap-14 lg:grid-cols-[1.02fr_0.98fr] lg:gap-12">
          <div className="max-w-2xl">
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full border border-border px-3.5 py-1.5 font-mono text-xs uppercase tracking-[0.12em] text-text-muted">
                <span className="aurora-bg h-1.5 w-1.5 rounded-full" />
                Tutoring &middot; Freelance Services &middot; AI Agents
              </span>
            </Reveal>

            <Reveal delay={0.08}>
              <h1 className="mt-7 text-balance font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
                One island.
                <br />
                Every way to <span className="aurora-text">learn &amp; hire</span>.
              </h1>
            </Reveal>

            <Reveal delay={0.16}>
              <p className="mt-6 max-w-xl text-balance text-lg leading-relaxed text-text-muted">
                Book a free demo with a verified teacher, hire a freelance expert
                for one-time work, or get instant results from Claude-powered AI
                agents &mdash; three connected worlds, one marketplace.
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

          <div className="relative">
            <Reveal delay={0.2}>
              {/* Sole WebGL canvas on the landing page. VoxelIsland is
                  client-only and SSR-safe, freezes under reduced motion, and
                  degrades to a silent placeholder on context loss. */}
              <VoxelIsland
                model={model}
                className="h-72 sm:h-80 lg:h-[26rem]"
              />
            </Reveal>

            <Reveal delay={0.32}>
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {LANDMARKS.map((landmark) => (
                  <Link
                    key={landmark.href}
                    href={landmark.href}
                    className="group flex flex-col gap-1 rounded-[10px] border border-border bg-surface/70 p-3.5 transition-all duration-150 hover:border-line-strong hover:bg-surface-elevated"
                  >
                    <span className="flex items-center gap-2 text-sm font-medium text-text-primary">
                      <landmark.icon className="h-4 w-4 text-accent-primary" />
                      {landmark.label}
                    </span>
                    <span className="text-xs leading-snug text-text-muted">{landmark.blurb}</span>
                  </Link>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  )
}
