"use client"

import { useFieldArray } from "react-hook-form"
import type { UseFormReturn } from "react-hook-form"
import { Plus, Trash2 } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import type { OnboardingValues } from "@/components/teacher/onboarding-schema"

export interface TeacherExperienceStepProps {
  form: UseFormReturn<OnboardingValues>
}

export function TeacherExperienceStep({ form }: TeacherExperienceStepProps) {
  const {
    register,
    control,
    formState: { errors },
  } = form

  const { fields, append, remove } = useFieldArray({ control, name: "experience" })

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-muted">Optional — add any relevant teaching or professional experience.</p>

      {fields.map((field, index) => {
        const entryErrors = errors.experience?.[index]
        return (
          <div key={field.id} className="space-y-3 rounded-lg border border-border bg-surface-elevated/40 p-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">
                Experience {index + 1}
              </span>
              <button
                type="button"
                onClick={() => remove(index)}
                aria-label={`Remove experience ${index + 1}`}
                className="text-text-muted transition-colors duration-150 hover:text-accent-danger"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input placeholder="Senior Tutor" {...register(`experience.${index}.title`)} />
              {entryErrors?.title && <p className="text-xs text-accent-danger">{entryErrors.title.message}</p>}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Institution</Label>
                <Input placeholder="School or organization" {...register(`experience.${index}.institution`)} />
              </div>
              <div className="space-y-1.5">
                <Label>Years</Label>
                <Input placeholder="2019 – 2023" {...register(`experience.${index}.years`)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <textarea
                {...register(`experience.${index}.description`)}
                rows={2}
                placeholder="What you did in this role..."
                className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition-all duration-300 focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
              />
            </div>
          </div>
        )
      })}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => append({ title: "", institution: "", years: "", description: "" })}
      >
        <Plus className="h-3.5 w-3.5" /> Add Experience
      </Button>

      {fields.length === 0 && <p className="text-sm text-text-muted">No experience yet? You can skip this step.</p>}
    </div>
  )
}
