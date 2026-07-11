"use client"

import { AlertTriangle } from "lucide-react"
import { Reveal } from "@/components/motion/Reveal"

export default function DisputesPage() {
  return (
    <div className="space-y-8">
      <Reveal>
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Admin / Disputes</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-text-primary sm:text-3xl">Dispute Resolution</h1>
      </Reveal>

      <div className="rounded-lg border border-border bg-surface p-12 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-text-disabled" />
        <p className="mt-3 text-sm text-text-muted">No open disputes</p>
      </div>
    </div>
  )
}
