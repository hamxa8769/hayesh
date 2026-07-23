"use client"

import { Reveal } from "@/components/motion/Reveal"
import { BrandingEditor } from "@/components/admin/BrandingEditor"

export default function BrandingPage() {
  return (
    <div className="space-y-8">
      <Reveal>
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Admin / Branding</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-text-primary sm:text-3xl">Branding & Theme</h1>
        <p className="mt-2 max-w-prose text-sm text-text-muted">
          Accent colors, logo, typeface, scrollbar style, the footer disclaimer, and AI-service package copy — all
          live, all site-wide.
        </p>
      </Reveal>

      <BrandingEditor />
    </div>
  )
}
