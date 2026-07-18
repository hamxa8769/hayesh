"use client"

import { useFieldArray } from "react-hook-form"
import type { UseFormReturn } from "react-hook-form"
import { Plus, Trash2 } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import type { OnboardingValues } from "@/components/teacher/onboarding-schema"

export interface TeacherEducationStepProps {
  form: UseFormReturn<OnboardingValues>
}

export function TeacherEducationStep({ form }: TeacherEducationStepProps) {
  const {
    register,
    control,
    formState: { errors },
  } = form

  const { fields, append, remove } = useFieldArray({ control, name: "education" })

  return (
    <div className="space-y-4">
      {fields.map((field, index) => {
        const entryErrors = errors.education?.[index]
        return (
          <div key={field.id} className="space-y-3 rounded-lg border border-border bg-surface-elevated/40 p-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">
                Education {index + 1}
              </span>
              {fields.length > 1 && (
                <button
                  type="button"
                  onClick={() => remove(index)}
                  aria-label={`Remove education ${index + 1}`}
                  className="text-text-muted transition-colors duration-150 hover:text-accent-danger"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Degree</Label>
                <Input placeholder="BSc, MSc, PhD" {...register(`education.${index}.degree`)} />
                {entryErrors?.degree && <p className="text-xs text-accent-danger">{entryErrors.degree.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Institution</Label>
                <Input placeholder="University name" {...register(`education.${index}.institution`)} />
                {entryErrors?.institution && (
                  <p className="text-xs text-accent-danger">{entryErrors.institution.message}</p>
                )}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Field of Study</Label>
                <Input placeholder="Physics" {...register(`education.${index}.field`)} />
              </div>
              <div className="space-y-1.5">
                <Label>Year</Label>
                <Input placeholder="2020" {...register(`education.${index}.year`)} />
              </div>
            </div>
          </div>
        )
      })}

      {typeof errors.education?.message === "string" && (
        <p className="text-xs text-accent-danger">{errors.education.message}</p>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => append({ degree: "", institution: "", year: "", field: "" })}
      >
        <Plus className="h-3.5 w-3.5" /> Add Education
      </Button>
    </div>
  )
}
