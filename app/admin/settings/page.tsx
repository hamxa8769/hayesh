"use client"

import { Settings } from "lucide-react"
import { Reveal } from "@/components/motion/Reveal"

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <Reveal>
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Admin / Settings</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-text-primary sm:text-3xl">Platform Settings</h1>
      </Reveal>

      <div className="rounded-lg border border-border bg-surface p-12 text-center">
        <Settings className="mx-auto h-10 w-10 text-text-disabled" />
        <p className="mt-3 text-sm text-text-muted">Platform settings coming soon</p>
      </div>
    </div>
  )
}
