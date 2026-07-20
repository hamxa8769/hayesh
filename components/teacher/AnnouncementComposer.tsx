"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Megaphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"
import {
  announcementSchema,
  AUDIENCE_OPTIONS,
  type AnnouncementRow,
  type AnnouncementValues,
} from "@/components/teacher/teaching-schema"

export interface AnnouncementComposerProps {
  authorId: string
  onCreated: (row: AnnouncementRow) => void
}

const emptyValues: AnnouncementValues = { title: "", body: "", audience: "my_students" }

export function AnnouncementComposer({ authorId, onCreated }: AnnouncementComposerProps) {
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AnnouncementValues>({
    resolver: zodResolver(announcementSchema),
    defaultValues: emptyValues,
  })

  const submit = async (values: AnnouncementValues) => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const supabase = createClient()
      // Direct client insert: "Author manages own announcements" (migration
      // 011) is a `for all` policy scoped to author_id = auth.uid().
      const { data, error } = await supabase
        .from("announcements")
        .insert({ author_id: authorId, title: values.title, body: values.body, audience: values.audience })
        .select("*")
        .maybeSingle()

      if (error) {
        setSubmitError(error.message)
        return
      }
      if (!data) {
        setSubmitError("Announcement was not created")
        return
      }
      onCreated(data as AnnouncementRow)
      reset(emptyValues)
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Something went wrong. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <Megaphone className="h-4 w-4 text-accent-primary" />
        <h3 className="font-display text-base font-semibold text-text-primary">New Announcement</h3>
      </div>

      <form onSubmit={handleSubmit(submit)} className="mt-4 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="ann-title">Title</Label>
          <Input id="ann-title" {...register("title")} placeholder="e.g. No class this Friday" />
          {errors.title && <p className="text-xs text-accent-danger">{errors.title.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ann-body">Message</Label>
          <textarea
            id="ann-body"
            {...register("body")}
            rows={4}
            placeholder="Details for your students and their parents"
            className="flex w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition-all duration-300 focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
          />
          {errors.body && <p className="text-xs text-accent-danger">{errors.body.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ann-audience">Audience</Label>
          <select
            id="ann-audience"
            {...register("audience")}
            className="flex h-10 w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary transition-all duration-300 focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
          >
            {AUDIENCE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {submitError && <p className="text-sm text-accent-danger">{submitError}</p>}

        <div className="flex justify-end">
          <Button type="submit" variant="aurora" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Publish
          </Button>
        </div>
      </form>
    </div>
  )
}
