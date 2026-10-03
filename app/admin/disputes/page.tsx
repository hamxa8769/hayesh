"use client"

import { Reveal } from "@/components/motion/Reveal"
import { DisputeQueue } from "@/components/admin/DisputeQueue"

export default function DisputesPage() {
  return (
    <div className="space-y-8">
      <Reveal>
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Admin / Disputes</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-text-primary sm:text-3xl">Dispute Resolution</h1>
      </Reveal>

      <DisputeQueue />
    </div>
  )
}
