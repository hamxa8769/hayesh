"use client"

import { useState, Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Mail, Lock, ArrowRight, Globe } from "lucide-react"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { JarvisInput } from "@/components/ui/jarvis-input"
import { JarvisButton } from "@/components/ui/jarvis-button"
import { JarvisDivider } from "@/components/ui/jarvis-divider"
import { createClient } from "@/lib/supabase/client"

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
})

function LoginForm() {
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get("redirect") || "/"
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors } } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: z.infer<typeof schema>) => {
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email: data.email, password: data.password })
    if (authError) { setError(authError.message); setLoading(false); return }

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", (await supabase.auth.getUser()).data.user?.id || "").single()
    const roleMap: Record<string, string> = { admin: "/admin", teacher: "/teacher/dashboard", parent: "/parent/dashboard", seller: "/seller/dashboard", buyer: "/buyer/dashboard" }
    window.location.href = profile ? (roleMap[profile.role] || redirectTo) : redirectTo
  }

  const signInWithGoogle = async () => {
    setGoogleLoading(true)
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback?redirect=${redirectTo}` } })
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <JarvisCard glow="violet" className="w-full max-w-md p-8">
        <h1 className="mb-2 font-display text-2xl font-bold text-text-primary">Sign In</h1>
        <p className="mb-6 text-sm text-text-muted">Welcome back to Hayesh</p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <JarvisInput label="Email" type="email" placeholder="you@example.com" autoComplete="email"
            icon={<Mail className="h-4 w-4" />} error={errors.email?.message} {...register("email")} />
          <JarvisInput label="Password" type="password" placeholder="••••••••" autoComplete="current-password"
            icon={<Lock className="h-4 w-4" />} error={errors.password?.message} {...register("password")} />

          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="rounded-lg border border-accent-danger/30 bg-accent-danger/10 p-3 text-sm text-accent-danger">
              {error}
            </motion.div>
          )}

          <JarvisButton type="submit" variant="primary" size="lg" loading={loading} className="w-full">
            Sign In <ArrowRight className="h-4 w-4" />
          </JarvisButton>
        </form>

        <JarvisDivider label="or" className="my-6" />

        <JarvisButton variant="secondary" size="lg" loading={googleLoading} onClick={signInWithGoogle} className="w-full">
          <Globe className="h-4 w-4" /> Continue with Google
        </JarvisButton>

        <p className="mt-6 text-center text-sm text-text-muted">
          Don&apos;t have an account?{" "}
          <Link href="/auth/register" className="font-medium text-accent-secondary hover:text-accent-secondary/80">Sign up</Link>
        </p>
      </JarvisCard>
    </motion.div>
  )
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Suspense fallback={<div className="text-text-muted">Loading...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  )
}
