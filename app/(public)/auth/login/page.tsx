"use client"

import { useState, Suspense } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Mail, Lock, ArrowRight, Globe } from "lucide-react"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { JarvisInput } from "@/components/ui/jarvis-input"
import { JarvisButton } from "@/components/ui/jarvis-button"
import { JarvisDivider } from "@/components/ui/jarvis-divider"
import { JarvisTerminal } from "@/components/ui/jarvis-terminal"
import { createClient } from "@/lib/supabase/client"

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
})

type LoginForm = z.infer<typeof loginSchema>

const terminalLines = [
  "HAYESH JARVIS v1.0 — Authentication Module",
  "Initializing secure connection...",
  "Encryption: AES-256-GCM | Protocol: TLS 1.3",
  "System ready. Awaiting credentials.",
]

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get("redirect") || "/"
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const supabase = createClient()

  const onSubmit = async (data: LoginForm) => {
    setLoading(true)
    setError(null)

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    if (authData.user) {
      // Get role from profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", authData.user.id)
        .single()

      const roleRedirects: Record<string, string> = {
        admin: "/admin",
        teacher: "/teacher/dashboard",
        parent: "/parent/dashboard",
        seller: "/seller/dashboard",
        buyer: "/buyer/dashboard",
      }

      const dest = profile ? (roleRedirects[profile.role] || redirectTo) : redirectTo
      // Use hard redirect to ensure middleware reads fresh session cookies
      window.location.href = dest
    }
  }

  const signInWithGoogle = async () => {
    setGoogleLoading(true)
    setError(null)

    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect=${redirectTo}`,
      },
    })

    if (authError) {
      setError(authError.message)
      setGoogleLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <JarvisCard glow="violet" className="w-full p-8">
        <JarvisTerminal
          lines={terminalLines}
          className="mb-6 rounded-lg bg-background/50 p-3"
          speed={20}
          lineDelay={300}
        />

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <JarvisInput
            label="Email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            icon={<Mail className="h-4 w-4" />}
            error={errors.email?.message}
            {...register("email")}
          />

          <JarvisInput
            label="Password"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            icon={<Lock className="h-4 w-4" />}
            error={errors.password?.message}
            {...register("password")}
          />

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
            Sign In
            <ArrowRight className="h-4 w-4" />
          </JarvisButton>
        </form>

        <JarvisDivider label="or" className="my-6" />

        <JarvisButton
          variant="secondary"
          size="lg"
          loading={googleLoading}
          onClick={signInWithGoogle}
          className="w-full"
        >
          <Globe className="h-4 w-4" />
          Continue with Google
        </JarvisButton>

        <p className="mt-6 text-center text-sm text-text-muted">
          Don&apos;t have an account?{" "}
          <Link
            href="/auth/register"
            className="font-medium text-accent-secondary hover:text-accent-secondary/80 transition-colors"
          >
            Sign up
          </Link>
        </p>
      </JarvisCard>
    </motion.div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <JarvisCard glow="violet" className="w-full p-8">
            <JarvisTerminal
              lines={["Initializing authentication module..."]}
              className="rounded-lg bg-background/50 p-3"
              speed={20}
              lineDelay={300}
            />
          </JarvisCard>
        </motion.div>
      }
    >
      <LoginContent />
    </Suspense>
  )
}
