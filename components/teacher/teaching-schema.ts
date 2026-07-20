import { z } from "zod"

/**
 * Shared types + Zod schemas for the teacher teaching-tools surface
 * (assignments, notes, announcements, support tickets) backed by migration
 * 011 (`assignments`, `teacher_notes`, `announcements`) and migration 010
 * (`support_tickets`, `support_ticket_messages`). Column names mirror the
 * migrations exactly — see supabase-migrations/010-*.sql and 011-*.sql.
 */

// ============================================================
// Assignments
// ============================================================

export const ASSIGNMENT_STATUS = ["assigned", "submitted", "graded"] as const
export type AssignmentStatus = (typeof ASSIGNMENT_STATUS)[number]

export interface AssignedStudent {
  id: string
  full_name: string
  grade_level: string | null
  parent_id: string
}

export interface AssignmentRow {
  id: string
  teacher_id: string
  student_id: string
  title: string
  instructions: string | null
  subject: string | null
  due_date: string | null
  attachments: unknown
  status: AssignmentStatus
  submitted_at: string | null
  submission_attachments: unknown
  grade: string | null
  feedback: string | null
  created_at: string
  updated_at: string
  students?: { full_name: string; grade_level: string | null } | null
}

function isNotInThePast(value: string | undefined): boolean {
  if (!value) return true
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return parsed >= today
}

/** Used both client-side (form validation) and server-side (app/api/teacher/assignments/route.ts). */
export const createAssignmentSchema = z.object({
  student_id: z.string().uuid("Select a student"),
  title: z.string().trim().min(2, "Title is too short").max(160, "Keep it under 160 characters"),
  instructions: z.string().trim().max(2000, "Keep it under 2000 characters").optional(),
  subject: z.string().trim().max(80, "Keep it under 80 characters").optional(),
  due_date: z
    .string()
    .optional()
    .refine(isNotInThePast, { message: "Due date can't be in the past" }),
})
export type CreateAssignmentValues = z.infer<typeof createAssignmentSchema>

export const gradeAssignmentSchema = z.object({
  grade: z.string().trim().min(1, "Enter a grade").max(20, "Keep it short"),
  feedback: z.string().trim().max(2000, "Keep it under 2000 characters").optional(),
})
export type GradeAssignmentValues = z.infer<typeof gradeAssignmentSchema>

// ============================================================
// Teacher notes
// ============================================================

export interface TeacherNoteRow {
  id: string
  teacher_id: string
  student_id: string
  parent_id: string
  body: string
  is_private: boolean
  created_at: string
  updated_at: string
}

export const noteSchema = z.object({
  body: z.string().trim().min(1, "Write something first").max(2000, "Keep it under 2000 characters"),
  is_private: z.boolean(),
})
export type NoteValues = z.infer<typeof noteSchema>

// ============================================================
// Announcements
// ============================================================

export const AUDIENCE_OPTIONS = [
  { value: "my_students", label: "My students only" },
  { value: "all", label: "Everyone on Hayesh" },
] as const

export type AnnouncementAudience = (typeof AUDIENCE_OPTIONS)[number]["value"]

export interface AnnouncementRow {
  id: string
  author_id: string
  audience: AnnouncementAudience
  title: string
  body: string
  published_at: string
  created_at: string
  updated_at: string
}

export const announcementSchema = z.object({
  title: z.string().trim().min(2, "Title is too short").max(160, "Keep it under 160 characters"),
  body: z.string().trim().min(10, "Say a bit more").max(5000, "Keep it under 5000 characters"),
  audience: z.enum(["my_students", "all"]),
})
export type AnnouncementValues = z.infer<typeof announcementSchema>

// ============================================================
// Support tickets
// ============================================================

export const SUPPORT_CATEGORY_OPTIONS = [
  { value: "account", label: "Account" },
  { value: "payments", label: "Payments" },
  { value: "students", label: "Students" },
  { value: "technical", label: "Technical issue" },
  { value: "other", label: "Other" },
] as const

export interface SupportTicketRow {
  id: string
  user_id: string
  subject: string
  category: string | null
  status: string
  priority: string
  assigned_admin_id: string | null
  created_at: string
  updated_at: string
  resolved_at: string | null
}

export interface SupportTicketMessageRow {
  id: string
  ticket_id: string
  sender_id: string
  body: string
  is_internal: boolean
  created_at: string
}

/** POST body for /api/support/tickets — the FIRST message body is `message`, distinct from the ticket `subject`. */
export const supportTicketSchema = z.object({
  subject: z.string().trim().min(2, "Subject is too short").max(160, "Keep it under 160 characters"),
  category: z.string().trim().max(60, "Keep it under 60 characters").optional(),
  message: z.string().trim().min(1, "Describe the issue").max(2000, "Keep it under 2000 characters"),
})
export type SupportTicketValues = z.infer<typeof supportTicketSchema>

export const SUPPORT_STATUS_LABEL: Record<string, string> = {
  open: "Open",
  pending: "Pending",
  resolved: "Resolved",
  closed: "Closed",
}
