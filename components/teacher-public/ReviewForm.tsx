"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, LogIn, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { RatingStars } from "@/components/teacher-public/RatingStars"
import type { TeacherReview } from "@/types/database"

const reviewFormSchema = z.object({
  rating: z.number().int().min(1, "Pick a rating").max(5),
  comment: z.string().trim().max(1000, "Keep it under 1000 characters").optional(),
})

type ReviewFormValues = z.infer<typeof reviewFormSchema>

export interface ReviewFormProps {
  teacherId: string
  /** Called after a review is successfully inserted, so the page can bump
   * ReviewList's refreshKey and pick up the new review + recomputed average. */
  onSubmitted?: () => void
}

type ViewerState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "not-parent" }
  | { status: "already-reviewed"; review: TeacherReview }
  | { status: "can-review"; userId: string }

export function ReviewForm({ teacherId, onSubmitted }: ReviewFormProps) {
  const [viewer, setViewer] = useState<ViewerState>({ status: "loading" })
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewFormSchema),
    defaultValues: { rating: 0, comment: "" },
  })

  useEffect(() => {
    let cancelled = false

    const check = async () => {
      setViewer({ status: "loading" })
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        if (!cancelled) setViewer({ status: "signed-out" })
        return
      }

      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
      if (cancelled) return
      if (profile?.role !== "parent") {
        setViewer({ status: "not-parent" })
        return
      }

      // No unique constraint exists on (teacher_id, reviewer_id) in the
      // schema (see the task's table note), so duplicate reviews are only
      // prevented here in application logic: check for an existing review
      // by this reviewer before showing the form at all.
      const { data: existing } = await supabase
        .from("teacher_reviews")
        .select("*")
        .eq("teacher_id", teacherId)
        .eq("reviewer_id", user.id)
        .maybeSingle()

      if (cancelled) return

      setViewer(
        existing
          ? { status: "already-reviewed", review: existing as TeacherReview }
          : { status: "can-review", userId: user.id }
      )
    }

    check()
    return () => {
      cancelled = true
    }
  }, [teacherId])

  const submit = async (values: ReviewFormValues) => {
    if (viewer.status !== "can-review") return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const supabase = createClient()

      // reviewer_id comes from the authenticated session, matching the
      // "Reviewer can write their own review" RLS policy in migration 006
      // (`with check (reviewer_id = auth.uid())`) — never from client state.
      const { data, error } = await supabase
        .from("teacher_reviews")
        .insert({
          teacher_id: teacherId,
          reviewer_id: viewer.userId,
          rating: values.rating,
          comment: values.comment || null,
        })
        .select("*")
        .maybeSingle()

      if (error) {
        setSubmitError(error.message)
        return
      }

      // TODO(server): teachers.average_rating / total_reviews are stored
      // columns on public.teachers. A client cannot and must not update
      // another table's aggregate directly (RLS + column grants correctly
      // block that). Once a DB trigger (or a server route invoked after
      // insert) maintains those columns, the page can read them directly
      // again. Until then, the average shown on this page is computed live
      // from the fetched rows in ReviewList, not from teachers.average_rating.
      if (data) {
        setViewer({ status: "already-reviewed", review: data as TeacherReview })
      }
      reset()
      onSubmitted?.()
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Something went wrong. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (viewer.status === "loading") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-surface p-5 text-sm text-text-muted">
        <Loader2 className="h-4 w-4 animate-spin" /> Checking your account...
      </div>
    )
  }

  if (viewer.status === "signed-out") {
    return (
      <div className="rounded-lg border border-border bg-surface p-5 text-center">
        <p className="text-sm text-text-muted">Sign in as a parent to leave a review.</p>
        <Button asChild variant="secondary" className="mt-3">
          <Link href="/auth/login">
            <LogIn className="h-4 w-4" /> Sign in
          </Link>
        </Button>
      </div>
    )
  }

  if (viewer.status === "not-parent") {
    return (
      <div className="rounded-lg border border-border bg-surface p-5 text-center">
        <p className="text-sm text-text-muted">Only parent accounts can leave a teacher review.</p>
      </div>
    )
  }

  if (viewer.status === "already-reviewed") {
    return (
      <div className="rounded-lg border border-border bg-surface p-5">
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Your review</p>
        <RatingStars rating={viewer.review.rating} size="sm" className="mt-2" />
        {viewer.review.comment && (
          <p className="mt-2 text-sm leading-relaxed text-text-muted">{viewer.review.comment}</p>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4 rounded-lg border border-border bg-surface p-5">
      <div className="space-y-1.5">
        <Label>Your rating</Label>
        <Controller
          control={control}
          name="rating"
          render={({ field }) => (
            <RatingStars rating={field.value} interactive size="lg" label="Your rating" onChange={field.onChange} />
          )}
        />
        {errors.rating && <p className="text-xs text-accent-danger">{errors.rating.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="review-comment">Comment (optional)</Label>
        <textarea
          id="review-comment"
          rows={3}
          placeholder="How was your experience with this teacher?"
          {...register("comment")}
          className="flex w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition-all duration-300 focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
        />
        {errors.comment && <p className="text-xs text-accent-danger">{errors.comment.message}</p>}
      </div>

      {submitError && <p className="text-sm text-accent-danger">{submitError}</p>}

      <div className="flex justify-end">
        <Button type="submit" variant="aurora" disabled={submitting}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Submit Review
        </Button>
      </div>
    </form>
  )
}
