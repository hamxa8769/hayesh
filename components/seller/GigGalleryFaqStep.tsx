"use client"

import type { UseFormReturn } from "react-hook-form"
import { Label } from "@/components/ui/label"
import { ChipInput } from "@/components/seller/ChipInput"
import { FaqEditor } from "@/components/seller/FaqEditor"
import type { GigWizardValues } from "@/components/seller/gig-wizard-schema"

export interface GigGalleryFaqStepProps {
  form: UseFormReturn<GigWizardValues>
}

export function GigGalleryFaqStep({ form }: GigGalleryFaqStepProps) {
  const {
    watch,
    setValue,
    formState: { errors },
  } = form

  const galleryUrls = watch("gallery_urls")
  const faq = watch("faq")

  return (
    <div className="space-y-8">
      <div className="space-y-1.5">
        <Label>Gallery Image URLs</Label>
        <p className="text-xs text-text-muted">Paste direct image links buyers will see on your gig page.</p>
        <ChipInput
          values={galleryUrls}
          onChange={(next) => setValue("gallery_urls", next, { shouldValidate: true })}
          placeholder="https://..."
          maxItems={12}
          error={errors.gallery_urls?.message}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Frequently Asked Questions</Label>
        <FaqEditor
          items={faq}
          onChange={(next) => setValue("faq", next, { shouldValidate: true })}
          error={errors.faq?.message}
        />
      </div>
    </div>
  )
}
