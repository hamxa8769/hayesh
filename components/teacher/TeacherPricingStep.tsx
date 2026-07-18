"use client"

import type { UseFormReturn } from "react-hook-form"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import type { OnboardingValues } from "@/components/teacher/onboarding-schema"

export interface TeacherPricingStepProps {
  form: UseFormReturn<OnboardingValues>
}

export function TeacherPricingStep({ form }: TeacherPricingStepProps) {
  const {
    register,
    formState: { errors },
  } = form

  return (
    <div className="space-y-5">
      <p className="text-sm text-text-muted">
        Set monthly subscription prices in PKR for each session tier. Optional — leave blank and set these later from
        your profile.
      </p>

      <div className="space-y-1.5">
        <Label htmlFor="onboarding-group-price">Group (up to 5) — ₨/month</Label>
        <Input
          id="onboarding-group-price"
          type="number"
          inputMode="numeric"
          placeholder="5000"
          className="font-mono tabular-nums"
          {...register("group_price_pkr")}
        />
        {errors.group_price_pkr && <p className="text-xs text-accent-danger">{errors.group_price_pkr.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="onboarding-standard-price">Standard (up to 3) — ₨/month</Label>
        <Input
          id="onboarding-standard-price"
          type="number"
          inputMode="numeric"
          placeholder="10000"
          className="font-mono tabular-nums"
          {...register("standard_price_pkr")}
        />
        {errors.standard_price_pkr && (
          <p className="text-xs text-accent-danger">{errors.standard_price_pkr.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="onboarding-private-price">Private (1-on-1) — ₨/month</Label>
        <Input
          id="onboarding-private-price"
          type="number"
          inputMode="numeric"
          placeholder="20000"
          className="font-mono tabular-nums"
          {...register("private_price_pkr")}
        />
        {errors.private_price_pkr && <p className="text-xs text-accent-danger">{errors.private_price_pkr.message}</p>}
      </div>
    </div>
  )
}
