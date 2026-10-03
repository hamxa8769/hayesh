"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { GraduationCap, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { formatPKR } from "@/lib/utils/format"

export type EnrollTierKey = "group" | "standard" | "private"

export interface EnrollTierOption {
  key: EnrollTierKey
  label: string
  price: number
}

export interface EnrollModalProps {
  open: boolean
  onClose: () => void
  teacherId: string
  teacherName: string
  /** Only tiers that have a price. */
  tiers: EnrollTierOption[]
  subjects: Array<{ subject: string; level?: string }>
  /** Plan preselected when the modal opens (e.g. from a tier card). */
  initialTier?: EnrollTierKey
}

interface StudentOption {
  id: string
  full_name: string
}

const OTHER_CHILD = "__other__"
const CUSTOM_SUBJECT = "__custom__"

const fieldClass =
  "flex h-10 w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"

export function EnrollModal({ open, onClose, teacherId, teacherName, tiers, subjects, initialTier }: EnrollModalProps) {
  const router = useRouter()
  const prefersReducedMotion = useReducedMotion()
  const dialogRef = useRef<HTMLDivElement>(null)

  const [students, setStudents] = useState<StudentOption[]>([])
  const [tier, setTier] = useState<EnrollTierKey | "">("")
  const [childChoice, setChildChoice] = useState<string>(OTHER_CHILD)
  const [childName, setChildName] = useState("")
  const [subjectChoice, setSubjectChoice] = useState<string>(subjects.length > 0 ? "" : CUSTOM_SUBJECT)
  const [customSubject, setCustomSubject] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submittingRef = useRef(submitting)

  useEffect(() => {
    submittingRef.current = submitting
  }, [submitting])

  // Reset and load the signed-in parent's children each time the modal opens.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setError(null)
    setChildName("")
    setCustomSubject("")
    setSubjectChoice(subjects.length > 0 ? "" : CUSTOM_SUBJECT)
    setTier(initialTier && tiers.some((t) => t.key === initialTier) ? initialTier : tiers.length === 1 ? tiers[0].key : "")

    const loadStudents = async () => {
      try {
        const supabase = createClient()
        const { data: auth } = await supabase.auth.getUser()
        if (!auth.user) {
          if (!cancelled) {
            setStudents([])
            setChildChoice(OTHER_CHILD)
          }
          return
        }
        const { data } = await supabase.from("students").select("id, full_name").eq("parent_id", auth.user.id)
        if (cancelled) return
        const rows = (data || []) as StudentOption[]
        setStudents(rows)
        setChildChoice(rows.length > 0 ? rows[0].id : OTHER_CHILD)
      } catch {
        if (!cancelled) {
          setStudents([])
          setChildChoice(OTHER_CHILD)
        }
      }
    }
    loadStudents()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const frame = requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>("#enroll-plan")?.focus()
    })
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submittingRef.current) {
        setError(null)
        onClose()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("keydown", onKeyDown)
      previouslyFocused?.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const close = () => {
    if (submitting) return
    setError(null)
    onClose()
  }

  const selectedStudent = students.find((s) => s.id === childChoice) ?? null
  const resolvedChildName = (selectedStudent ? selectedStudent.full_name : childName).trim()
  const resolvedSubject = (subjectChoice === CUSTOM_SUBJECT ? customSubject : subjectChoice).trim()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    if (!tier) {
      setError("Choose a plan.")
      return
    }
    if (!resolvedChildName) {
      setError("Enter your child's name.")
      return
    }
    if (!resolvedSubject) {
      setError("Choose or enter a subject.")
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "tuition",
          teacher_id: teacherId,
          tier,
          child_name: resolvedChildName,
          subject: resolvedSubject,
          ...(selectedStudent ? { student_id: selectedStudent.id } : {}),
        }),
      })
      if (res.status === 401) {
        router.push(`/auth/login?redirect=/teachers/${teacherId}`)
        return
      }
      if (res.status === 403) {
        setError("Only parent accounts can enrol a child. Sign in with a parent account.")
        setSubmitting(false)
        return
      }
      const json = (await res.json().catch(() => null)) as { transaction_id?: string; error?: string } | null
      if (!res.ok || !json?.transaction_id) {
        setError(json?.error || "We couldn't start your enrolment. Please try again.")
        setSubmitting(false)
        return
      }
      router.push(`/checkout/${json.transaction_id}`)
    } catch {
      setError("Network error. Please try again.")
      setSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
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
            aria-labelledby="enroll-modal-title"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="glass relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border p-6 shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-accent-primary" />
                <h2 id="enroll-modal-title" className="font-display text-lg font-semibold text-text-primary">
                  Enrol with {teacherName}
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

            <p className="mt-2 text-sm text-text-muted">
              Book a free demo first if you haven&apos;t — you pay monthly upfront, cancel any time.
            </p>

            <form onSubmit={submit} className="mt-5 space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="enroll-plan" className="text-sm font-medium text-text-muted">Plan</label>
                <select
                  id="enroll-plan"
                  value={tier}
                  onChange={(e) => setTier(e.target.value as EnrollTierKey | "")}
                  className={fieldClass}
                >
                  <option value="" disabled>Select a plan</option>
                  {tiers.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label} — {formatPKR(t.price)} / month
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="enroll-child" className="text-sm font-medium text-text-muted">Child</label>
                {students.length > 0 && (
                  <select
                    id="enroll-child"
                    value={childChoice}
                    onChange={(e) => setChildChoice(e.target.value)}
                    className={fieldClass}
                  >
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>{s.full_name}</option>
                    ))}
                    <option value={OTHER_CHILD}>Other child…</option>
                  </select>
                )}
                {(students.length === 0 || childChoice === OTHER_CHILD) && (
                  <input
                    id={students.length === 0 ? "enroll-child" : undefined}
                    type="text"
                    value={childName}
                    onChange={(e) => setChildName(e.target.value)}
                    placeholder="Child's full name"
                    maxLength={100}
                    autoComplete="off"
                    className={fieldClass}
                  />
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="enroll-subject" className="text-sm font-medium text-text-muted">Subject</label>
                {subjects.length > 0 && (
                  <select
                    id="enroll-subject"
                    value={subjectChoice}
                    onChange={(e) => setSubjectChoice(e.target.value)}
                    className={fieldClass}
                  >
                    <option value="" disabled>Select a subject</option>
                    {subjects.map((s) => (
                      <option key={s.subject} value={s.subject}>
                        {s.subject}{s.level ? ` · ${s.level}` : ""}
                      </option>
                    ))}
                    <option value={CUSTOM_SUBJECT}>Other subject…</option>
                  </select>
                )}
                {subjectChoice === CUSTOM_SUBJECT && (
                  <input
                    id={subjects.length === 0 ? "enroll-subject" : undefined}
                    type="text"
                    value={customSubject}
                    onChange={(e) => setCustomSubject(e.target.value)}
                    placeholder="e.g. Mathematics"
                    maxLength={100}
                    autoComplete="off"
                    className={fieldClass}
                  />
                )}
              </div>

              {error && (
                <p role="alert" className="text-sm text-accent-danger">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={close} disabled={submitting}>
                  Cancel
                </Button>
                <Button type="submit" variant="aurora" disabled={submitting}>
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Continue to payment
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
