"use client"

import { forwardRef, useState, type ReactNode } from "react"
import Link from "next/link"

import { motion, AnimatePresence } from "framer-motion"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Mail, Lock, User, Phone, MapPin, ArrowRight, ArrowLeft, GraduationCap, Users, ShoppingBag, Search, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Reveal } from "@/components/motion/Reveal"
import { Stagger } from "@/components/motion/Stagger"
import { AuthScene } from "@/components/layout/AuthScene"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils/cn"

const step1Schema = z.object({ role: z.enum(["teacher", "parent", "seller", "buyer"]) })
const step2Schema = z.object({
  full_name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
  phone: z.string().optional(),
  country: z.string(),
}).refine((d) => d.password === d.confirmPassword, { message: "Passwords don't match", path: ["confirmPassword"] })

const roles = [
  { value: "teacher" as const, icon: GraduationCap, title: "Teacher", desc: "Share knowledge & earn" },
  { value: "parent" as const, icon: Users, title: "Parent", desc: "Find the best tutors" },
  { value: "seller" as const, icon: ShoppingBag, title: "Seller", desc: "Offer your services" },
  { value: "buyer" as const, icon: Search, title: "Buyer", desc: "Browse & hire talent" },
]

interface AuthFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  icon: ReactNode
  error?: string
}

const AuthField = forwardRef<HTMLInputElement, AuthFieldProps>(
  ({ label, icon, error, className, ...props }, ref) => (
    <div className="space-y-1.5">
      <label className="block font-mono text-xs uppercase tracking-[0.12em] text-text-muted">
        {label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
          {icon}
        </span>
        <Input ref={ref} className={cn("pl-10", className)} {...props} />
      </div>
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs text-accent-danger"
        >
          {error}
        </motion.p>
      )}
    </div>
  )
)
AuthField.displayName = "AuthField"

function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn("h-4 w-4 animate-spin", className)} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}

interface RoleOptionProps {
  icon: LucideIcon
  title: string
  description: string
  selected: boolean
  onSelect: () => void
}

function RoleOption({ icon: Icon, title, description, selected, onSelect }: RoleOptionProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "relative flex w-full flex-col items-center gap-3 rounded-lg border p-5 text-center transition-all duration-150",
        selected
          ? "border-accent-primary bg-surface-elevated shadow-[0_0_24px_rgba(39,196,160,0.25)]"
          : "border-border bg-surface hover:border-line-strong hover:bg-surface-elevated"
      )}
    >
      <div
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded transition-colors duration-150",
          selected ? "bg-accent-primary/15 text-accent-primary" : "bg-surface-elevated text-text-muted"
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className={cn("text-sm font-medium", selected ? "text-text-primary" : "text-text-muted")}>{title}</p>
        <p className="mt-0.5 text-xs text-text-disabled">{description}</p>
      </div>
    </button>
  )
}

