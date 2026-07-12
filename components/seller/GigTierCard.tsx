"use client"

import type { UseFormReturn } from "react-hook-form"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { ChipInput } from "@/components/seller/ChipInput"
import { cn } from "@/lib/utils/cn"
import type { GigTierKey, GigWizardValues } from "@/components/seller/gig-wizard-schema"

export interface GigTierCardProps {
  form: UseFormReturn<GigWizardValues>
  tier: GigTierKey
  label: string
  highlight?: boolean
}

export function GigTierCard({ form, tier, label, highlight = false }: GigTierCardProps) {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = form

  const features = watch(`${tier}.features`)
  const tierErrors = errors[tier]
  const isPremium = tier === "premium"
  const unlimitedRevisions = watch("premiumUnlimitedRevisions")

  return (
    <div
      className={cn(
        "relative flex flex-col gap-4 rounded-lg border bg-surface p-5",
        highlight ? "border-accent-primary/50 shadow-[0_0_30px_rgba(39,196,160,0.15)]" : "border-border"
      )}
    >
      {highlight && (
        <span aria-hidden="true" className="aurora-bg absolute inset-x-0 top-0 h-[2px] rounded-t-lg" />
      )}

      <div className="flex items-center justify-between">
        <span className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">{label}</span>
        {highlight && (
          <span className="aurora-text font-mono text-[10px] font-semibold uppercase tracking-[0.12em]">
            Most Popular
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        <Label>Package Title</Label>
        <Input {...register(`${tier}.title`)} placeholder={`${label} package`} />
        {tierErrors?.title && <p className="text-xs text-accent-danger">{tierErrors.title.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label>Description</Label>
        <textarea
          {...register(`${tier}.description`)}
          rows={3}
          placeholder="What's included in this package..."
          className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition-all duration-300 focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
        />
        {tierErrors?.description && <p className="text-xs text-accent-danger">{tierErrors.description.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Price (PKR)</Label>
          <Input type="number" {...register(`${tier}.price_pkr`, { valueAsNumber: true })} placeholder="5000" className="font-mono tabular-nums" />
          {tierErrors?.price_pkr && <p className="text-xs text-accent-danger">{tierErrors.price_pkr.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Price (USD)</Label>
          <Input type="number" step="0.01" {...register(`${tier}.price_usd`, { valueAsNumber: true })} placeholder="25" className="font-mono tabular-nums" />
          {tierErrors?.price_usd && <p className="text-xs text-accent-danger">{tierErrors.price_usd.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Delivery (days)</Label>
          <Input type="number" {...register(`${tier}.delivery_days`, { valueAsNumber: true })} placeholder="5" className="font-mono tabular-nums" />
          {tierErrors?.delivery_days && <p className="text-xs text-accent-danger">{tierErrors.delivery_days.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Revisions</Label>
          <Input
            type="number"
            {...register(`${tier}.revisions`, { valueAsNumber: true })}
            placeholder="2"
            disabled={isPremium && unlimitedRevisions}
            className="font-mono tabular-nums"
          />
          {tierErrors?.revisions && <p className="text-xs text-accent-danger">{tierErrors.revisions.message}</p>}
        </div>
      </div>

      {isPremium && (
        <label className="flex items-center gap-2 text-xs text-text-muted">
          <input
            type="checkbox"
            checked={unlimitedRevisions}
            onChange={(e) => setValue("premiumUnlimitedRevisions", e.target.checked, { shouldValidate: true })}
            className="h-3.5 w-3.5 rounded border-border accent-[#27C4A0]"
          />
          Unlimited revisions
        </label>
      )}

      <div className="space-y-1.5">
        <Label>Features</Label>
        <ChipInput
          values={features}
          onChange={(next) => setValue(`${tier}.features`, next, { shouldValidate: true })}
          placeholder="Add a feature and press Enter"
          error={tierErrors?.features?.message}
        />
      </div>
    </div>
  )
}
