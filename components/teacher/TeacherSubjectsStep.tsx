"use client"

import { useFieldArray } from "react-hook-form"
import type { UseFormReturn } from "react-hook-form"
import { Plus, Trash2 } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { SUBJECT_LEVELS } from "@/components/teacher/onboarding-schema"
import type { OnboardingValues } from "@/components/teacher/onboarding-schema"

export interface TeacherSubjectsStepProps {
  form: UseFormReturn<OnboardingValues>
}

export function TeacherSubjectsStep({ form }: TeacherSubjectsStepProps) {
  const {
    register,
    control,
    formState: { errors },
  } = form

  const { fields, append, remove } = useFieldArray({ control, name: "subjects" })

  return (
    <div className="space-y-4">
      {fields.map((field, index) => {
        const entryErrors = errors.subjects?.[index]
        return (
          <div key={field.id} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label>{index === 0 ? "Subject" : undefined}</Label>
              <Input placeholder="Mathematics" {...register(`subjects.${index}.subject`)} />
              {entryErrors?.subject && <p className="text-xs text-accent-danger">{entryErrors.subject.message}</p>}
            </div>
            <div className="w-full space-y-1.5 sm:w-40">
              <Label>{index === 0 ? "Level" : undefined}</Label>
              <select
                className="flex h-10 w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary transition-all duration-300 focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
                {...register(`subjects.${index}.level`)}
              >
                {SUBJECT_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            {fields.length > 1 && (
              <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)} aria-label={`Remove subject ${index + 1}`}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )
      })}

      {typeof errors.subjects?.message === "string" && (
        <p className="text-xs text-accent-danger">{errors.subjects.message}</p>
      )}

      <Button type="button" variant="outline" size="sm" onClick={() => append({ subject: "", level: "beginner" })}>
        <Plus className="h-3.5 w-3.5" /> Add Subject
      </Button>
    </div>
  )
}
