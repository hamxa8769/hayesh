"use client"

import type { UseFormReturn } from "react-hook-form"
import { Mail } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { ChipInput } from "@/components/seller/ChipInput"
import { FileUpload } from "@/components/teacher/FileUpload"
import type { OnboardingValues } from "@/components/teacher/onboarding-schema"

export interface TeacherProfileStepProps {
  form: UseFormReturn<OnboardingValues>
  email: string
  userId: string | null
}

export function TeacherProfileStep({ form, email, userId }: TeacherProfileStepProps) {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = form

  const languages = watch("languages")
  const photoUrl = watch("profile_photo_url")
  const displayName = watch("display_name")

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line-strong bg-surface-2">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote Supabase Storage URL, no next/image domain configured
            <img src={photoUrl} alt="Profile preview" className="h-full w-full object-cover" />
          ) : (
            <span className="font-display text-lg font-semibold text-text-muted">
              {displayName?.trim()?.[0]?.toUpperCase() || "T"}
            </span>
          )}
        </div>
        <div className="flex-1 space-y-1.5">
          <Label>Profile Photo</Label>
          {userId ? (
            <FileUpload
              bucket="teacher-photos"
              userId={userId}
              accept="image/png,image/jpeg,image/webp"
              maxSizeMB={5}
              label={photoUrl ? "Change photo" : "Upload photo"}
              hint="PNG, JPG or WEBP up to 5MB. Optional — you can add this later."
              onUploaded={(file) => setValue("profile_photo_url", file.url ?? "", { shouldValidate: true })}
            />
          ) : (
            <p className="text-xs text-text-muted">Sign-in required to upload a photo.</p>
          )}
          {photoUrl && (
            <button
              type="button"
              onClick={() => setValue("profile_photo_url", "", { shouldValidate: true })}
              className="text-xs text-text-muted transition-colors duration-150 hover:text-accent-danger"
            >
              Remove photo
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="onboarding-email">Email</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <Input id="onboarding-email" value={email} readOnly disabled className="pl-9" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="onboarding-phone">Phone</Label>
          <Input id="onboarding-phone" type="tel" placeholder="+92 3XX XXXXXXX" {...register("phone")} />
          {errors.phone && <p className="text-xs text-accent-danger">{errors.phone.message}</p>}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="onboarding-display-name">Display Name</Label>
        <Input id="onboarding-display-name" placeholder="Your teaching name" {...register("display_name")} />
        {errors.display_name && <p className="text-xs text-accent-danger">{errors.display_name.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="onboarding-tagline">Tagline</Label>
        <Input id="onboarding-tagline" placeholder="e.g. Physics PhD | 10+ years teaching" {...register("tagline")} />
        {errors.tagline && <p className="text-xs text-accent-danger">{errors.tagline.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label>Languages You Teach In</Label>
        <ChipInput
          values={languages}
          onChange={(next) => setValue("languages", next, { shouldValidate: true })}
          placeholder="Add a language and press Enter"
          maxItems={8}
          error={errors.languages?.message}
        />
      </div>
    </div>
  )
}
