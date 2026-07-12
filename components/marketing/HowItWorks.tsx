import { Compass, MessageCircle, Sparkles } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Reveal } from "@/components/motion/Reveal"
import { Stagger } from "@/components/motion/Stagger"

interface Step {
  index: string
  icon: LucideIcon
  title: string
  desc: string
}

const STEPS: Step[] = [
  {
    index: "01",
    icon: Compass,
    title: "Discover",
    desc: "Browse verified teacher profiles and freelance gigs, or explore Claude-powered AI services in HayeshAI Studio.",
  },
  {
    index: "02",
    icon: MessageCircle,
    title: "Connect",
    desc: "Book a free demo lesson with a teacher, message a seller about a gig, or fill in an AI service order form.",
  },
  {
    index: "03",
    icon: Sparkles,
    title: "Learn or receive",
    desc: "Subscribe monthly to your teacher, get your gig delivered on schedule, or receive instant AI output.",
  },
]

export function HowItWorks() {
  return (
    <section className="py-24 sm:py-28">
      <div className="mx-auto w-full max-w-[1200px] px-6">
        <Reveal className="max-w-2xl">
          <span className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">How it works</span>
          <h2 className="mt-3 text-balance font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Three steps. Any layer.
          </h2>
          <p className="mt-3 text-text-muted">The same simple flow whether you&apos;re learning, hiring, or ordering.</p>
        </Reveal>

        <Stagger className="mt-14 grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-3" staggerDelay={0.1}>
          {STEPS.map((step) => (
            <Reveal key={step.index} className="h-full">
              <div className="group relative h-full bg-surface p-8 transition-colors duration-150 hover:bg-surface-elevated">
                <div className="flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded border border-border text-accent-primary transition-colors duration-150 group-hover:border-accent-primary/40">
                    <step.icon className="h-5 w-5" />
                  </div>
                  <span className="font-mono text-2xl font-semibold text-text-disabled">{step.index}</span>
                </div>
                <h3 className="mt-6 font-display text-xl font-semibold text-text-primary">{step.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-text-muted">{step.desc}</p>
              </div>
            </Reveal>
          ))}
        </Stagger>
      </div>
    </section>
  )
}
