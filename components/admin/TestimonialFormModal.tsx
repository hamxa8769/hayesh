"use client"

import { useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { Loader2, MessageSquareQuote, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils/cn"

export type TestimonialSubjectType = "teacher" | "seller"
export type TestimonialSource = "admin" | "imported"

export interface TestimonialRecord {
  id: string
  subject_type: TestimonialSubjectType
  subject_id: string
  author_name: string
  author_role: string | null
  rating: number | null
  body: string
  source: TestimonialSource
  is_published: boolean
}

interface SubjectOption {
  id: string
  display_name: string
}

const ratingSelectSchema = z
  .union([z.literal(""), z.literal("1"), z.literal("2"), z.literal("3"), z.literal("4"), z.literal("5")])
  .transform((v) => (v === "" ? null : Number(v)))

const formSchema = z.object({
  subject_type: z.enum(["teacher", "seller"]),
  subject_id: z.string().uuid("Choose a teacher or seller"),
  author_name: z.string().trim().min(2, "Author name must be at least 2 characters").max(80),
  author_role: z.string().trim().max(40),
  rating: ratingSelectSchema,
  body: z.string().trim().min(5, "Body must be at least 5 characters").max(1000),
  source: z.enum(["admin", "imported"]),
  is_published: z.boolean(),
})

type FormInput = z.input<typeof formSchema>
type FormValues = z.output<typeof formSchema>

const emptyValues: FormInput = {
  subject_type: "teacher",
  subject_id: "",
  author_name: "",
  author_role: "",
  rating: "",
  source: "admin",
  is_published: true,
  body: "",
}

function recordToFormValues(record: TestimonialRecord): FormInput {
  return {
    subject_type: record.subject_type,
    subject_id: record.subject_id,
    author_name: record.author_name,
    author_role: record.author_role ?? "",
    rating: record.rating ? (String(record.rating) as FormInput["rating"]) : "",
    source: record.source,
    is_published: record.is_published,
    body: record.body,
  }
}

const selectClassName =
  "flex h-10 w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-accent-primary/50 focus:border-accent-primary disabled:cursor-not-allowed disabled:opacity-50"

const textareaClassName =
  "flex w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-accent-primary/50 focus:border-accent-primary disabled:cursor-not-allowed disabled:opacity-50"

export interface TestimonialFormModalProps {
  open: boolean
  testimonial: TestimonialRecord | null
  onClose: () => void
  onSaved: () => void
}

export function TestimonialFormModal({ open, testimonial, onClose, onSaved }: TestimonialFormModalProps) {
  const prefersReducedMotion = useReducedMotion()
  const dialogRef = useRef<HTMLDivElement>(null)
  const submittingRef = useRef(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [teacherOptions, setTeacherOptions] = useState<SubjectOption[]>([])
  const [sellerOptions, setSellerOptions] = useState<SubjectOption[]>([])
  const [optionsLoading, setOptionsLoading] = useState(true)
  const [optionsError, setOptionsError] = useState<string | null>(null)
  const isEdit = Boolean(testimonial)

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: emptyValues,
    mode: "onBlur",
  })

  const subjectType = watch("subject_type")

  useEffect(() => {
    submittingRef.current = submitting
  }, [submitting])

  useEffect(() => {
    if (!open) return
    setSubmitError(null)
    reset(testimonial ? recordToFormValues(testimonial) : emptyValues)
  }, [open, testimonial, reset])

  useEffect(() => {
    if (!open) return
    let cancelled = false

    const loadOptions = async () => {
      setOptionsLoading(true)
      setOptionsError(null)
      try {
        const supabase = createClient()
        const [teachersRes, sellersRes] = await Promise.all([
          supabase.from("teachers").select("id, display_name").eq("status", "approved").order("display_name"),
          supabase.from("sellers").select("id, display_name").eq("status", "approved").order("display_name"),
        ])

        if (cancelled) return

        if (teachersRes.error) throw teachersRes.error
        if (sellersRes.error) throw sellersRes.error

        setTeacherOptions((teachersRes.data ?? []) as SubjectOption[])
        setSellerOptions((sellersRes.data ?? []) as SubjectOption[])
      } catch (e) {
        if (!cancelled) {
          setOptionsError(e instanceof Error ? e.message : "Could not load teachers/sellers")
        }
      } finally {
        if (!cancelled) setOptionsLoading(false)
      }
    }

    loadOptions()
    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const frame = requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>("#testimonial-author-name")?.focus()
    })
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submittingRef.current) onClose()
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

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const payload = { ...values, author_role: values.author_role || null }
      const res = await fetch("/api/admin/testimonials", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isEdit ? { id: testimonial!.id, ...payload } : payload),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to save testimonial")
      }
      onSaved()
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : "Something went wrong. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const subjectOptions = subjectType === "seller" ? sellerOptions : teacherOptions

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto p-3 py-6 sm:items-center sm:p-4">
          <motion.button
            aria-hidden="true"
            tabIndex={-1}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
          />

          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="testimonial-modal-title"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="glass relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-border shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
          >
            <div className="flex items-start justify-between gap-3 border-b border-border p-5 sm:p-6">
              <div className="flex items-center gap-2">
                <MessageSquareQuote className="h-5 w-5 text-accent-primary" />
                <h2 id="testimonial-modal-title" className="font-display text-lg font-semibold text-text-primary">
                  {isEdit ? "Edit Testimonial" : "New Testimonial"}
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

            <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-5 sm:p-6">
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="testimonial-subject-type">Profile type</Label>
                    <select
                      id="testimonial-subject-type"
                      className={selectClassName}
                      {...register("subject_type")}
                    >
                      <option value="teacher">Teacher</option>
                      <option value="seller">Seller</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="testimonial-subject-id">
                      {subjectType === "seller" ? "Seller" : "Teacher"}
                    </Label>
                    <select
                      id="testimonial-subject-id"
                      className={selectClassName}
                      disabled={optionsLoading}
                      {...register("subject_id")}
                    >
                      <option value="">{optionsLoading ? "Loading…" : "Select…"}</option>
                      {subjectOptions.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.display_name}
                        </option>
                      ))}
                    </select>
                    {errors.subject_id && <p className="text-xs text-accent-danger">{errors.subject_id.message}</p>}
                  </div>
                </div>

                {optionsError && <p className="text-xs text-accent-danger">Could not load profiles: {optionsError}</p>}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="testimonial-author-name">Author name</Label>
                    <Input id="testimonial-author-name" {...register("author_name")} placeholder="e.g. Amina R." />
                    {errors.author_name && <p className="text-xs text-accent-danger">{errors.author_name.message}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="testimonial-author-role">Author role (optional)</Label>
                    <Input
                      id="testimonial-author-role"
                      {...register("author_role")}
                      placeholder="e.g. Parent of Grade 8 student"
                    />
                    {errors.author_role && <p className="text-xs text-accent-danger">{errors.author_role.message}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="testimonial-rating">Rating (optional)</Label>
                    <select id="testimonial-rating" className={selectClassName} {...register("rating")}>
                      <option value="">No rating</option>
                      <option value="1">1 star</option>
                      <option value="2">2 stars</option>
                      <option value="3">3 stars</option>
                      <option value="4">4 stars</option>
                      <option value="5">5 stars</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="testimonial-source">Source</Label>
                    <select id="testimonial-source" className={selectClassName} {...register("source")}>
                      <option value="admin">Written by staff</option>
                      <option value="imported">Imported real quote</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="testimonial-body">Testimonial body</Label>
                  <textarea
                    id="testimonial-body"
                    rows={5}
                    className={textareaClassName}
                    placeholder="What did they say?"
                    {...register("body")}
                  />
                  {errors.body && <p className="text-xs text-accent-danger">{errors.body.message}</p>}
                </div>

                <label
                  htmlFor="testimonial-published"
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-surface p-3 text-sm text-text-primary"
                  )}
                >
                  <input
                    id="testimonial-published"
                    type="checkbox"
                    className="h-4 w-4 rounded border-border accent-accent-primary"
                    {...register("is_published")}
                  />
                  Published (visible on the public profile)
                </label>
              </div>

              {submitError && <p className="mt-4 text-sm text-accent-danger">{submitError}</p>}

              <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:justify-end">
                <Button type="button" variant="secondary" onClick={close} disabled={submitting}>
                  Cancel
                </Button>
                <Button type="submit" variant="aurora" disabled={submitting}>
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isEdit ? "Save changes" : "Create testimonial"}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
