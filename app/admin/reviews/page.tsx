"use client"

import { Reveal } from "@/components/motion/Reveal"
import { GigReviewModeration } from "@/components/admin/GigReviewModeration"

export default function AdminReviewsPage() {
  return (
    <div className="space-y-8">
      <Reveal>
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Admin / Reviews</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-text-primary sm:text-3xl">Gig Reviews</h1>
      </Reveal>

      <GigReviewModeration />
    </div>
  )
}
