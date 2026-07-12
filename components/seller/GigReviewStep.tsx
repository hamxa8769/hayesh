"use client"

import type { UseFormReturn } from "react-hook-form"
import { formatPKR, formatUSD } from "@/lib/utils/format"
import { GIG_TIERS, type GigWizardValues } from "@/components/seller/gig-wizard-schema"

export interface GigReviewStepProps {
  form: UseFormReturn<GigWizardValues>
}

export function GigReviewStep({ form }: GigReviewStepProps) {
  const values = form.getValues()

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-surface p-5">
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Overview</p>
        <h3 className="mt-2 font-display text-lg font-semibold text-text-primary">{values.title || "Untitled gig"}</h3>
        <p className="mt-1 text-sm text-text-muted">
          {values.category}
          {values.subcategory ? ` · ${values.subcategory}` : ""}
        </p>
        {values.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {values.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-border bg-surface-elevated px-2.5 py-0.5 text-xs text-text-muted">
                {tag}
              </span>
            ))}
          </div>
        )}
        <p className="mt-3 whitespace-pre-line text-sm text-text-muted">{values.description}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {GIG_TIERS.map(({ key, label }) => {
          const tier = values[key]
          const revisions = key === "premium" && values.premiumUnlimitedRevisions ? "Unlimited" : tier.revisions

          return (
            <div key={key} className="rounded-lg border border-border bg-surface p-4">
              <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">{label}</p>
              <p className="mt-1 font-display text-base font-semibold text-text-primary">{tier.title || `${label} package`}</p>
              <p className="mt-2 font-mono text-lg font-semibold tabular-nums text-text-primary">{formatPKR(tier.price_pkr)}</p>
              <p className="font-mono text-xs tabular-nums text-text-muted">{formatUSD(tier.price_usd)}</p>
              <p className="mt-2 text-xs text-text-muted">
                {tier.delivery_days}-day delivery · {revisions} revisions
              </p>
              {tier.features.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {tier.features.map((feature) => (
                    <li key={feature} className="text-xs text-text-muted">
                      • {feature}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Gallery</p>
          <p className="mt-2 text-sm text-text-muted">
            {values.gallery_urls.length} image{values.gallery_urls.length === 1 ? "" : "s"} added
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">FAQ</p>
          <p className="mt-2 text-sm text-text-muted">
            {values.faq.length} question{values.faq.length === 1 ? "" : "s"} added
          </p>
        </div>
      </div>
    </div>
  )
}
