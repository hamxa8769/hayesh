"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  GraduationCap, Briefcase, BookOpen, DollarSign, Calendar, User,
  ArrowRight, ArrowLeft, Plus, Trash2, CheckCircle, Globe,
} from "lucide-react"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { JarvisInput } from "@/components/ui/jarvis-input"
import { JarvisButton } from "@/components/ui/jarvis-button"
import { JarvisDivider } from "@/components/ui/jarvis-divider"
import { JarvisTerminal } from "@/components/ui/jarvis-terminal"
import { createClient } from "@/lib/supabase/client"

const educationSchema = z.object({
  degree: z.string().min(1, "Required"),
  institution: z.string().min(1, "Required"),
  year: z.string().optional(),
  field: z.string().optional(),
})

const experienceSchema = z.object({
  title: z.string().min(1, "Required"),
  institution: z.string().optional(),
  years: z.string().optional(),
  description: z.string().optional(),
})

const subjectSchema = z.object({
  subject: z.string().min(1, "Required"),
  level: z.enum(["beginner", "intermediate", "advanced"]),
})

const wizardSchema = z.object({
  display_name: z.string().min(2, "Name must be at least 2 characters"),
  tagline: z.string().optional(),
  bio: z.string().optional(),
  education: z.array(educationSchema).min(1, "Add at least one education entry"),
  experience: z.array(experienceSchema),
  subjects: z.array(subjectSchema).min(1, "Add at least one subject"),
  group_price_pkr: z.string().optional(),
  standard_price_pkr: z.string().optional(),
  private_price_pkr: z.string().optional(),
  availability: z.record(z.string(), z.array(z.string())),
  languages: z.array(z.string()).min(1, "Add at least one language"),
})

type WizardForm = z.infer<typeof wizardSchema>

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const
const TIME_SLOTS = ["morning", "afternoon", "evening", "night"] as const
const LEVELS = ["beginner", "intermediate", "advanced"] as const

const STEPS = [
  { label: "Profile", icon: User },
  { label: "Education", icon: GraduationCap },
  { label: "Experience", icon: Briefcase },
  { label: "Subjects", icon: BookOpen },
  { label: "Pricing", icon: DollarSign },
  { label: "Availability", icon: Calendar },
  { label: "Review", icon: CheckCircle },
]

const terminalLines = [
  "HAYESH JARVIS v1.0 — Teacher Onboarding",
  "Initializing profile wizard...",
  "Complete each section to activate your teacher profile.",
]

