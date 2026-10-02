import Link from "next/link"
import { BadgeCheck, PlayCircle, ShieldCheck, Wallet } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Reveal } from "@/components/motion/Reveal"

interface TrustPoint {
  icon: LucideIcon
  title: string
  body: string
}

const POINTS: TrustPoint[] = [
  {
    icon: ShieldCheck,
    title: "You pay Hayesh",
    body: "Tutors and sellers are paid after delivery. Your money is held in escrow until you are happy.",
  },
  {
    icon: BadgeCheck,
    title: "Verified teachers",
    body: "Every profile is reviewed by our team before it goes live.",
  },
  {
    icon: PlayCircle,
    title: "Free demo lesson",
    body: "Meet the teacher and see the teaching style before you pay anything.",
  },
  {
    icon: Wallet,
    title: "Pay your way",
    body: "Bank transfer, Raast/IBFT, JazzCash, Easypaisa, or cards.",
  },
]

export function TrustSection() {
  return (
    <section className="py-24 sm:py-28">
      <div className="mx-auto w-full max-w-[1200px] px-6">
        <Reveal>
          <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Safe payments</p>
          <h2 className="mt-3 max-w-2xl text-balance font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Your money stays protected until the work is done
          </h2>
        </Reveal>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {POINTS.map((point) => (
            <Reveal key={point.title}>
              <div className="h-full rounded-lg border border-border bg-surface p-6 transition-colors duration-150 hover:border-line-strong">
                <point.icon className="size-6 text-text-muted" aria-hidden="true" />
                <h3 className="mt-4 font-display text-lg font-semibold">{point.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-muted">{point.body}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <p className="mt-6 text-sm text-text-muted">
          Something not right?{" "}
          <Link href="/refund-policy" className="text-accent-secondary underline">
            Read our refund policy
          </Link>
          .
        </p>
      </div>
    </section>
  )
}
