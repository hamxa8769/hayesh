import { Compass, GraduationCap, MessageCircle, PackageCheck, ShoppingBag, Sparkles } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Reveal } from "@/components/motion/Reveal"
import { Stagger } from "@/components/motion/Stagger"

interface Step {
  index: string
  icon: LucideIcon
  title: string
  desc: string
}

interface Track {
  label: string
  icon: LucideIcon
  steps: Step[]
}

const TRACKS: Track[] = [
  {
    label: "Tutoring",
    icon: GraduationCap,
    steps: [
      {
        index: "01",
        icon: Compass,
        title: "Discover a teacher",
        desc: "Browse verified teacher profiles by subject, rating, and rate tier.",
      },
      {
        index: "02",
        icon: MessageCircle,
        title: "Book a free demo",
        desc: "Meet the teacher over a live video lesson before you commit to anything.",
      },
      {
        index: "03",
        icon: Sparkles,
        title: "Subscribe monthly",
        desc: "Liked the demo? Pay upfront for Group, Standard, or Private tuition.",
      },
    ],
  },
  {
    label: "Marketplace",
    icon: ShoppingBag,
    steps: [
      {
        index: "01",
        icon: Compass,
        title: "Browse a gig",
        desc: "Explore freelance services across design, writing, code, video, and more.",
      },
      {
        index: "02",
        icon: MessageCircle,
        title: "Order a package",
        desc: "Pick Basic, Standard, or Premium and pay once via Stripe or Simpaisa.",
      },
      {
        index: "03",
        icon: PackageCheck,
        title: "Get it delivered",
        desc: "The seller delivers on schedule; request revisions if the package includes them.",
      },
    ],
  },
]

function TrackColumn({ track }: { track: Track }) {
  return (
    <div>
      <div className="flex items-center gap-2.5">
        <track.icon className="h-4 w-4 text-accent-primary" />
        <span className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">{track.label} flow</span>
      </div>

      <Stagger className="mt-5 flex flex-col gap-px overflow-hidden rounded-lg border border-border bg-border" staggerDelay={0.08}>
        {track.steps.map((step) => (
          <Reveal key={step.index}>
            <div className="group flex items-start gap-5 bg-surface p-6 transition-colors duration-150 hover:bg-surface-elevated">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-border text-accent-primary transition-colors duration-150 group-hover:border-accent-primary/40">
                <step.icon className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-baseline gap-2.5">
                  <span className="font-mono text-sm font-semibold text-text-disabled">{step.index}</span>
                  <h3 className="font-display text-base font-semibold text-text-primary">{step.title}</h3>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-text-muted">{step.desc}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </Stagger>
    </div>
  )
}

export function HowItWorks() {
  return (
    <section className="py-24 sm:py-28">
      <div className="mx-auto w-full max-w-[1200px] px-6">
        <Reveal className="max-w-2xl">
          <span className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">How it works</span>
          <h2 className="mt-3 text-balance font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Two flows. Same trust.
          </h2>
          <p className="mt-3 text-text-muted">
            Tutoring subscriptions and marketplace orders work differently on purpose &mdash; here&apos;s each one.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-8 lg:grid-cols-2 lg:gap-12">
          {TRACKS.map((track) => (
            <TrackColumn key={track.label} track={track} />
          ))}
        </div>
      </div>
    </section>
  )
}
