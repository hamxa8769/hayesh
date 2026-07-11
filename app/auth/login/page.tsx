"use client"

import { forwardRef, useState, Suspense, type ReactNode } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Mail, Lock, ArrowRight, Globe } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { JarvisDivider } from "@/components/ui/jarvis-divider"
import { Reveal } from "@/components/motion/Reveal"
import { AuthScene } from "@/components/layout/AuthScene"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils/cn"

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
})

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
    <Reveal className="w-full max-w-md">
      <div className="relative overflow-hidden rounded-lg border border-border bg-surface shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_8px_30px_rgba(0,0,0,0.5)]">
        <div className="aurora-bg absolute inset-x-0 top-0 h-[3px]" aria-hidden="true" />

        <div className="p-8 sm:p-10">
          <div className="mb-8 text-center">
            <Link href="/" className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-text-muted transition-colors hover:text-text-primary">
              Hayesh
            </Link>
            <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight text-text-primary">Sign in</h1>
            <p className="mt-2 text-sm text-text-muted">Welcome back to your account</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <AuthField label="Email" type="email" placeholder="you@example.com" autoComplete="email"
              icon={<Mail className="h-4 w-4" />} error={errors.email?.message} {...register("email")} />
            <AuthField label="Password" type="password" placeholder="••••••••" autoComplete="current-password"
              icon={<Lock className="h-4 w-4" />} error={errors.password?.message} {...register("password")} />

            {error && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="rounded border border-accent-danger/30 bg-accent-danger/10 p-3 text-sm text-accent-danger">
                {error}
              </motion.div>
            )}

            <Button type="submit" variant="aurora" size="lg" disabled={loading} className="w-full">
              {loading && <Spinner />}
              {loading ? "Signing in..." : (<>Sign In <ArrowRight className="h-4 w-4" /></>)}
            </Button>
          </form>

          <JarvisDivider label="or" className="my-6" />

          <Button type="button" variant="outline" size="lg" disabled={googleLoading} onClick={signInWithGoogle} className="w-full">
            {googleLoading && <Spinner />}
            {googleLoading ? "Redirecting..." : (<><Globe className="h-4 w-4" /> Continue with Google</>)}
          </Button>

          <p className="mt-6 text-center text-sm text-text-muted">
            Don&apos;t have an account?{" "}
            <Link href="/auth/register" className="font-medium text-accent-primary hover:text-accent-primary/80">Sign up</Link>
          </p>
        </div>
      </div>
    </Reveal>
  )
}

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <AuthScene />
      <Suspense fallback={<div className="text-text-muted">Loading...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  )
}
