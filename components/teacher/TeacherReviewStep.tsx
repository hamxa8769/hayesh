"use client"

import type { UseFormReturn } from "react-hook-form"
import { DAYS, DOCUMENT_KIND_LABELS, SLOTS } from "@/components/teacher/onboarding-schema"
import type { OnboardingValues } from "@/components/teacher/onboarding-schema"

export interface TeacherReviewStepProps {
  form: UseFormReturn<OnboardingValues>
  email: string
}

const DAY_LABELS: Record<(typeof DAYS)[number], string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
}

function formatPKR(value?: string): string {
  const n = value ? parseInt(value, 10) : NaN
  return Number.isFinite(n) ? `₨${n.toLocaleString()}` : "Not set"
}

export function TeacherReviewStep({ form, email }: TeacherReviewStepProps) {
  const values = form.getValues()

  const availabilitySummary = DAYS.filter((day) => (values.availability[day] ?? []).length > 0).map((day) => ({
    day,
    slots: (values.availability[day] ?? []).filter((s) => (SLOTS as readonly string[]).includes(s)),
  }))

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-muted">Review your profile before submitting for approval.</p>

      <div className="rounded-lg border border-border bg-surface p-4">
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Profile</p>
        <h3 className="mt-1 font-display text-lg font-semibold text-text-primary">
          {values.display_name || "Untitled"}
        </h3>
        {values.tagline && <p className="text-sm text-text-muted">{values.tagline}</p>}
        <dl className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-text-muted">Email</dt>
            <dd className="text-text-primary">{email}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Phone</dt>
            <dd className="text-text-primary">{values.phone || "Not set"}</dd>
          </div>
        </dl>
        {values.languages.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {values.languages.map((lang) => (
              <span
                key={lang}
                className="rounded-full border border-border bg-surface-elevated px-2.5 py-0.5 text-xs text-text-muted"
              >
                {lang}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Education</p>
          <p className="mt-2 text-sm text-text-muted">
            {values.education.length} entr{values.education.length === 1 ? "y" : "ies"} added
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Experience</p>
          <p className="mt-2 text-sm text-text-muted">
            {values.experience.length} entr{values.experience.length === 1 ? "y" : "ies"} added
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Subjects</p>
        <p className="mt-2 text-sm text-text-primary">
          {values.subjects.map((s) => `${s.subject} (${s.level})`).join(", ") || "None added"}
        </p>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Documents</p>
        <p className="mt-2 text-sm text-text-muted">
          {values.documents.length === 0
            ? "None uploaded"
            : values.documents.map((d) => `${d.name} (${DOCUMENT_KIND_LABELS[d.kind]})`).join(", ")}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Pricing (PKR/mo)</p>
          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-text-muted">Group</dt>
              <dd className="font-mono tabular-nums text-text-primary">{formatPKR(values.group_price_pkr)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-muted">Standard</dt>
              <dd className="font-mono tabular-nums text-text-primary">{formatPKR(values.standard_price_pkr)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-muted">Private</dt>
              <dd className="font-mono tabular-nums text-text-primary">{formatPKR(values.private_price_pkr)}</dd>
            </div>
          </dl>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Availability</p>
          {availabilitySummary.length === 0 ? (
            <p className="mt-2 text-sm text-text-muted">No slots selected</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {availabilitySummary.map(({ day, slots }) => (
                <li key={day} className="text-text-primary">
                  <span className="text-text-muted">{DAY_LABELS[day]}:</span> {slots.join(", ")}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
