import { Bot, GraduationCap, ShoppingBag } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Reveal } from "@/components/motion/Reveal"

interface PricingLane {
  icon: LucideIcon
  eyebrow: string
  title: string
  description: string
  tiers: string[]
  billing: string
  featured?: boolean
}

const LANES: PricingLane[] = [
  {
    icon: GraduationCap,
    eyebrow: "Layer one · Teachers",
    title: "Free demo, then monthly",
    description:
      "Book a free demo lesson first. Like the teacher? Subscribe monthly upfront across three tiers — no subscription starts until after the demo.",
    tiers: ["Group", "Standard", "Private"],
    billing: "Billed monthly",
    featured: true,
  },
  {
    icon: ShoppingBag,
    eyebrow: "Layer two · Marketplace",
    title: "One-time gig orders",
    description:
      "Fiverr-style freelance work from verified sellers. Pick a package, pay once via Stripe or Simpaisa, and get it delivered on schedule.",
    tiers: ["Basic", "Standard", "Premium"],
    billing: "Pay once per order",
  },
  {
    icon: Bot,
    eyebrow: "Layer three · HayeshAI Studio",
    title: "Instant AI delivery",
    description:
      "Claude-powered agent services deployed by Hayesh. Fill in the order form and get your result back in seconds — no human in the loop.",
    tiers: ["Instant output"],
    billing: "Pay once per run",
  },
]

export function PricingModel() {
  return (
    <section className="py-24 sm:py-28">
      <div className="mx-auto w-full max-w-[1200px] px-6">
        <Reveal className="max-w-2xl">
          <span className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">How pricing works</span>
          <h2 className="mt-3 text-balance font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Three layers, three ways to pay.
          </h2>
          <p className="mt-3 text-text-muted">
            Tutoring, freelance work, and AI agents are priced differently on purpose &mdash; pick the model that
            matches what you need.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-6 lg:grid-cols-[1.2fr_1fr_1fr]">
          {LANES.map((lane, index) => (
            <Reveal key={lane.title} delay={index * 0.08} className={lane.featured ? "lg:row-span-1" : ""}>
              <div
                className={`relative flex h-full flex-col overflow-hidden rounded-lg border p-7 ${
                  lane.featured
                    ? "border-line-strong bg-surface-elevated shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_20px_50px_rgba(0,0,0,0.45)]"
                    : "border-border bg-surface"
                }`}
              >
                {lane.featured && <div className="aurora-bg absolute inset-x-0 top-0 h-[2px]" />}

                <div
                  className={`flex h-11 w-11 items-center justify-center rounded border ${
                    lane.featured ? "border-accent-primary/40 text-accent-primary" : "border-border text-text-muted"
                  }`}
                >
                  <lane.icon className="h-5 w-5" />
                </div>

                <span className="mt-5 font-mono text-[11px] uppercase tracking-[0.12em] text-text-muted">
                  {lane.eyebrow}
                </span>
                <h3 className="mt-2 font-display text-xl font-semibold text-text-primary">{lane.title}</h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-text-muted">{lane.description}</p>

                <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-5">
                  {lane.tiers.map((tier) => (
                    <span
                      key={tier}
                      className="rounded-full border border-border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.06em] text-text-muted"
                    >
                      {tier}
                    </span>
                  ))}
                </div>
                <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.1em] text-text-disabled">
                  {lane.billing}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
