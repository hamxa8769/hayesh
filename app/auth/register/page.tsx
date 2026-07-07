"use client"

import { useState } from "react"
import Link from "next/link"

import { motion, AnimatePresence } from "framer-motion"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Mail, Lock, User, Phone, MapPin, ArrowRight, ArrowLeft, GraduationCap, Users, ShoppingBag, Search } from "lucide-react"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { JarvisInput } from "@/components/ui/jarvis-input"
import { JarvisButton } from "@/components/ui/jarvis-button"
import { JarvisRoleCard } from "@/components/ui/jarvis-role-card"
import { createClient } from "@/lib/supabase/client"

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
  { value: "teacher" as const, icon: GraduationCap, title: "Teacher", desc: "Share knowledge & earn", glow: "violet" as const },
  { value: "parent" as const, icon: Users, title: "Parent", desc: "Find the best tutors", glow: "cyan" as const },
  { value: "seller" as const, icon: ShoppingBag, title: "Seller", desc: "Offer your services", glow: "green" as const },
  { value: "buyer" as const, icon: Search, title: "Buyer", desc: "Browse & hire talent", glow: "violet" as const },
]

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
    <div className="flex min-h-screen items-center justify-center px-4">
      <JarvisCard glow="cyan" className="w-full max-w-md p-8">
        <h1 className="mb-2 font-display text-2xl font-bold text-text-primary">Create Account</h1>
        <p className="mb-6 text-sm text-text-muted">Join the Hayesh platform</p>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div className="mb-6 grid grid-cols-2 gap-3">
                {roles.map((r) => (
                  <JarvisRoleCard key={r.value} icon={r.icon} title={r.title} description={r.desc}
                    selected={selectedRole === r.value} onClick={() => { setSelectedRole(r.value); step1Form.setValue("role", r.value) }}
                    glowColor={r.glow} />
                ))}
              </div>
              {step1Form.formState.errors.role && (
                <p className="mb-4 text-center text-sm text-accent-danger">{step1Form.formState.errors.role.message}</p>
              )}
              <JarvisButton variant="primary" size="lg" onClick={() => selectedRole && setStep(2)} disabled={!selectedRole} className="w-full">
                Continue <ArrowRight className="h-4 w-4" />
              </JarvisButton>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
              <div className="mb-4 flex items-center justify-between">
                <button onClick={() => setStep(1)} className="flex items-center gap-1 text-sm text-text-muted hover:text-text-primary">
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <span className="rounded-full bg-accent-primary/20 px-3 py-1 text-xs text-accent-primary">{selectedRole}</span>
              </div>

              <form onSubmit={step2Form.handleSubmit(onSubmit)} className="space-y-4">
                <JarvisInput label="Full Name" placeholder="John Doe" autoComplete="name"
                  icon={<User className="h-4 w-4" />} error={step2Form.formState.errors.full_name?.message}
                  {...step2Form.register("full_name")} />
                <JarvisInput label="Email" type="email" placeholder="you@example.com" autoComplete="email"
                  icon={<Mail className="h-4 w-4" />} error={step2Form.formState.errors.email?.message}
                  {...step2Form.register("email")} />
                <div className="grid grid-cols-2 gap-3">
                  <JarvisInput label="Password" type="password" placeholder="••••••••" autoComplete="new-password"
                    icon={<Lock className="h-4 w-4" />} error={step2Form.formState.errors.password?.message}
                    {...step2Form.register("password")} />
                  <JarvisInput label="Confirm" type="password" placeholder="••••••••" autoComplete="new-password"
                    icon={<Lock className="h-4 w-4" />} error={step2Form.formState.errors.confirmPassword?.message}
                    {...step2Form.register("confirmPassword")} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <JarvisInput label="Phone" placeholder="+92 300 1234567" icon={<Phone className="h-4 w-4" />}
                    {...step2Form.register("phone")} />
                  <JarvisInput label="Country" placeholder="PK" icon={<MapPin className="h-4 w-4" />}
                    {...step2Form.register("country")} />
                </div>

                {error && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="rounded-lg border border-accent-danger/30 bg-accent-danger/10 p-3 text-sm text-accent-danger">
                    {error}
                  </motion.div>
                )}

                <JarvisButton type="submit" variant="primary" size="lg" loading={loading} className="w-full">
                  Create Account <ArrowRight className="h-4 w-4" />
                </JarvisButton>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="mt-6 text-center text-sm text-text-muted">
          Already have an account?{" "}
          <Link href="/auth/login" className="font-medium text-accent-secondary hover:text-accent-secondary/80">Sign in</Link>
        </p>
      </JarvisCard>
    </div>
  )
}
