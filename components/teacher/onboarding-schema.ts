import { z } from "zod"

/**
 * Education entry shape — matches the `teachers.education` JSONB column
 * comment in supabase-schema.sql: [{ degree, institution, year, field }]
 */
export const educationEntrySchema = z.object({
  degree: z.string().trim().min(1, "Degree is required").max(120, "Keep it under 120 characters"),
  institution: z.string().trim().min(1, "Institution is required").max(160, "Keep it under 160 characters"),
  year: z.string().trim().max(9, "Keep it under 9 characters").optional(),
  field: z.string().trim().max(120, "Keep it under 120 characters").optional(),
})

/**
 * Experience entry shape — matches `teachers.experience` JSONB column
 * comment: [{ title, institution, years, description }]
 */
export const experienceEntrySchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(120, "Keep it under 120 characters"),
  institution: z.string().trim().max(160, "Keep it under 160 characters").optional(),
  years: z.string().trim().max(40, "Keep it under 40 characters").optional(),
  description: z.string().trim().max(400, "Keep it under 400 characters").optional(),
})

export const SUBJECT_LEVELS = ["beginner", "intermediate", "advanced"] as const
export type SubjectLevel = (typeof SUBJECT_LEVELS)[number]

/**
 * Subject entry shape — matches `teachers.subjects` JSONB column comment:
 * [{ subject, level: 'beginner'|'intermediate'|'advanced' }]
 */
export const subjectEntrySchema = z.object({
  subject: z.string().trim().min(1, "Subject is required").max(80, "Keep it under 80 characters"),
  level: z.enum(SUBJECT_LEVELS),
})

export const DOCUMENT_KINDS = ["id", "qualification", "certification", "other"] as const
export type DocumentKind = (typeof DOCUMENT_KINDS)[number]

export const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = {
  id: "ID Document",
  qualification: "Qualification",
  certification: "Certification",
  other: "Other",
}

/**
 * Matches the `{ name, path, kind }` shape stored in the new
 * `teachers.documents` jsonb column (migration 009).
 */
export const documentEntrySchema = z.object({
  name: z.string(),
  path: z.string(),
  kind: z.enum(DOCUMENT_KINDS),
})

const PHONE_REGEX = /^[+]?[0-9()\-\s]{7,20}$/

export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const
export const SLOTS = ["morning", "afternoon", "evening", "night"] as const

export const onboardingSchema = z.object({
  display_name: z.string().trim().min(2, "At least 2 characters").max(80, "Keep it under 80 characters"),
  tagline: z.string().trim().max(140, "Keep it under 140 characters").optional(),
  phone: z
    .string()
    .trim()
    .min(7, "Enter a valid phone number")
    .max(20, "Enter a valid phone number")
    .regex(PHONE_REGEX, "Enter a valid phone number"),
  profile_photo_url: z.string().trim().optional(),
  languages: z.array(z.string().trim().min(1)).min(1, "Add at least one language"),
  education: z.array(educationEntrySchema).min(1, "Add at least one education entry"),
  experience: z.array(experienceEntrySchema),
  subjects: z.array(subjectEntrySchema).min(1, "Add at least one subject"),
  documents: z.array(documentEntrySchema),
  group_price_pkr: z.string().trim().optional(),
  standard_price_pkr: z.string().trim().optional(),
  private_price_pkr: z.string().trim().optional(),
  availability: z.record(z.string(), z.array(z.string())),
})
  // A teacher with no rate on any tier is unbookable, and renders publicly as
  // "—" across every tier on the landing page and discovery grid, which reads
  // as broken. Each individual tier stays optional (a teacher may offer only
  // private tuition, say), but at least one must be priced.
  .refine(
    (values) =>
      Boolean(values.group_price_pkr?.trim()) ||
      Boolean(values.standard_price_pkr?.trim()) ||
      Boolean(values.private_price_pkr?.trim()),
    {
      message: "Set a monthly price for at least one tier",
      path: ["group_price_pkr"],
    },
  )

export type OnboardingValues = z.infer<typeof onboardingSchema>

export const STEP_LABELS = [
  "Profile",
  "Education",
  "Experience",
  "Subjects",
  "Documents",
  "Pricing",
  "Availability",
  "Review",
] as const

export const STEP_FIELDS: Record<number, (keyof OnboardingValues)[]> = {
  1: ["display_name", "tagline", "phone", "languages", "profile_photo_url"],
  2: ["education"],
  3: ["experience"],
  4: ["subjects"],
  5: ["documents"],
  6: ["group_price_pkr", "standard_price_pkr", "private_price_pkr"],
  7: ["availability"],
}
