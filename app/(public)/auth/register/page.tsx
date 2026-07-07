"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  Mail,
  Lock,
  User,
  Phone,
  MapPin,
  ArrowRight,
  ArrowLeft,
  GraduationCap,
  Users,
  ShoppingBag,
  Search,
} from "lucide-react"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { JarvisInput } from "@/components/ui/jarvis-input"
import { JarvisButton } from "@/components/ui/jarvis-button"
import { JarvisRoleCard } from "@/components/ui/jarvis-role-card"
import { JarvisDivider } from "@/components/ui/jarvis-divider"
import { JarvisTerminal } from "@/components/ui/jarvis-terminal"
import { createClient } from "@/lib/supabase/client"

const step1Schema = z.object({
  role: z.enum(["teacher", "parent", "seller", "buyer"], {
    message: "Select a role to continue",
  }),
})

const step2Schema = z
  .object({
    full_name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Enter a valid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string(),
    phone: z.string().optional(),
    country: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  })

type Step1Form = z.infer<typeof step1Schema>
type Step2Form = z.infer<typeof step2Schema>

const roles = [
  {
    value: "teacher" as const,
    icon: GraduationCap,
    title: "Teacher",
    description: "Share knowledge & earn",
    glow: "violet" as const,
  },
  {
    value: "parent" as const,
    icon: Users,
    title: "Parent",
    description: "Find the best tutors",
    glow: "cyan" as const,
  },
  {
    value: "seller" as const,
    icon: ShoppingBag,
    title: "Seller",
    description: "Offer your services",
    glow: "green" as const,
  },
  {
    value: "buyer" as const,
    icon: Search,
    title: "Buyer",
    description: "Browse & hire talent",
    glow: "violet" as const,
  },
]

const terminalLines = [
  "HAYESH JARVIS v1.0 — Registration Protocol",
  "Scanning identity matrix...",
  "Choose your designation to proceed.",
]

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [selectedRole, setSelectedRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const step1Form = useForm<Step1Form>({
    resolver: zodResolver(step1Schema),
  })

  const step2Form = useForm<Step2Form>({
    resolver: zodResolver(step2Schema) as never,
    defaultValues: { country: "PK", full_name: "", email: "", password: "", confirmPassword: "" },
  })

  const supabase = createClient()

  const handleRoleSelect = (role: string) => {
    setSelectedRole(role)
    step1Form.setValue("role", role as "teacher" | "parent" | "seller" | "buyer")
  }

  const handleStep1Submit = () => {
    if (selectedRole) {
      setStep(2)
    }
  }

  const onSubmit = async (data: Step2Form) => {
    setLoading(true)
    setError(null)

    const { error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          role: selectedRole,
          full_name: data.full_name,
        },
      },
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    router.push("/auth/callback")
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <JarvisCard glow="cyan" className="w-full p-8">
        <JarvisTerminal
          lines={terminalLines}
          className="mb-6 rounded-lg bg-background/50 p-3"
          speed={20}
          lineDelay={300}
        />

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <p className="mb-4 text-sm text-text-muted">
                Select your role to get started:
              </p>
              <div className="grid grid-cols-2 gap-3 mb-6">
                {roles.map((role) => (
                  <JarvisRoleCard
                    key={role.value}
                    icon={role.icon}
                    title={role.title}
                    description={role.description}
                    selected={selectedRole === role.value}
                    onClick={() => handleRoleSelect(role.value)}
                    glowColor={role.glow}
                  />
                ))}
              </div>

              {step1Form.formState.errors.role && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mb-4 text-center text-sm text-accent-danger"
                >
                  {step1Form.formState.errors.role.message}
                </motion.p>
              )}

              <JarvisButton
                variant="primary"
                size="lg"
                onClick={handleStep1Submit}
                disabled={!selectedRole}
                className="w-full"
              >
                Continue
                <ArrowRight className="h-4 w-4" />
              </JarvisButton>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="mb-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex items-center gap-1 text-sm text-text-muted hover:text-text-primary transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
                <span className="rounded-full bg-accent-primary/20 px-3 py-1 text-xs text-accent-primary">
                  {selectedRole}
                </span>
              </div>

              <form onSubmit={step2Form.handleSubmit(onSubmit)} className="space-y-4">
                <JarvisInput
                  label="Full Name"
                  placeholder="John Doe"
                  autoComplete="name"
                  icon={<User className="h-4 w-4" />}
                  error={step2Form.formState.errors.full_name?.message}
                  {...step2Form.register("full_name")}
                />

                <JarvisInput
                  label="Email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  icon={<Mail className="h-4 w-4" />}
                  error={step2Form.formState.errors.email?.message}
                  {...step2Form.register("email")}
                />

                <div className="grid grid-cols-2 gap-3">
                  <JarvisInput
                    label="Password"
                    type="password"
                    placeholder="••••••••"
                    autoComplete="new-password"
                    icon={<Lock className="h-4 w-4" />}
                    error={step2Form.formState.errors.password?.message}
                    {...step2Form.register("password")}
                  />
                  <JarvisInput
                    label="Confirm"
                    type="password"
                    placeholder="••••••••"
                    autoComplete="new-password"
                    icon={<Lock className="h-4 w-4" />}
                    error={step2Form.formState.errors.confirmPassword?.message}
                    {...step2Form.register("confirmPassword")}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <JarvisInput
                    label="Phone (optional)"
                    placeholder="+92 300 1234567"
                    icon={<Phone className="h-4 w-4" />}
                    {...step2Form.register("phone")}
                  />
                  <JarvisInput
                    label="Country"
                    placeholder="PK"
                    icon={<MapPin className="h-4 w-4" />}
                    {...step2Form.register("country")}
                  />
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-lg border border-accent-danger/30 bg-accent-danger/10 p-3 text-sm text-accent-danger"
                  >
                    {error}
                  </motion.div>
                )}

                <JarvisButton
                  type="submit"
                  variant="primary"
                  size="lg"
                  loading={loading}
                  className="w-full"
                >
                  Create Account
                  <ArrowRight className="h-4 w-4" />
                </JarvisButton>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        <JarvisDivider label="or" className="my-6" />

        <Link href="/auth/login">
          <JarvisButton variant="secondary" size="lg" className="w-full">
            Already have an account? Sign in
          </JarvisButton>
        </Link>
      </JarvisCard>
    </motion.div>
  )
}
