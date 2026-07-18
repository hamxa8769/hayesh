"use client"

import { Reveal } from "@/components/motion/Reveal"
import { RequestQueue } from "@/components/admin/RequestQueue"

export default function AdminRequestsPage() {
  return (
    <div className="space-y-8">
      <Reveal>
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Admin / Requests</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-text-primary sm:text-3xl">
          Tutoring Requests
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-text-muted">
          Parents ask for tutoring here before a teacher is assigned. Open requests need a match — the count
          below tells you how many are waiting.
        </p>
      </Reveal>

      <RequestQueue />
    </div>
  )
}
