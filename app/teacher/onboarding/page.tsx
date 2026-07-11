"use client"

import { forwardRef, useState, useEffect } from "react"
import type { InputHTMLAttributes, ReactNode } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  GraduationCap, Briefcase, BookOpen, DollarSign, Calendar, User,
  ArrowRight, ArrowLeft, Plus, Trash2, CheckCircle, Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Pill } from "@/components/ui/pill"
import { cn } from "@/lib/utils/cn"
import { createClient } from "@/lib/supabase/client"

const schema = z.object({
  display_name: z.string().min(2),
  tagline: z.string().optional(),
  education: z.array(z.object({ degree: z.string().min(1), institution: z.string().min(1), year: z.string().optional(), field: z.string().optional() })).min(1),
  experience: z.array(z.object({ title: z.string().min(1), institution: z.string().optional(), years: z.string().optional(), description: z.string().optional() })),
  subjects: z.array(z.object({ subject: z.string().min(1), level: z.enum(["beginner", "intermediate", "advanced"]) })).min(1),
  group_price_pkr: z.string().optional(),
  standard_price_pkr: z.string().optional(),
  private_price_pkr: z.string().optional(),
  availability: z.record(z.string(), z.array(z.string())),
  languages: z.array(z.string()).min(1),
})

type Form = z.infer<typeof schema>
const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const
const SLOTS = ["morning", "afternoon", "evening", "night"] as const
const LEVELS = ["beginner", "intermediate", "advanced"] as const
const STEPS = [
  { label: "Profile", icon: User }, { label: "Education", icon: GraduationCap },
  { label: "Experience", icon: Briefcase }, { label: "Subjects", icon: BookOpen },
  { label: "Pricing", icon: DollarSign }, { label: "Availability", icon: Calendar },
  { label: "Review", icon: CheckCircle },
]

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: ReactNode
}

const Field = forwardRef<HTMLInputElement, FieldProps>(function Field({ label, error, icon, className, ...props }, ref) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="flex items-center gap-2 text-sm font-medium text-text-primary">
          {icon && <span className="text-accent-primary">{icon}</span>}
          {label}
        </label>
      )}
      <Input ref={ref} className={cn(error && "border-accent-danger/60 focus:border-accent-danger focus:ring-accent-danger/50", className)} {...props} />
      {error && <p className="text-xs text-accent-danger">{error}</p>}
    </div>
  )
})

