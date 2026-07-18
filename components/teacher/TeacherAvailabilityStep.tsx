"use client"

import type { UseFormReturn } from "react-hook-form"
import { AvailabilityGrid } from "@/components/teacher/AvailabilityGrid"
import type { OnboardingValues } from "@/components/teacher/onboarding-schema"

export interface TeacherAvailabilityStepProps {
  form: UseFormReturn<OnboardingValues>
}

export function TeacherAvailabilityStep({ form }: TeacherAvailabilityStepProps) {
  const { watch, setValue } = form
  const availability = watch("availability")

  return (
    <div className="space-y-3">
      <p className="text-sm text-text-muted">Select the time slots you&apos;re available to teach each day.</p>
      <AvailabilityGrid
        value={availability}
        onChange={(next) => setValue("availability", next, { shouldValidate: true })}
      />
    </div>
  )
}
