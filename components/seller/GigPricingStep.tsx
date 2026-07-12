"use client"

import type { UseFormReturn } from "react-hook-form"
import { GigTierCard } from "@/components/seller/GigTierCard"
import type { GigWizardValues } from "@/components/seller/gig-wizard-schema"

export interface GigPricingStepProps {
  form: UseFormReturn<GigWizardValues>
}

export function GigPricingStep({ form }: GigPricingStepProps) {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <GigTierCard form={form} tier="basic" label="Basic" />
      <GigTierCard form={form} tier="standard" label="Standard" highlight />
      <GigTierCard form={form} tier="premium" label="Premium" />
    </div>
  )
}
