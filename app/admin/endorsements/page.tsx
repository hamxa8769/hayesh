"use client"

import { Reveal } from "@/components/motion/Reveal"
import { EndorsementPanel } from "@/components/admin/EndorsementPanel"

export default function EndorsementsPage() {
  return (
    <div className="space-y-8">
      <Reveal>
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Admin / Endorsements</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-text-primary sm:text-3xl">
          Teacher Endorsements
        </h1>
        <p className="mt-2 max-w-prose text-sm text-text-muted">
          Boost real teachers honestly. Featured placement is a genuine visibility control. We do not fabricate
          parent reviews — verified badges and testimonial imports stay off until they can be attributed to a real,
          verifiable source.
        </p>
      </Reveal>

      <EndorsementPanel />
    </div>
  )
}