export default function TeacherOnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const form = useForm<WizardForm>({
    resolver: zodResolver(wizardSchema),
    defaultValues: {
      display_name: "",
      tagline: "",
      bio: "",
      education: [{ degree: "", institution: "", year: "", field: "" }],
      experience: [],
      subjects: [{ subject: "", level: "beginner" }],
      group_price_pkr: "",
      standard_price_pkr: "",
      private_price_pkr: "",
      availability: {},
      languages: ["English"],
    },
  })

  const {
    fields: eduFields,
    append: addEdu,
    remove: removeEdu,
  } = useFieldArray({ control: form.control, name: "education" })

  const {
    fields: expFields,
    append: addExp,
    remove: removeExp,
  } = useFieldArray({ control: form.control, name: "experience" })

  const {
    fields: subFields,
    append: addSub,
    remove: removeSub,
  } = useFieldArray({ control: form.control, name: "subjects" })

  useEffect(() => {
    const fetchProfile = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push("/auth/login")
        return
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single()
      if (profile?.full_name) {
        form.setValue("display_name", profile.full_name)
      }
    }
    fetchProfile()
  }, [router, form])

  const toggleAvailability = (day: string, slot: string) => {
    const current = form.getValues("availability")
    const daySlots = current[day] || []
    const updated = daySlots.includes(slot)
      ? daySlots.filter((s: string) => s !== slot)
      : [...daySlots, slot]
    form.setValue("availability", { ...current, [day]: updated })
  }

  const addLanguage = () => {
    const langs = form.getValues("languages")
    form.setValue("languages", [...langs, ""])
  }

  const removeLanguage = (index: number) => {
    const langs = form.getValues("languages")
    form.setValue("languages", langs.filter((_: string, i: number) => i !== index))
  }

  const onSubmit = async (data: WizardForm) => {
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError("Not authenticated")
      setLoading(false)
      return
    }

    const { error: insertError } = await supabase.from("teachers").insert({
      user_id: user.id,
      display_name: data.display_name,
      tagline: data.tagline || null,
      education: data.education,
      experience: data.experience,
      subjects: data.subjects,
      availability: data.availability,
      group_price_pkr: data.group_price_pkr ? parseInt(data.group_price_pkr) : null,
      standard_price_pkr: data.standard_price_pkr ? parseInt(data.standard_price_pkr) : null,
      private_price_pkr: data.private_price_pkr ? parseInt(data.private_price_pkr) : null,
      translation_languages: data.languages,
    })

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
      return
    }

    router.push("/teacher/dashboard")
  }

  const canNext = () => {
    const vals = form.getValues()
    switch (step) {
      case 0: return vals.display_name.length >= 2
      case 1: return vals.education.length > 0 && vals.education.every((e) => e.degree && e.institution)
      case 2: return true
      case 3: return vals.subjects.length > 0 && vals.subjects.every((s) => s.subject)
      case 4: return true
      case 5: return true
      case 6: return true
      default: return true
    }
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <JarvisCard glow="violet" className="p-8">
          <JarvisTerminal
            lines={terminalLines}
            className="mb-6 rounded-lg bg-background/50 p-3"
            speed={20}
            lineDelay={300}
          />

          {/* Step indicator */}
          <div className="mb-8 flex items-center justify-between">
            {STEPS.map((s, i) => (
              <div key={s.label} className="flex items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold transition-colors ${
                    i < step
                      ? "border-accent-success bg-accent-success/20 text-accent-success"
                      : i === step
                      ? "border-accent-primary bg-accent-primary/20 text-accent-primary"
                      : "border-border text-text-disabled"
                  }`}
                >
                  {i < step ? <CheckCircle className="h-4 w-4" /> : i + 1}
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`mx-1 h-px w-4 sm:w-8 ${i < step ? "bg-accent-success" : "bg-border"}`} />
                )}
              </div>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <h3 className="mb-4 font-display text-lg font-bold text-text-primary">
                {STEPS[step].label}
              </h3>

              {/* Step 0: Profile */}
              {step === 0 && (
                <div className="space-y-4">
                  <JarvisInput
                    label="Display Name"
                    placeholder="Your teaching name"
                    icon={<User className="h-4 w-4" />}
                    error={form.formState.errors.display_name?.message}
                    {...form.register("display_name")}
                  />
                  <JarvisInput
                    label="Tagline"
                    placeholder="e.g. Physics PhD | 10+ years experience"
                    icon={<GraduationCap className="h-4 w-4" />}
                    {...form.register("tagline")}
                  />
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-text-primary">Bio</label>
                    <textarea
                      className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm text-text-primary placeholder:text-text-disabled focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/50"
                      rows={4}
                      placeholder="Tell parents about yourself, your teaching philosophy, and what makes you unique..."
                      {...form.register("bio")}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-text-primary">Languages</label>
                    <div className="space-y-2">
                      {form.watch("languages").map((_: string, i: number) => (
                        <div key={i} className="flex gap-2">
                          <JarvisInput
                            placeholder="Language"
                            {...form.register(`languages.${i}`)}
                          />
                          {form.watch("languages").length > 1 && (
                            <JarvisButton variant="danger" size="sm" onClick={() => removeLanguage(i)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </JarvisButton>
                          )}
                        </div>
                      ))}
                      <JarvisButton variant="secondary" size="sm" onClick={addLanguage}>
                        <Plus className="h-3.5 w-3.5 mr-1" /> Add Language
                      </JarvisButton>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 1: Education */}
              {step === 1 && (
                <div className="space-y-4">
                  {eduFields.map((field, i) => (
                    <div key={field.id} className="rounded-lg border border-border p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-text-muted">Education #{i + 1}</span>
                        {eduFields.length > 1 && (
                          <JarvisButton variant="danger" size="sm" onClick={() => removeEdu(i)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </JarvisButton>
                        )}
                      </div>
                      <JarvisInput label="Degree" placeholder="e.g. BSc, MSc, PhD" {...form.register(`education.${i}.degree`)} />
                      <JarvisInput label="Institution" placeholder="University name" {...form.register(`education.${i}.institution`)} />
                      <div className="grid grid-cols-2 gap-3">
                        <JarvisInput label="Field" placeholder="e.g. Physics" {...form.register(`education.${i}.field`)} />
                        <JarvisInput label="Year" placeholder="e.g. 2020" {...form.register(`education.${i}.year`)} />
                      </div>
                    </div>
                  ))}
                  <JarvisButton variant="secondary" size="sm" onClick={() => addEdu({ degree: "", institution: "", year: "", field: "" })}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Education
                  </JarvisButton>
                </div>
              )}

              {/* Step 2: Experience */}
              {step === 2 && (
                <div className="space-y-4">
                  {expFields.map((field, i) => (
                    <div key={field.id} className="rounded-lg border border-border p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-text-muted">Experience #{i + 1}</span>
                        <JarvisButton variant="danger" size="sm" onClick={() => removeExp(i)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </JarvisButton>
                      </div>
                      <JarvisInput label="Title" placeholder="e.g. Senior Tutor" {...form.register(`experience.${i}.title`)} />
                      <JarvisInput label="Institution" placeholder="School or organization" {...form.register(`experience.${i}.institution`)} />
                      <JarvisInput label="Years" placeholder="e.g. 3" {...form.register(`experience.${i}.years`)} />
                      <JarvisInput label="Description" placeholder="What did you do?" {...form.register(`experience.${i}.description`)} />
                    </div>
                  ))}
                  <JarvisButton variant="secondary" size="sm" onClick={() => addExp({ title: "", institution: "", years: "", description: "" })}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Experience
                  </JarvisButton>
                  {expFields.length === 0 && (
                    <p className="text-sm text-text-muted">No experience yet? You can skip this step.</p>
                  )}
                </div>
              )}

              {/* Step 3: Subjects */}
              {step === 3 && (
                <div className="space-y-4">
                  {subFields.map((field, i) => (
                    <div key={field.id} className="flex items-end gap-3">
                      <div className="flex-1">
                        <JarvisInput label={i === 0 ? "Subject" : undefined} placeholder="e.g. Mathematics" {...form.register(`subjects.${i}.subject`)} />
                      </div>
                      <div className="w-40">
                        <label className="mb-1.5 block text-sm font-medium text-text-primary">Level</label>
                        <select
                          className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text-primary focus:border-accent-primary focus:outline-none"
                          {...form.register(`subjects.${i}.level`)}
                        >
                          {LEVELS.map((l) => (
                            <option key={l} value={l}>{l}</option>
                          ))}
                        </select>
                      </div>
                      {subFields.length > 1 && (
                        <JarvisButton variant="danger" size="sm" onClick={() => removeSub(i)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </JarvisButton>
                      )}
                    </div>
                  ))}
                  <JarvisButton variant="secondary" size="sm" onClick={() => addSub({ subject: "", level: "beginner" })}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Subject
                  </JarvisButton>
                </div>
              )}

              {/* Step 4: Pricing */}
              {step === 4 && (
                <div className="space-y-4">
                  <p className="text-sm text-text-muted">Set your monthly prices in PKR. Parents choose a tier when subscribing.</p>
                  <JarvisInput
                    label="Group (up to 5 students) — PKR/month"
                    placeholder="e.g. 5000"
                    icon={<span className="text-xs">₨</span>}
                    {...form.register("group_price_pkr")}
                  />
                  <JarvisInput
                    label="Standard (up to 3 students) — PKR/month"
                    placeholder="e.g. 10000"
                    icon={<span className="text-xs">₨</span>}
                    {...form.register("standard_price_pkr")}
                  />
                  <JarvisInput
                    label="Private (1-on-1) — PKR/month"
                    placeholder="e.g. 20000"
                    icon={<span className="text-xs">₨</span>}
                    {...form.register("private_price_pkr")}
                  />
                </div>
              )}

              {/* Step 5: Availability */}
              {step === 5 && (
                <div className="space-y-4">
                  <p className="text-sm text-text-muted">Select your available time slots for each day.</p>
                  <div className="space-y-3">
                    {DAYS.map((day) => {
                      const selected = form.watch(`availability.${day}`) || []
                      return (
                        <div key={day} className="flex items-center gap-3">
                          <span className="w-10 text-sm font-mono text-text-muted uppercase">{day}</span>
                          <div className="flex flex-wrap gap-2">
                            {TIME_SLOTS.map((slot) => (
                              <button
                                key={slot}
                                type="button"
                                onClick={() => toggleAvailability(day, slot)}
                                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                                  selected.includes(slot)
                                    ? "border-accent-primary bg-accent-primary/20 text-accent-primary"
                                    : "border-border text-text-muted hover:border-accent-primary/50"
                                }`}
                              >
                                {slot}
                              </button>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Step 6: Review */}
              {step === 6 && (
                <div className="space-y-4">
                  <p className="text-sm text-text-muted">Review your profile before submitting for admin approval.</p>
                  <div className="space-y-3 rounded-lg border border-border p-4">
                    <div>
                      <span className="text-xs text-text-muted">Name</span>
                      <p className="text-sm text-text-primary">{form.watch("display_name")}</p>
                    </div>
                    {form.watch("tagline") && (
                      <div>
                        <span className="text-xs text-text-muted">Tagline</span>
                        <p className="text-sm text-text-primary">{form.watch("tagline")}</p>
                      </div>
                    )}
                    <div>
                      <span className="text-xs text-text-muted">Education</span>
                      {form.watch("education").map((e, i) => (
                        <p key={i} className="text-sm text-text-primary">{e.degree} — {e.institution}</p>
                      ))}
                    </div>
                    <div>
                      <span className="text-xs text-text-muted">Subjects</span>
                      {form.watch("subjects").map((s, i) => (
                        <p key={i} className="text-sm text-text-primary">{s.subject} ({s.level})</p>
                      ))}
                    </div>
                    <div>
                      <span className="text-xs text-text-muted">Languages</span>
                      <p className="text-sm text-text-primary">{form.watch("languages").join(", ")}</p>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 rounded-lg border border-accent-danger/30 bg-accent-danger/10 p-3 text-sm text-accent-danger"
            >
              {error}
            </motion.div>
          )}

          <JarvisDivider className="my-6" />

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <JarvisButton
              variant="secondary"
              onClick={() => setStep(Math.max(0, step - 1))}
              disabled={step === 0}
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </JarvisButton>

            <span className="text-xs font-mono text-text-muted">
              Step {step + 1} of {STEPS.length}
            </span>

            {step < STEPS.length - 1 ? (
              <JarvisButton
                variant="primary"
                onClick={() => setStep(step + 1)}
                disabled={!canNext()}
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </JarvisButton>
            ) : (
              <JarvisButton
                variant="primary"
                onClick={form.handleSubmit(onSubmit)}
                loading={loading}
              >
                Submit Profile
                <CheckCircle className="h-4 w-4" />
              </JarvisButton>
            )}
          </div>
        </JarvisCard>
      </div>
    </div>
  )
}
