"use client"

import { useEffect, useState } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import Link from "next/link"
import { z } from "zod"
import {
  ArrowRight,
  Briefcase,
  BookOpen,
  GraduationCap,
  Languages,
  Loader2,
  Plus,
  ShieldCheck,
  Star,
  Trash2,
  UserCog,
  Wallet,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { PanelGroup } from "@/components/dashboard/PanelGroup"
import { Reveal } from "@/components/motion/Reveal"
import { ChipInput } from "@/components/seller/ChipInput"
import { FileUpload } from "@/components/teacher/FileUpload"
import { AvailabilityGrid } from "@/components/teacher/AvailabilityGrid"
import {
  educationEntrySchema,
  experienceEntrySchema,
  subjectEntrySchema,
  SUBJECT_LEVELS,
} from "@/components/teacher/onboarding-schema"
import { PayoutAccountEditor } from "@/components/shared/PayoutAccountEditor"
import { useSupabase } from "@/hooks/useSupabase"
import { createClient } from "@/lib/supabase/client"
import type { Teacher, Profile } from "@/types/database"

/**
 * Editable subsets of `public.teachers` / `public.profiles`. Every save call
 * below sends ONLY these explicit columns — never a spread of the whole row
 * — because migration 001 revoked client UPDATE on teachers.status,
 * teachers.featured, and profiles.role. Sending those columns (even
 * unintentionally via a spread) makes the whole update fail with
 * "permission denied". average_rating / total_reviews are platform-
 * maintained and are only ever displayed, never included in an update.
 */
type ProfileFields = Pick<Profile, "full_name" | "email" | "phone" | "country" | "city" | "bio">

const personalInfoSchema = z.object({
  full_name: z.string().trim().min(2, "At least 2 characters").max(120, "Keep it under 120 characters"),
  phone: z.string().trim().max(20, "Keep it under 20 characters").optional(),
  country: z.string().trim().max(60, "Keep it under 60 characters").optional(),
  city: z.string().trim().max(60, "Keep it under 60 characters").optional(),
  bio: z.string().trim().max(600, "Keep it under 600 characters").optional(),
})
type PersonalInfoValues = z.infer<typeof personalInfoSchema>

const publicProfileSchema = z.object({
  display_name: z.string().trim().min(2, "At least 2 characters").max(80, "Keep it under 80 characters"),
  tagline: z.string().trim().max(140, "Keep it under 140 characters").optional(),
  profile_photo_url: z.string().trim().optional(),
  intro_video_url: z.union([z.string().trim().url("Must be a valid URL"), z.literal("")]).optional(),
})
type PublicProfileValues = z.infer<typeof publicProfileSchema>

const credentialsSchema = z.object({
  education: z.array(educationEntrySchema).min(1, "Add at least one education entry"),
  experience: z.array(experienceEntrySchema),
})
type CredentialsValues = z.infer<typeof credentialsSchema>

const teachingSchema = z.object({
  subjects: z.array(subjectEntrySchema).min(1, "Add at least one subject"),
  availability: z.record(z.string(), z.array(z.string())),
  translation_languages: z.array(z.string().trim().min(1)),
})
type TeachingValues = z.infer<typeof teachingSchema>

const pricingSchema = z
  .object({
    group_price_pkr: z.string().trim().optional(),
    standard_price_pkr: z.string().trim().optional(),
    private_price_pkr: z.string().trim().optional(),
  })
  .refine(
    (values) =>
      Boolean(values.group_price_pkr?.trim()) ||
      Boolean(values.standard_price_pkr?.trim()) ||
      Boolean(values.private_price_pkr?.trim()),
    { message: "Set a monthly price for at least one tier", path: ["group_price_pkr"] },
  )
type PricingValues = z.infer<typeof pricingSchema>

/** Shared per-section save state. Each section owns its own form and save call so one section's error never blocks another's save. */
function useSectionSave<T>(save: (values: T) => Promise<{ error: string | null }>) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (values: T) => {
    setSaving(true)
    setError(null)
    try {
      const { error: saveError } = await save(values)
      if (saveError) {
        setError(saveError)
        return
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return { saving, saved, error, run }
}

interface SectionFooterProps {
  saving: boolean
  saved: boolean
  error: string | null
  isDirty: boolean
}

function SectionFooter({ saving, saved, error, isDirty }: SectionFooterProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
      <div className="min-h-[1.25rem] text-xs">
        {error ? (
          <span className="text-accent-danger">{error}</span>
        ) : saved ? (
          <span className="text-accent-success">Saved</span>
        ) : isDirty ? (
          <span className="text-text-muted">Unsaved changes</span>
        ) : null}
      </div>
      <Button type="submit" variant="aurora" size="sm" disabled={saving}>
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        Save
      </Button>
    </div>
  )
}

function OnboardingPrompt() {
  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-surface p-8">
      <span aria-hidden="true" className="aurora-bg absolute inset-x-0 top-0 h-[2px]" />
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-line-strong bg-surface-elevated">
            <GraduationCap className="h-6 w-6 text-accent-primary" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold tracking-[-0.02em] text-text-primary">
              Complete your teacher profile
            </h3>
            <p className="mt-1 max-w-md text-sm text-text-muted">
              You haven&apos;t finished onboarding yet, so there&apos;s no profile to edit. Finish onboarding to add
              your education, subjects, and pricing first.
            </p>
          </div>
        </div>
        <Link href="/teacher/onboarding" className="shrink-0">
          <Button variant="aurora">
            Start Onboarding <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  )
}

const STATUS_BADGE_VARIANT: Record<string, "warning" | "success" | "destructive" | "secondary"> = {
  pending: "warning",
  approved: "success",
  rejected: "destructive",
  suspended: "destructive",
}

function StatusBadges({ teacher }: { teacher: Teacher }) {
  const status = teacher.status ?? "pending"
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-text-muted" />
        <span className="text-xs text-text-muted">Approval status</span>
        <Badge variant={STATUS_BADGE_VARIANT[status] ?? "secondary"} className="capitalize">
          {status}
        </Badge>
      </div>
      <div className="flex items-center gap-2">
        <Star className="h-4 w-4 text-text-muted" />
        <span className="text-xs text-text-muted">Rating</span>
        <span className="font-mono text-sm tabular-nums text-text-primary">
          {(teacher.average_rating ?? 0).toFixed(1)} ({teacher.total_reviews ?? 0} reviews)
        </span>
      </div>
      <p className="text-xs text-text-muted sm:flex-1">
        Approval status, featured placement, and rating are controlled by Hayesh admin and update automatically —
        they can&apos;t be edited here.
      </p>
    </div>
  )
}