export default function OnboardingPage() {
  const router = useRouter()
  const prefersReducedMotion = useReducedMotion()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      display_name: "", tagline: "", education: [{ degree: "", institution: "", year: "", field: "" }],
      experience: [], subjects: [{ subject: "", level: "beginner" }],
      group_price_pkr: "", standard_price_pkr: "", private_price_pkr: "",
      availability: {}, languages: ["English"],
    },
  })

  const { fields: eduFields, append: addEdu, remove: removeEdu } = useFieldArray({ control: form.control, name: "education" })
  const { fields: expFields, append: addExp, remove: removeExp } = useFieldArray({ control: form.control, name: "experience" })
  const { fields: subFields, append: addSub, remove: removeSub } = useFieldArray({ control: form.control, name: "subjects" })

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/auth/login"); return }
      const { data: p } = await supabase.from("profiles").select("full_name").eq("id", user.id).single()
      if (p?.full_name) form.setValue("display_name", p.full_name)
    }
    load()
  }, [router, form])

  const toggle = (day: string, slot: string) => {
    const cur = form.getValues("availability")
    const slots = cur[day] || []
    form.setValue("availability", { ...cur, [day]: slots.includes(slot) ? slots.filter((s: string) => s !== slot) : [...slots, slot] })
  }

  const onSubmit = async (data: Form) => {
    setLoading(true); setError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError("Not authenticated"); setLoading(false); return }
    const { error: e } = await supabase.from("teachers").insert({
      user_id: user.id, display_name: data.display_name, tagline: data.tagline || null,
      education: data.education, experience: data.experience, subjects: data.subjects,
      availability: data.availability,
      group_price_pkr: data.group_price_pkr ? parseInt(data.group_price_pkr) : null,
      standard_price_pkr: data.standard_price_pkr ? parseInt(data.standard_price_pkr) : null,
      private_price_pkr: data.private_price_pkr ? parseInt(data.private_price_pkr) : null,
      translation_languages: data.languages,
    })
    if (e) { setError(e.message); setLoading(false); return }
    router.push("/teacher/dashboard")
  }

  const canNext = () => {
    const v = form.getValues()
    switch (step) {
      case 0: return v.display_name.length >= 2
      case 1: return v.education.length > 0 && v.education.every((e) => e.degree && e.institution)
      case 3: return v.subjects.length > 0 && v.subjects.every((s) => s.subject)
      default: return true
    }
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-lg border border-border bg-surface p-8">
          <div className="mb-8 flex items-center justify-between">
            {STEPS.map((s, i) => (
              <div key={s.label} className="flex items-center">
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border font-mono text-xs font-bold transition-colors",
                    i < step
                      ? "border-accent-success bg-accent-success/20 text-accent-success"
                      : i === step
                        ? "border-accent-primary bg-accent-primary/20 text-accent-primary"
                        : "border-border text-text-disabled"
                  )}
                >
                  {i < step ? <CheckCircle className="h-4 w-4" /> : i + 1}
                </div>
                {i < STEPS.length - 1 && (
                  <div className={cn("mx-1 h-px w-4 sm:w-8", i < step ? "bg-accent-success" : "bg-border")} />
                )}
              </div>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={prefersReducedMotion ? false : { opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <h3 className="mb-4 font-display text-lg font-semibold tracking-[-0.02em] text-text-primary">{STEPS[step].label}</h3>

              {step === 0 && (
                <div className="space-y-4">
                  <Field label="Display Name" placeholder="Your teaching name" icon={<User className="h-4 w-4" />} error={form.formState.errors.display_name?.message} {...form.register("display_name")} />
                  <Field label="Tagline" placeholder="e.g. Physics PhD | 10+ years" icon={<GraduationCap className="h-4 w-4" />} {...form.register("tagline")} />
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-text-primary">Languages</label>
                    {form.watch("languages").map((_: string, i: number) => (
                      <div key={i} className="mb-2 flex gap-2">
                        <Input placeholder="Language" {...form.register(`languages.${i}`)} />
                        {form.watch("languages").length > 1 && (
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              const l = form.getValues("languages")
                              form.setValue("languages", l.filter((_: string, j: number) => j !== i))
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button type="button" variant="secondary" size="sm" onClick={() => form.setValue("languages", [...form.getValues("languages"), ""])}>
                      <Plus className="h-3.5 w-3.5" /> Add Language
                    </Button>
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-4">
                  {eduFields.map((f, i) => (
                    <div key={f.id} className="space-y-3 rounded-lg border border-border p-4">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs text-text-muted">Education #{i + 1}</span>
                        {eduFields.length > 1 && (
                          <Button type="button" variant="destructive" size="sm" onClick={() => removeEdu(i)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                      <Field label="Degree" placeholder="BSc, MSc, PhD" {...form.register(`education.${i}.degree`)} />
                      <Field label="Institution" placeholder="University name" {...form.register(`education.${i}.institution`)} />
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Field" placeholder="Physics" {...form.register(`education.${i}.field`)} />
                        <Field label="Year" placeholder="2020" {...form.register(`education.${i}.year`)} />
                      </div>
                    </div>
                  ))}
                  <Button type="button" variant="secondary" size="sm" onClick={() => addEdu({ degree: "", institution: "", year: "", field: "" })}>
                    <Plus className="h-3.5 w-3.5" /> Add Education
                  </Button>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  {expFields.map((f, i) => (
                    <div key={f.id} className="space-y-3 rounded-lg border border-border p-4">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs text-text-muted">Experience #{i + 1}</span>
                        <Button type="button" variant="destructive" size="sm" onClick={() => removeExp(i)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <Field label="Title" placeholder="Senior Tutor" {...form.register(`experience.${i}.title`)} />
                      <Field label="Institution" placeholder="School or org" {...form.register(`experience.${i}.institution`)} />
                      <Field label="Years" placeholder="3" {...form.register(`experience.${i}.years`)} />
                    </div>
                  ))}
                  <Button type="button" variant="secondary" size="sm" onClick={() => addExp({ title: "", institution: "", years: "", description: "" })}>
                    <Plus className="h-3.5 w-3.5" /> Add Experience
                  </Button>
                  {expFields.length === 0 && <p className="text-sm text-text-muted">No experience? You can skip this step.</p>}
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  {subFields.map((f, i) => (
                    <div key={f.id} className="flex items-end gap-3">
                      <div className="flex-1">
                        <Field label={i === 0 ? "Subject" : undefined} placeholder="Mathematics" {...form.register(`subjects.${i}.subject`)} />
                      </div>
                      <div className="w-40">
                        <label className="mb-1.5 block text-sm font-medium text-text-primary">Level</label>
                        <select
                          className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
                          {...form.register(`subjects.${i}.level`)}
                        >
                          {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                        </select>
                      </div>
                      {subFields.length > 1 && (
                        <Button type="button" variant="destructive" size="sm" onClick={() => removeSub(i)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button type="button" variant="secondary" size="sm" onClick={() => addSub({ subject: "", level: "beginner" })}>
                    <Plus className="h-3.5 w-3.5" /> Add Subject
                  </Button>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-4">
                  <p className="text-sm text-text-muted">Set monthly prices in PKR.</p>
                  <Field label="Group (up to 5) ₨/mo" placeholder="5000" {...form.register("group_price_pkr")} />
                  <Field label="Standard (up to 3) ₨/mo" placeholder="10000" {...form.register("standard_price_pkr")} />
                  <Field label="Private (1-on-1) ₨/mo" placeholder="20000" {...form.register("private_price_pkr")} />
                </div>
              )}

              {step === 5 && (
                <div className="space-y-3">
                  <p className="text-sm text-text-muted">Select available time slots.</p>
                  {DAYS.map((day) => {
                    const sel: string[] = form.watch(`availability.${day}`) || []
                    return (
                      <div key={day} className="flex items-center gap-3">
                        <span className="w-10 font-mono text-sm uppercase text-text-muted">{day}</span>
                        <div className="flex flex-wrap gap-2">
                          {SLOTS.map((slot) => (
                            <Pill key={slot} active={sel.includes(slot)} onClick={() => toggle(day, slot)}>
                              {slot}
                            </Pill>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {step === 6 && (
                <div className="space-y-3">
                  <p className="text-sm text-text-muted">Review before submitting.</p>
                  <div className="space-y-2 rounded-lg border border-border p-4 text-sm">
                    <p><span className="text-text-muted">Name:</span> <span className="text-text-primary">{form.watch("display_name")}</span></p>
                    <p><span className="text-text-muted">Subjects:</span> <span className="text-text-primary">{form.watch("subjects").map((s) => s.subject).join(", ")}</span></p>
                    <p><span className="text-text-muted">Languages:</span> <span className="text-text-primary">{form.watch("languages").join(", ")}</span></p>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {error && (
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-4 rounded-lg border border-accent-danger/30 bg-accent-danger/10 p-3 text-sm text-accent-danger"
            >
              {error}
            </motion.div>
          )}

          <div className="my-6 h-px bg-border" />

          <div className="flex items-center justify-between">
            <Button type="button" variant="outline" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <span className="font-mono text-xs tabular-nums text-text-muted">Step {step + 1}/{STEPS.length}</span>
            {step < STEPS.length - 1 ? (
              <Button type="button" variant="aurora" onClick={() => setStep(step + 1)} disabled={!canNext()}>
                Next <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button type="button" variant="aurora" onClick={form.handleSubmit(onSubmit)} disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Submit <CheckCircle className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
