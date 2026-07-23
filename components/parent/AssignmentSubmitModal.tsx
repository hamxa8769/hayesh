"use client"

import { useEffect, useRef, useState } from "react"
import type { ChangeEvent } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { BookOpen, Loader2, Paperclip, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import type { Assignment, SubmissionAttachment } from "@/components/parent/ProgressFeed"

export interface AssignmentSubmitModalProps {
  open: boolean
  assignment: Assignment | null
  onClose: () => void
  onSubmit: (attachments: SubmissionAttachment[]) => Promise<{ error: string | null }>
}

const MAX_FILE_SIZE_MB = 10
const MAX_FILES = 5
const BUCKET = "homework-submissions"

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_")
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Submit-homework modal for /parent/progress.
 *
 * Uploads go straight to the private `homework-submissions` bucket
 * (migration 012) at `${student_id}/${assignment_id}/${uuid}-${filename}` —
 * storage RLS keys off that first path segment matching one of the parent's
 * own students, so any other prefix is rejected server-side regardless of
 * what this component sends. Once every selected file has uploaded
 * successfully (or none were selected), the resulting attachment list is
 * handed to `onSubmit`, which performs the actual `assignments` UPDATE —
 * sending only `status` / `submitted_at` / `submission_attachments`, the
 * three columns migration 011's guard trigger allows a parent to write.
 *
 * If any upload fails, submission is aborted before that update ever runs,
 * so the assignment never gets stuck half-submitted.
 */
export function AssignmentSubmitModal({ open, assignment, onClose, onSubmit }: AssignmentSubmitModalProps) {
  const prefersReducedMotion = useReducedMotion()
  const [note, setNote] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [fileError, setFileError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const submittingRef = useRef(submitting)
  const dialogRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    submittingRef.current = submitting
  }, [submitting])

  useEffect(() => {
    if (open) {
      setNote("")
      setFiles([])
      setFileError(null)
      setSubmitError(null)
    }
  }, [open, assignment])

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const frame = requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>("#assignment-submit-note")?.focus()
    })
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submittingRef.current) {
        onClose()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("keydown", onKeyDown)
      previouslyFocused?.focus()
    }
  }, [open, onClose])

  const close = () => {
    if (submitting) return
    setSubmitError(null)
    onClose()
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files
    e.target.value = ""
    if (!selected || selected.length === 0) return

    const incoming = Array.from(selected)
    const oversized = incoming.filter((f) => f.size > MAX_FILE_SIZE_MB * 1024 * 1024)
    const accepted = incoming.filter((f) => f.size <= MAX_FILE_SIZE_MB * 1024 * 1024)

    setFiles((prev) => {
      const combined = [...prev, ...accepted]
      if (combined.length > MAX_FILES) {
        setFileError(`You can attach up to ${MAX_FILES} files.`)
        return combined.slice(0, MAX_FILES)
      }
      if (oversized.length > 0) {
        setFileError(
          `${oversized.map((f) => f.name).join(", ")} ${oversized.length === 1 ? "exceeds" : "exceed"} ${MAX_FILE_SIZE_MB}MB and ${oversized.length === 1 ? "was" : "were"} not added.`
        )
      } else {
        setFileError(null)
      }
      return combined
    })
  }

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
    setFileError(null)
  }

  const handleSubmit = async () => {
    if (!assignment) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const uploaded: SubmissionAttachment[] = []

      if (files.length > 0) {
        const { createClient } = await import("@/lib/supabase/client")
        const supabase = createClient()

        for (const file of files) {
          const path = `${assignment.student_id}/${assignment.id}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`
          const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
            cacheControl: "3600",
            upsert: false,
          })
          if (uploadError) {
            throw new Error(`Couldn't upload ${file.name}: ${uploadError.message}`)
          }
          uploaded.push({
            type: "file",
            name: file.name,
            path,
            size: file.size,
            uploaded_at: new Date().toISOString(),
          })
        }
      }

      const trimmedNote = note.trim()
      const attachments: SubmissionAttachment[] = [
        ...uploaded,
        ...(trimmedNote ? ([{ type: "note", text: trimmedNote, created_at: new Date().toISOString() }] as const) : []),
      ]

      const { error } = await onSubmit(attachments)
      if (error) {
        setSubmitError(error)
        return
      }
      onClose()
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Something went wrong. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      {open && assignment && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.button
            aria-hidden="true"
            tabIndex={-1}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
          />

          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="assignment-submit-title"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="glass relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border p-6 shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-accent-primary" />
                <h2 id="assignment-submit-title" className="font-display text-lg font-semibold text-text-primary">
                  Submit Homework
                </h2>
              </div>
              <button
                onClick={close}
                aria-label="Close"
                className="rounded-md p-1 text-text-muted transition-colors hover:bg-surface-elevated hover:text-text-primary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-3 text-sm text-text-muted">
              Submitting <span className="text-text-primary">{assignment.title}</span>
              {assignment.subject ? ` for ${assignment.subject}` : ""}.
            </p>

            <div className="mt-5 space-y-1.5">
              <Label htmlFor="assignment-submit-note">Note (optional)</Label>
              <textarea
                id="assignment-submit-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={4}
                maxLength={1000}
                placeholder="Anything the teacher should know about this submission"
                className="flex w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition-all duration-300 focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
              />
            </div>

            <div className="mt-4 space-y-2">
              <Label htmlFor="assignment-submit-files">Attach files (optional)</Label>
              <input
                ref={fileInputRef}
                id="assignment-submit-files"
                type="file"
                multiple
                disabled={submitting || files.length >= MAX_FILES}
                onChange={handleFileChange}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={submitting || files.length >= MAX_FILES}
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="h-3.5 w-3.5" />
                Add Files
              </Button>
              <p className="text-xs text-text-muted">
                Up to {MAX_FILES} files, {MAX_FILE_SIZE_MB}MB each.
              </p>

              {files.length > 0 && (
                <ul className="space-y-1.5">
                  {files.map((file, i) => (
                    <li
                      key={`${file.name}-${i}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-elevated px-3 py-2"
                    >
                      <span className="min-w-0 truncate text-sm text-text-primary">{file.name}</span>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="font-mono text-xs tabular-nums text-text-muted">
                          {formatFileSize(file.size)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(i)}
                          disabled={submitting}
                          aria-label={`Remove ${file.name}`}
                          className="rounded p-0.5 text-text-muted transition-colors hover:bg-surface hover:text-accent-danger disabled:pointer-events-none disabled:opacity-50"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {fileError && <p className="text-xs text-accent-warning">{fileError}</p>}
            </div>

            {submitError && <p className="mt-3 text-sm text-accent-danger">{submitError}</p>}

            <div className="mt-5 flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={close} disabled={submitting}>
                Cancel
              </Button>
              <Button type="button" variant="aurora" onClick={handleSubmit} disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Mark as Submitted
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
