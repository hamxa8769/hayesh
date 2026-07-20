"use client"

import { Reveal } from "@/components/motion/Reveal"
import { SettingsForm } from "@/components/admin/SettingsForm"

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <Reveal>
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Admin / Settings</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-text-primary sm:text-3xl">Platform Settings</h1>
        <p className="mt-2 max-w-prose text-sm text-text-muted">
          Commission rates, registration fees, feature switches and branding for the whole platform. Changes apply
          immediately to every account.
        </p>
      </Reveal>

      <SettingsForm />
    </div>
  )
}
