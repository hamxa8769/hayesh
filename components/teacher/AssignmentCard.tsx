"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { BookOpen, CalendarDays, Loader2, Paperclip, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils/cn"
import { formatDate } from "@/lib/utils/format"
import {
  gradeAssignmentSchema,
  type AssignmentRow,
  type GradeAssignmentValues,
} from "@/components/teacher/teaching-schema"

export interface AssignmentCardProps {
  assignment: AssignmentRow
  onGraded: (id: string, values: GradeAssignmentValues) => void
  onReopened?: (id: string) => void
}

const STATUS_STYLE: Record<string, { label: string; className: string }> = {
  assigned: { label: "Assigned", className: "border-[#56B6FF]/30 bg-[#56B6FF]/10 text-[#56B6FF]" },
  submitted: { label: "Submitted", className: "border-transparent bg-accent-warning/20 text-accent-warning" },
  graded: { label: "Graded", className: "border-transparent bg-accent-success/20 text-accent-success" },
}

interface Attachment {
  name?: string
  url?: string
}

function asAttachments(value: unknown): Attachment[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is Attachment => typeof item === "object" && item !== null)
}

export function AssignmentCard({ assignment, onGraded, onReopened }: AssignmentCardProps) {
  const [grading, setGrading] = useState(false)
  const [gradeError, setGradeError] = useState<string | null>(null)
  const [reopening, setReopening] = useState(false)
  const [reopenError, setReopenError] = useState<string | null>(null)
  const style = STATUS_STYLE[assignment.status] ?? STATUS_STYLE.assigned
  const submissionAttachments = asAttachments(assignment.submission_attachments)
  const canReopen = assignment.status === "submitted" || assignment.status === "graded"

  const reopenAssignment = async () => {
    if (!window.confirm("Send this homework back to the student to edit? They'll be able to resubmit it.")) {
      return
    }
    setReopening(true)
    setReopenError(null)
    try {
      const res = await fetch("/api/teacher/assignments/reopen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignment_id: assignment.id }),
      })
      const json = (await res.json()) as { id?: string; error?: string }
      if (!res.ok) throw new Error(json.error ?? "Could not reopen this assignment")
      onReopened?.(assignment.id)
    } catch (e) {
      setReopenError(e instanceof Error ? e.message : "Could not reopen this assignment")
    } finally {
      setReopening(false)
    }
  }

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<GradeAssignmentValues>({
    resolver: zodResolver(gradeAssignmentSchema),
    defaultValues: { grade: assignment.grade ?? "", feedback: assignment.feedback ?? "" },
  })

  const submitGrade = async (values: GradeAssignmentValues) => {
    setGrading(true)
    setGradeError(null)
    try {
      const supabase = createClient()
      // Direct client update: the assigning teacher owns this row and
      // migration 011's enforce_assignment_write_scope trigger permits the
      // teacher to change grade/feedback/status freely (only the parent's
      // write path is restricted to submission fields).
      const { error } = await supabase
        .from("assignments")
        .update({ status: "graded", grade: values.grade, feedback: values.feedback || null })
        .eq("id", assignment.id)

      if (error) {
        setGradeError(error.message)
        return
      }
      onGraded(assignment.id, values)
    } catch (e) {
      setGradeError(e instanceof Error ? e.message : "Could not save grade. Please try again.")
    } finally {
      setGrading(false)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4 transition-colors hover:border-line-strong sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface-elevated">
            <BookOpen className="h-4 w-4 text-accent-primary" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium text-text-primary">{assignment.title}</p>
            <p className="truncate text-xs text-text-muted">
              {assignment.students?.full_name ?? "Student"}
              {assignment.subject ? ` · ${assignment.subject}` : ""}
            </p>
          </div>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 font-mono text-xs font-semibold uppercase tracking-wide",
            style.className
          )}
        >
          {style.label}
        </span>
      </div>

      {assignment.due_date && (
        <p className="mt-3 flex items-center gap-1.5 font-mono text-xs tabular-nums text-text-muted">
          <CalendarDays className="h-3.5 w-3.5" /> Due {formatDate(assignment.due_date)}
        </p>
      )}

      {assignment.instructions && (
        <p className="mt-2 whitespace-pre-wrap break-words text-sm text-text-muted">{assignment.instructions}</p>
      )}

      {assignment.status !== "assigned" && submissionAttachments.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {submissionAttachments.map((file, i) => (
            <a
              key={i}
              href={file.url ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-md border border-border bg-surface-elevated px-2.5 py-1 text-xs text-text-muted transition-colors hover:border-line-strong hover:text-text-primary"
            >
              <Paperclip className="h-3 w-3" /> {file.name ?? `Attachment ${i + 1}`}
            </a>
          ))}
        </div>
      )}

      {assignment.status === "graded" && (
        <div className="mt-4 space-y-1 rounded-md border border-border bg-surface-elevated p-3">
          <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">
            Grade <span className="text-accent-success">{assignment.grade}</span>
          </p>
          {assignment.feedback && <p className="text-sm text-text-muted">{assignment.feedback}</p>}
        </div>
      )}

      {assignment.status === "submitted" && (
        <form onSubmit={handleSubmit(submitGrade)} className="mt-4 space-y-3 border-t border-border pt-4">
          <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
            <div className="space-y-1.5">
              <Label htmlFor={`grade-${assignment.id}`}>Grade</Label>
              <input
                id={`grade-${assignment.id}`}
                {...register("grade")}
                placeholder="A, 9/10..."
                className="flex h-10 w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition-all duration-300 focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
              />
              {errors.grade && <p className="text-xs text-accent-danger">{errors.grade.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`feedback-${assignment.id}`}>Feedback (optional)</Label>
              <textarea
                id={`feedback-${assignment.id}`}
                {...register("feedback")}
                rows={2}
                placeholder="Notes for the student and parent"
                className="flex w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition-all duration-300 focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
              />
              {errors.feedback && <p className="text-xs text-accent-danger">{errors.feedback.message}</p>}
            </div>
          </div>
          {gradeError && <p className="text-xs text-accent-danger">{gradeError}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={reopening}
              onClick={reopenAssignment}
            >
              {reopening ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RotateCcw className="h-3.5 w-3.5" />
              )}
              Reopen for edits
            </Button>
            <Button type="submit" variant="aurora" size="sm" disabled={grading}>
              {grading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save Grade
            </Button>
          </div>
        </form>
      )}

      {canReopen && assignment.status === "graded" && (
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={reopening}
            onClick={reopenAssignment}
          >
            {reopening ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RotateCcw className="h-3.5 w-3.5" />
            )}
            Reopen for edits
          </Button>
        </div>
      )}

      {reopenError && <p className="mt-2 text-xs text-accent-danger">{reopenError}</p>}
    </div>
  )
}