export default function RegisterPage() {
  const [step, setStep] = useState(1)
  const [selectedRole, setSelectedRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const step1Form = useForm<z.infer<typeof step1Schema>>({ resolver: zodResolver(step1Schema) })
  const step2Form = useForm<z.infer<typeof step2Schema>>({
    resolver: zodResolver(step2Schema) as never,
    defaultValues: { country: "PK", full_name: "", email: "", password: "", confirmPassword: "" },
  })

  const supabase = createClient()

  const onSubmit = async (data: z.infer<typeof step2Schema>) => {
    setLoading(true); setError(null)
    const { error: authError } = await supabase.auth.signUp({
      email: data.email, password: data.password,
      options: { data: { role: selectedRole, full_name: data.full_name } },
    })
    if (authError) { setError(authError.message); setLoading(false); return }

    if (selectedRole === "teacher") {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: data.email, password: data.password })
      if (signInError) { window.location.href = "/auth/login?redirect=/teacher/onboarding"; return }
      window.location.href = "/teacher/onboarding"
    } else {
      window.location.href = "/auth/callback"
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <AuthScene />
      <Reveal className="w-full max-w-md">
        <div className="relative overflow-hidden rounded-lg border border-border bg-surface shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_8px_30px_rgba(0,0,0,0.5)]">
          <div className="aurora-bg absolute inset-x-0 top-0 h-[3px]" aria-hidden="true" />

          <div className="p-8 sm:p-10">
            <div className="mb-8 text-center">
              <Link href="/" className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-text-muted transition-colors hover:text-text-primary">
                Hayesh
              </Link>
              <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight text-text-primary">Create account</h1>
              <p className="mt-2 text-sm text-text-muted">Join the Hayesh platform</p>
            </div>

            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div key="s1" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
                  <p className="mb-4 font-mono text-xs uppercase tracking-[0.12em] text-text-disabled">Step 01 / 02 — Choose your role</p>

                  <Stagger className="mb-6 grid grid-cols-2 gap-3" staggerDelay={0.06}>
                    {roles.map((r) => (
                      <Reveal key={r.value}>
                        <RoleOption
                          icon={r.icon}
                          title={r.title}
                          description={r.desc}
                          selected={selectedRole === r.value}
                          onSelect={() => { setSelectedRole(r.value); step1Form.setValue("role", r.value) }}
                        />
                      </Reveal>
                    ))}
                  </Stagger>

                  {step1Form.formState.errors.role && (
                    <p className="mb-4 text-center text-sm text-accent-danger">{step1Form.formState.errors.role.message}</p>
                  )}
                  <Button type="button" variant="aurora" size="lg" onClick={() => selectedRole && setStep(2)} disabled={!selectedRole} className="w-full">
                    Continue <ArrowRight className="h-4 w-4" />
                  </Button>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div key="s2" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
                  <div className="mb-4 flex items-center justify-between">
                    <button type="button" onClick={() => setStep(1)} className="flex items-center gap-1 text-sm text-text-muted transition-colors hover:text-text-primary">
                      <ArrowLeft className="h-4 w-4" /> Back
                    </button>
                    <span className="rounded-full border border-accent-primary/30 bg-accent-primary/10 px-3 py-1 font-mono text-[11px] uppercase tracking-wide text-accent-primary">
                      {selectedRole}
                    </span>
                  </div>

                  <form onSubmit={step2Form.handleSubmit(onSubmit)} className="space-y-4">
                    <AuthField label="Full Name" placeholder="John Doe" autoComplete="name"
                      icon={<User className="h-4 w-4" />} error={step2Form.formState.errors.full_name?.message}
                      {...step2Form.register("full_name")} />
                    <AuthField label="Email" type="email" placeholder="you@example.com" autoComplete="email"
                      icon={<Mail className="h-4 w-4" />} error={step2Form.formState.errors.email?.message}
                      {...step2Form.register("email")} />
                    <div className="grid grid-cols-2 gap-3">
                      <AuthField label="Password" type="password" placeholder="••••••••" autoComplete="new-password"
                        icon={<Lock className="h-4 w-4" />} error={step2Form.formState.errors.password?.message}
                        {...step2Form.register("password")} />
                      <AuthField label="Confirm" type="password" placeholder="••••••••" autoComplete="new-password"
                        icon={<Lock className="h-4 w-4" />} error={step2Form.formState.errors.confirmPassword?.message}
                        {...step2Form.register("confirmPassword")} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <AuthField label="Phone" placeholder="+92 300 1234567" icon={<Phone className="h-4 w-4" />}
                        {...step2Form.register("phone")} />
                      <AuthField label="Country" placeholder="PK" icon={<MapPin className="h-4 w-4" />}
                        {...step2Form.register("country")} />
                    </div>

                    {error && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="rounded border border-accent-danger/30 bg-accent-danger/10 p-3 text-sm text-accent-danger">
                        {error}
                      </motion.div>
                    )}

                    <Button type="submit" variant="aurora" size="lg" disabled={loading} className="w-full">
                      {loading && <Spinner />}
                      {loading ? "Creating account..." : (<>Create Account <ArrowRight className="h-4 w-4" /></>)}
                    </Button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>

            <p className="mt-6 text-center text-sm text-text-muted">
              Already have an account?{" "}
              <Link href="/auth/login" className="font-medium text-accent-primary hover:text-accent-primary/80">Sign in</Link>
            </p>
          </div>
        </div>
      </Reveal>
    </div>
  )
}
