"use client"

import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { GraduationCap, ShoppingBag, Cpu, ArrowRight, Star, Users, Globe, Zap } from "lucide-react"
import { JarvisButton } from "@/components/ui/jarvis-button"
import { Navbar } from "@/components/layout/Navbar"
import { Button } from "@/components/ui/button"
import { AuroraField } from "@/components/three/AuroraField"
import { Reveal } from "@/components/motion/Reveal"
import { Stagger } from "@/components/motion/Stagger"

interface Layer {
  icon: LucideIcon
  index: string
  title: string
  desc: string
}

const layers: Layer[] = [
  {
    icon: GraduationCap,
    index: "01",
    title: "Teacher Profiles",
    desc: "Structured profiles with monthly subscriptions. Parents book a free demo, then subscribe.",
  },
  {
    icon: ShoppingBag,
    index: "02",
    title: "Seller Marketplace",
    desc: "Fiverr-style gigs with Basic, Standard, and Premium packages. One-time payments.",
  },
  {
    icon: Cpu,
    index: "03",
    title: "HayeshAI Studio",
    desc: "AI services powered by Claude. Admin-configured, 100% margin, instant delivery.",
  },
]

interface Stat {
  value: string
  label: string
}

const stats: Stat[] = [
  { value: "500+", label: "Teachers" },
  { value: "10K+", label: "Students" },
  { value: "50+", label: "AI Services" },
  { value: "99%", label: "Satisfaction" },
]

interface TrustItem {
  icon: LucideIcon
  label: string
}

const trustItems: TrustItem[] = [
  { icon: Globe, label: "Multilingual Support" },
  { icon: Star, label: "Verified Teachers" },
  { icon: Users, label: "10K+ Students" },
  { icon: Zap, label: "AI-Powered" },
]

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <AuroraField />
      <Navbar />

      {/* Hero */}
      <section className="relative flex min-h-screen items-center overflow-hidden px-6 pb-24 pt-32 sm:px-10 lg:px-16">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-full max-w-3xl bg-gradient-to-r from-background via-background/70 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent" />

        <div className="relative mx-auto w-full max-w-6xl">
          <div className="max-w-2xl">
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded border border-border px-3 py-1 font-mono text-xs uppercase tracking-[0.12em] text-text-muted">
                <Zap className="h-3.5 w-3.5 text-accent-primary" />
                Three-Layer Tutoring Marketplace
              </span>
            </Reveal>

            <Reveal delay={0.1}>
              <h1 className="mt-8 text-balance font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-7xl">
                <span className="text-text-primary">Learn. Hire. </span>
                <span className="aurora-text">Create.</span>
              </h1>
            </Reveal>

            <Reveal delay={0.2}>
              <p className="mt-6 max-w-xl text-balance text-lg leading-relaxed text-text-muted">
                Teachers build structured profiles, sellers list Fiverr-style gigs, and
                Claude-powered agents deliver instant results — one platform, three ways
                to teach, sell, and buy.
              </p>
            </Reveal>

            <Reveal delay={0.3}>
              <div className="mt-10 flex flex-wrap items-center gap-4">
                <Button asChild variant="aurora" size="lg">
                  <Link href="/auth/register">
                    Get Started <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/teachers">Browse Teachers</Link>
                </Button>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="relative border-y border-border bg-surface/40 py-14">
        <Stagger className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-16 gap-y-8 px-6">
          {stats.map((s) => (
            <Reveal key={s.label} className="text-center">
              <p className="font-mono text-3xl font-semibold tabular-nums text-text-primary">{s.value}</p>
              <p className="mt-1 font-mono text-xs uppercase tracking-[0.12em] text-text-muted">{s.label}</p>
            </Reveal>
          ))}
        </Stagger>
      </section>

      {/* Three Layers */}
      <section className="px-6 py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal className="mb-16 max-w-2xl">
            <span className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">How it works</span>
            <h2 className="mt-3 text-balance font-display text-3xl font-bold sm:text-4xl">
              Three layers. One platform.
            </h2>
            <p className="mt-3 text-text-muted">
              Everything you need to teach, sell, or buy — in one place.
            </p>
          </Reveal>

          <Stagger className="grid gap-6 md:grid-cols-3" staggerDelay={0.12}>
            {layers.map((layer) => (
              <Reveal key={layer.title}>
                <div className="group h-full rounded-lg border border-border bg-surface p-8 transition-colors duration-150 hover:border-line-strong hover:bg-surface-elevated">
                  <div className="flex items-center justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded border border-border text-accent-primary transition-colors duration-150 group-hover:border-accent-primary/40">
                      <layer.icon className="h-5 w-5" />
                    </div>
                    <span className="font-mono text-xs text-text-disabled">{layer.index}</span>
                  </div>
                  <h3 className="mt-6 font-display text-xl font-semibold">{layer.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-text-muted">{layer.desc}</p>
                </div>
              </Reveal>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Trust bar */}
      <section className="border-y border-border bg-surface/30 px-6 py-12">
        <Stagger className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-10 gap-y-4" staggerDelay={0.08}>
          {trustItems.map((item) => (
            <Reveal key={item.label} className="flex items-center gap-2 text-sm text-text-muted">
              <item.icon className="h-4 w-4 text-text-disabled" />
              {item.label}
            </Reveal>
          ))}
        </Stagger>
      </section>

      {/* CTA */}
      <section className="px-6 py-28">
        <Reveal className="mx-auto max-w-3xl">
          <div className="relative overflow-hidden rounded-lg border border-border bg-surface p-12 text-center">
            <div className="absolute inset-x-0 top-0 h-[2px] aurora-bg" />
            <h2 className="text-balance font-display text-3xl font-bold sm:text-4xl">Ready to start?</h2>
            <p className="mt-4 text-text-muted">Join thousands of teachers and students on Hayesh.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link href="/auth/register?role=teacher">
                <JarvisButton variant="primary" size="lg">Become a Teacher</JarvisButton>
              </Link>
              <Link href="/auth/register?role=parent">
                <JarvisButton variant="secondary" size="lg">Find a Teacher</JarvisButton>
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-surface/40 px-6 py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
          <span className="aurora-text font-display text-lg font-bold">HAYESH</span>
          <p className="text-sm text-text-muted">&copy; 2026 Hayesh. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
