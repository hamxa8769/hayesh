import { z } from "zod"

/**
 * Tiers a parent can request tutoring at. Matches the free-text
 * `student_requests.preferred_tier` column (migration 010) — constrained
 * here at the form layer since the DB column has no check constraint.
 */
export const PREFERRED_TIERS = ["group", "standard", "private"] as const
export type PreferredTier = (typeof PREFERRED_TIERS)[number]

export const PREFERRED_TIER_LABELS: Record<PreferredTier, string> = {
  group: "Group",
  standard: "Standard",
  private: "Private (1-on-1)",
}

function isPastDate(value: string): boolean {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return false
  return parsed.getTime() < Date.now()
}

/** Form schema for creating/editing a public.students row. */
export const studentSchema = z.object({
  full_name: z.string().trim().min(2, "At least 2 characters").max(120, "Keep it under 120 characters"),
  date_of_birth: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || isPastDate(value), { message: "Date of birth must be in the past" }),
  grade_level: z.string().trim().max(60, "Keep it under 60 characters").optional(),
  notes: z.string().trim().max(500, "Keep it under 500 characters").optional(),
})

export type StudentValues = z.infer<typeof studentSchema>

/** Form schema for creating/editing a public.student_requests row. */
export const requestSchema = z.object({
  student_id: z.string().trim().min(1, "Select a child"),
  subject: z.string().trim().min(1, "Subject is required").max(120, "Keep it under 120 characters"),
  preferred_tier: z.enum(PREFERRED_TIERS, { error: "Select a tier" }),
  notes: z.string().trim().max(500, "Keep it under 500 characters").optional(),
})

export type RequestValues = z.infer<typeof requestSchema>

// ---------------------------------------------------------------------------
// DB row shapes for public.students / public.student_requests (migration 010).
// Not yet present in types/database.ts, so they're defined locally here —
// this file is the single owner of the parent-facing student/request types.
// ---------------------------------------------------------------------------

export interface Student {
  id: string
  parent_id: string
  full_name: string
  date_of_birth: string | null
  grade_level: string | null
  notes: string | null
  created_by: string | null
  is_active: boolean | null
  created_at: string | null
  updated_at: string | null
}

export type StudentRequestStatus = "open" | "assigned" | "declined" | "cancelled"

export interface StudentRequest {
  id: string
  student_id: string
  parent_id: string
  subject: string
  preferred_tier: string | null
  notes: string | null
  status: StudentRequestStatus
  assigned_teacher_id: string | null
  assigned_by: string | null
  assigned_at: string | null
  created_at: string | null
  updated_at: string | null
}

/** Result shape of `.select('*, students(full_name), teachers(display_name)')`. */
export interface StudentRequestWithRelations extends StudentRequest {
  students: { full_name: string } | null
  teachers: { display_name: string } | null
}
