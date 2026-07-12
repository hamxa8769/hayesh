"use client"

import type { UseFormReturn } from "react-hook-form"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { ChipInput } from "@/components/seller/ChipInput"
import { GIG_CATEGORIES, type GigWizardValues } from "@/components/seller/gig-wizard-schema"

export interface GigOverviewStepProps {
  form: UseFormReturn<GigWizardValues>
}

export function GigOverviewStep({ form }: GigOverviewStepProps) {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = form

  const tags = watch("tags")

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="gig-title">Gig Title</Label>
        <Input id="gig-title" {...register("title")} placeholder="I will build a full-stack Next.js web app" />
        {errors.title && <p className="text-xs text-accent-danger">{errors.title.message}</p>}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="gig-category">Category</Label>
          <select
            id="gig-category"
            {...register("category")}
            className="flex h-10 w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary transition-all duration-300 focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
          >
            <option value="">Select a category</option>
            {GIG_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          {errors.category && <p className="text-xs text-accent-danger">{errors.category.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="gig-subcategory">Subcategory</Label>
          <Input id="gig-subcategory" {...register("subcategory")} placeholder="e.g. Full-Stack Development" />
          {errors.subcategory && <p className="text-xs text-accent-danger">{errors.subcategory.message}</p>}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Tags</Label>
        <ChipInput
          values={tags}
          onChange={(next) => setValue("tags", next, { shouldValidate: true })}
          placeholder="Add a tag and press Enter"
          maxItems={10}
          error={errors.tags?.message}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="gig-description">Description</Label>
        <textarea
          id="gig-description"
          {...register("description")}
          rows={6}
          placeholder="Describe exactly what buyers get, your process, and why you're the right fit..."
          className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition-all duration-300 focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
        />
        {errors.description && <p className="text-xs text-accent-danger">{errors.description.message}</p>}
      </div>
    </div>
  )
}