function PersonalInfoSection({ userId, initial }: { userId: string; initial: ProfileFields }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<PersonalInfoValues>({
    resolver: zodResolver(personalInfoSchema),
    defaultValues: {
      full_name: initial.full_name || "",
      phone: initial.phone || "",
      country: initial.country || "",
      city: initial.city || "",
      bio: initial.bio || "",
    },
  })

  const { saving, saved, error, run } = useSectionSave<PersonalInfoValues>(async (values) => {
    const supabase = createClient()
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        full_name: values.full_name,
        phone: values.phone || null,
        country: values.country || null,
        city: values.city || null,
        bio: values.bio || null,
      })
      .eq("id", userId)
    return { error: updateError?.message ?? null }
  })

  return (
    <form onSubmit={handleSubmit(run)} className="space-y-4 rounded-lg border border-border bg-surface p-4 sm:p-6">
      <div className="flex items-center gap-2">
        <UserCog className="h-4 w-4 text-accent-primary" />
        <h3 className="font-display text-base font-semibold text-text-primary">Personal Details</h3>
      </div>

      <div className="space-y-1.5">
        <Label>Email</Label>
        <Input value={initial.email} readOnly disabled />
        <p className="text-xs text-text-muted">Contact support to change the email on your account.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="t-full-name">Full Name</Label>
          <Input id="t-full-name" {...register("full_name")} />
          {errors.full_name && <p className="text-xs text-accent-danger">{errors.full_name.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="t-phone">Phone</Label>
          <Input id="t-phone" type="tel" placeholder="+92 3XX XXXXXXX" {...register("phone")} />
          {errors.phone && <p className="text-xs text-accent-danger">{errors.phone.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="t-country">Country</Label>
          <Input id="t-country" {...register("country")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="t-city">City</Label>
          <Input id="t-city" {...register("city")} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="t-bio">Bio</Label>
        <textarea
          id="t-bio"
          rows={4}
          {...register("bio")}
          className="flex w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition-all duration-300 focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
        />
        {errors.bio && <p className="text-xs text-accent-danger">{errors.bio.message}</p>}
      </div>

      <SectionFooter saving={saving} saved={saved} error={error} isDirty={isDirty} />
    </form>
  )
}

type PublicProfileInitial = Pick<Teacher, "display_name" | "tagline" | "profile_photo_url" | "intro_video_url">

function PublicProfileSection({ userId, initial }: { userId: string; initial: PublicProfileInitial }) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<PublicProfileValues>({
    resolver: zodResolver(publicProfileSchema),
    defaultValues: {
      display_name: initial.display_name || "",
      tagline: initial.tagline || "",
      profile_photo_url: initial.profile_photo_url || "",
      intro_video_url: initial.intro_video_url || "",
    },
  })
  const photoUrl = watch("profile_photo_url")
  const displayName = watch("display_name")

  const { saving, saved, error, run } = useSectionSave<PublicProfileValues>(async (values) => {
    const supabase = createClient()
    const { error: updateError } = await supabase
      .from("teachers")
      .update({
        display_name: values.display_name,
        tagline: values.tagline || null,
        profile_photo_url: values.profile_photo_url || null,
        intro_video_url: values.intro_video_url || null,
      })
      .eq("user_id", userId)
    return { error: updateError?.message ?? null }
  })

  return (
    <form onSubmit={handleSubmit(run)} className="space-y-4 rounded-lg border border-border bg-surface p-4 sm:p-6">
      <div className="flex items-center gap-2">
        <GraduationCap className="h-4 w-4 text-accent-primary" />
        <h3 className="font-display text-base font-semibold text-text-primary">Public Profile</h3>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line-strong bg-surface-elevated">
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
          <FileUpload
            bucket="teacher-photos"
            userId={userId}
            accept="image/png,image/jpeg,image/webp"
            maxSizeMB={5}
            label={photoUrl ? "Change photo" : "Upload photo"}
            hint="PNG, JPG or WEBP up to 5MB."
            onUploaded={(file) => setValue("profile_photo_url", file.url ?? "", { shouldValidate: true, shouldDirty: true })}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="t-display-name">Display Name</Label>
        <Input id="t-display-name" {...register("display_name")} />
        {errors.display_name && <p className="text-xs text-accent-danger">{errors.display_name.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="t-tagline">Tagline</Label>
        <Input id="t-tagline" placeholder="e.g. Physics PhD | 10+ years" {...register("tagline")} />
        {errors.tagline && <p className="text-xs text-accent-danger">{errors.tagline.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="t-intro-video">Intro Video URL</Label>
        <Input id="t-intro-video" placeholder="https://..." {...register("intro_video_url")} />
        {errors.intro_video_url && <p className="text-xs text-accent-danger">{errors.intro_video_url.message}</p>}
      </div>

      <SectionFooter saving={saving} saved={saved} error={error} isDirty={isDirty} />
    </form>
  )
}

type CredentialsInitial = Pick<Teacher, "education" | "experience">

function CredentialsSection({ userId, initial }: { userId: string; initial: CredentialsInitial }) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<CredentialsValues>({
    resolver: zodResolver(credentialsSchema),
    defaultValues: {
      education: initial.education?.length
        ? initial.education.map((e) => ({
            degree: e.degree,
            institution: e.institution,
            field: e.field,
            year: e.year != null ? String(e.year) : "",
          }))
        : [{ degree: "", institution: "", year: "", field: "" }],
      experience: initial.experience?.length
        ? initial.experience.map((e) => ({
            title: e.title,
            institution: e.institution,
            description: e.description,
            years: e.years != null ? String(e.years) : "",
          }))
        : [],
    },
  })
  const educationArray = useFieldArray({ control, name: "education" })
  const experienceArray = useFieldArray({ control, name: "experience" })

  const { saving, saved, error, run } = useSectionSave<CredentialsValues>(async (values) => {
    const supabase = createClient()
    const { error: updateError } = await supabase
      .from("teachers")
      .update({ education: values.education, experience: values.experience })
      .eq("user_id", userId)
    return { error: updateError?.message ?? null }
  })

  return (
    <form onSubmit={handleSubmit(run)} className="space-y-6 rounded-lg border border-border bg-surface p-4 sm:p-6">
      <div className="flex items-center gap-2">
        <GraduationCap className="h-4 w-4 text-accent-primary" />
        <h3 className="font-display text-base font-semibold text-text-primary">Education & Experience</h3>
      </div>

      <div className="space-y-3">
        <Label className="flex items-center gap-2">
          <BookOpen className="h-3.5 w-3.5" /> Education
        </Label>
        {educationArray.fields.map((field, index) => {
          const entryErrors = errors.education?.[index]
          return (
            <div key={field.id} className="space-y-3 rounded-lg border border-border bg-surface-elevated/40 p-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">
                  Education {index + 1}
                </span>
                {educationArray.fields.length > 1 && (
                  <button
                    type="button"
                    onClick={() => educationArray.remove(index)}
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
          onClick={() => educationArray.append({ degree: "", institution: "", year: "", field: "" })}
        >
          <Plus className="h-3.5 w-3.5" /> Add Education
        </Button>
      </div>

      <div className="space-y-3">
        <Label className="flex items-center gap-2">
          <Briefcase className="h-3.5 w-3.5" /> Experience
        </Label>
        {experienceArray.fields.map((field, index) => {
          const entryErrors = errors.experience?.[index]
          return (
            <div key={field.id} className="space-y-3 rounded-lg border border-border bg-surface-elevated/40 p-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">
                  Experience {index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => experienceArray.remove(index)}
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
                  <Input placeholder="2019 - 2023" {...register(`experience.${index}.years`)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <textarea
                  {...register(`experience.${index}.description`)}
                  rows={2}
                  className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition-all duration-300 focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
                />
              </div>
            </div>
          )
        })}
        {experienceArray.fields.length === 0 && (
          <p className="text-sm text-text-muted">No experience added yet — optional.</p>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => experienceArray.append({ title: "", institution: "", years: "", description: "" })}
        >
          <Plus className="h-3.5 w-3.5" /> Add Experience
        </Button>
      </div>

      <SectionFooter saving={saving} saved={saved} error={error} isDirty={isDirty} />
    </form>
  )
}

type TeachingInitial = Pick<Teacher, "subjects" | "availability" | "translation_languages" | "translation_enabled">

function TeachingSection({ userId, initial }: { userId: string; initial: TeachingInitial }) {
  const {
    register,
    control,
    watch,
    setValue,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<TeachingValues>({
    resolver: zodResolver(teachingSchema),
    defaultValues: {
      subjects: initial.subjects?.length ? initial.subjects : [{ subject: "", level: "beginner" }],
      availability: (initial.availability as Record<string, string[]> | null) ?? {},
      translation_languages: initial.translation_languages ?? [],
    },
  })
  const subjectsArray = useFieldArray({ control, name: "subjects" })
  const availability = watch("availability")
  const translationLanguages = watch("translation_languages")

  const { saving, saved, error, run } = useSectionSave<TeachingValues>(async (values) => {
    const supabase = createClient()
    const { error: updateError } = await supabase
      .from("teachers")
      .update({
        subjects: values.subjects,
        availability: values.availability,
        translation_languages: values.translation_languages,
      })
      .eq("user_id", userId)
    return { error: updateError?.message ?? null }
  })

  return (
    <form onSubmit={handleSubmit(run)} className="space-y-6 rounded-lg border border-border bg-surface p-4 sm:p-6">
      <div className="flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-accent-primary" />
        <h3 className="font-display text-base font-semibold text-text-primary">Subjects, Availability & Translation</h3>
      </div>

      <div className="space-y-3">
        <Label>Subjects</Label>
        {subjectsArray.fields.map((field, index) => {
          const entryErrors = errors.subjects?.[index]
          return (
            <div key={field.id} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-1.5">
                <Input placeholder="Mathematics" {...register(`subjects.${index}.subject`)} />
                {entryErrors?.subject && <p className="text-xs text-accent-danger">{entryErrors.subject.message}</p>}
              </div>
              <div className="w-full space-y-1.5 sm:w-40">
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
              {subjectsArray.fields.length > 1 && (
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  onClick={() => subjectsArray.remove(index)}
                  aria-label={`Remove subject ${index + 1}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )
        })}
        {typeof errors.subjects?.message === "string" && (
          <p className="text-xs text-accent-danger">{errors.subjects.message}</p>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => subjectsArray.append({ subject: "", level: "beginner" })}
        >
          <Plus className="h-3.5 w-3.5" /> Add Subject
        </Button>
      </div>

      <div className="space-y-1.5">
        <Label>Weekly Availability</Label>
        <AvailabilityGrid value={availability} onChange={(next) => setValue("availability", next, { shouldDirty: true })} />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Languages className="h-3.5 w-3.5 text-text-muted" />
          <Label>Translation Languages</Label>
        </div>
        <ChipInput
          values={translationLanguages}
          onChange={(next) => setValue("translation_languages", next, { shouldValidate: true, shouldDirty: true })}
          placeholder="Add a language code, e.g. en, ur, ar"
          maxItems={10}
          error={errors.translation_languages?.message}
        />
        <p className="text-xs text-text-muted">
          {initial.translation_enabled
            ? "Live translation is enabled for your sessions by Hayesh admin."
            : "Live translation is currently disabled for your account by Hayesh admin — these languages take effect once it's enabled."}
        </p>
      </div>

      <SectionFooter saving={saving} saved={saved} error={error} isDirty={isDirty} />
    </form>
  )
}

type PricingInitial = Pick<Teacher, "group_price_pkr" | "standard_price_pkr" | "private_price_pkr">

function PricingSection({ userId, initial }: { userId: string; initial: PricingInitial }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<PricingValues>({
    resolver: zodResolver(pricingSchema),
    defaultValues: {
      group_price_pkr: initial.group_price_pkr != null ? String(initial.group_price_pkr) : "",
      standard_price_pkr: initial.standard_price_pkr != null ? String(initial.standard_price_pkr) : "",
      private_price_pkr: initial.private_price_pkr != null ? String(initial.private_price_pkr) : "",
    },
  })

  const { saving, saved, error, run } = useSectionSave<PricingValues>(async (values) => {
    const supabase = createClient()
    const { error: updateError } = await supabase
      .from("teachers")
      .update({
        group_price_pkr: values.group_price_pkr ? parseInt(values.group_price_pkr, 10) : null,
        standard_price_pkr: values.standard_price_pkr ? parseInt(values.standard_price_pkr, 10) : null,
        private_price_pkr: values.private_price_pkr ? parseInt(values.private_price_pkr, 10) : null,
      })
      .eq("user_id", userId)
    return { error: updateError?.message ?? null }
  })

  return (
    <form onSubmit={handleSubmit(run)} className="space-y-4 rounded-lg border border-border bg-surface p-4 sm:p-6">
      <div className="flex items-center gap-2">
        <Wallet className="h-4 w-4 text-accent-primary" />
        <h3 className="font-display text-base font-semibold text-text-primary">Monthly Pricing (PKR)</h3>
      </div>
      <p className="text-sm text-text-muted">Leave a tier blank if you don&apos;t offer it. At least one is required.</p>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="t-group-price">Group (up to 5)</Label>
          <Input
            id="t-group-price"
            type="number"
            inputMode="numeric"
            className="font-mono tabular-nums"
            placeholder="5000"
            {...register("group_price_pkr")}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="t-standard-price">Standard (up to 3)</Label>
          <Input
            id="t-standard-price"
            type="number"
            inputMode="numeric"
            className="font-mono tabular-nums"
            placeholder="10000"
            {...register("standard_price_pkr")}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="t-private-price">Private (1-on-1)</Label>
          <Input
            id="t-private-price"
            type="number"
            inputMode="numeric"
            className="font-mono tabular-nums"
            placeholder="20000"
            {...register("private_price_pkr")}
          />
        </div>
      </div>
      {errors.group_price_pkr && <p className="text-xs text-accent-danger">{errors.group_price_pkr.message}</p>}

      <SectionFooter saving={saving} saved={saved} error={error} isDirty={isDirty} />
    </form>
  )
}

interface LoadedData {
  profile: ProfileFields
  teacher: Teacher
}

const EMPTY_PROFILE: ProfileFields = { full_name: "", email: "", phone: null, country: null, city: null, bio: null }

export function TeacherProfileEditor() {
  const { user } = useSupabase()
  const [loading, setLoading] = useState(true)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
  const [data, setData] = useState<LoadedData | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      try {
        const supabase = createClient()
        // `.maybeSingle()` (not `.single()`) on both — a teacher mid-onboarding
        // legitimately has zero `teachers` rows, and `.single()` would make
        // PostgREST return a 406 instead of null data.
        const [{ data: profileRow }, { data: teacherRow }] = await Promise.all([
          supabase
            .from("profiles")
            .select("full_name, email, phone, country, city, bio")
            .eq("id", user.id)
            .maybeSingle(),
          supabase.from("teachers").select("*").eq("user_id", user.id).maybeSingle(),
        ])

        if (cancelled) return

        if (!teacherRow) {
          setNeedsOnboarding(true)
          return
        }

        setData({
          profile: (profileRow as ProfileFields | null) ?? EMPTY_PROFILE,
          teacher: teacherRow as Teacher,
        })
      } catch {
        if (!cancelled) setNeedsOnboarding(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [user])

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-accent-primary" />
      </div>
    )
  }

  if (needsOnboarding || !data || !user) {
    return <OnboardingPrompt />
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Reveal>
        <div className="space-y-1">
          <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Teacher / Profile</p>
          <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] text-text-primary">Edit Profile</h2>
        </div>
      </Reveal>

      <StatusBadges teacher={data.teacher} />

      <PanelGroup title="Personal Details" className="space-y-6">
        <PersonalInfoSection userId={user.id} initial={data.profile} />
      </PanelGroup>

      <PanelGroup title="Public Profile" className="space-y-6">
        <PublicProfileSection userId={user.id} initial={data.teacher} />
      </PanelGroup>

      <PanelGroup title="Education & Experience" className="space-y-6">
        <CredentialsSection userId={user.id} initial={data.teacher} />
      </PanelGroup>

      <PanelGroup title="Teaching Details" className="space-y-6">
        <TeachingSection userId={user.id} initial={data.teacher} />
      </PanelGroup>

      <PanelGroup title="Pricing" className="space-y-6">
        <PricingSection userId={user.id} initial={data.teacher} />
      </PanelGroup>

      <PanelGroup title="Withdrawals" className="space-y-6">
        <PayoutAccountEditor />
      </PanelGroup>
    </div>
  )
}
