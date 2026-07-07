"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { JarvisTerminal } from "@/components/ui/jarvis-terminal"

const processingLines = [
  "HAYESH JARVIS v1.0 — Session Handler",
  "Authenticating credentials...",
  "Verifying identity tokens...",
  "Establishing secure session...",
  "Loading user profile...",
]

function CallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get("redirect") || "/"
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleCallback = async () => {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()

      // Try code exchange first (for OAuth)
      const urlParams = new URLSearchParams(window.location.search)
      const code = urlParams.get("code")

      if (code) {
        const { error: authError } = await supabase.auth.exchangeCodeForSession(
          window.location.search
        )
        if (authError) {
          // Code exchange might fail if already signed in, try getting session
          const { data: { session } } = await supabase.auth.getSession()
          if (!session) {
            setError(authError.message)
            return
          }
        }
      } else {
        // No code — check if already signed in (email signup/auto-confirm)
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          // Try hash-based auth (email confirmation links use #access_token)
          const hashParams = new URLSearchParams(window.location.hash.substring(1))
          const accessToken = hashParams.get("access_token")
          const refreshToken = hashParams.get("refresh_token")

          if (accessToken && refreshToken) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            })
            if (sessionError) {
              setError(sessionError.message)
              return
            }
          } else {
            setError("No active session found. Please sign in.")
            return
          }
        }
      }

      // Get user
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setError("No user found after authentication")
        return
      }

      // Get profile
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single()

      if (profileError || !profile) {
        // Profile might not exist yet (trigger hasn't fired), try signing in
        setError("Profile not found. Please try signing in.")
        return
      }

      const roleRedirects: Record<string, string> = {
        admin: "/admin",
        teacher: "/teacher/dashboard",
        parent: "/parent/dashboard",
        seller: "/seller/dashboard",
        buyer: "/buyer/dashboard",
      }

      router.push(roleRedirects[profile.role] || redirectTo)
      router.refresh()
    }

    handleCallback()
  }, [router, redirectTo, searchParams])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <JarvisCard glow="green" className="w-full p-8">
        <JarvisTerminal
          lines={error ? ["Authentication failed.", error] : processingLines}
          className="rounded-lg bg-background/50 p-3"
          speed={25}
          lineDelay={400}
        />

        {!error && (
          <motion.div
            className="mt-6 flex justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
          >
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="h-2 w-2 rounded-full bg-accent-success"
                  animate={{
                    scale: [1, 1.5, 1],
                    opacity: [0.5, 1, 0.5],
                  }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    delay: i * 0.2,
                  }}
                />
              ))}
            </div>
          </motion.div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-4 text-center"
          >
            <a
              href="/auth/login"
              className="text-sm text-accent-secondary hover:text-accent-secondary/80 transition-colors"
            >
              Return to sign in
            </a>
          </motion.div>
        )}
      </JarvisCard>
    </motion.div>
  )
}

export default function CallbackPage() {
  return (
    <Suspense
      fallback={
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <JarvisCard glow="green" className="w-full p-8">
            <JarvisTerminal
              lines={["Initializing session handler..."]}
              className="rounded-lg bg-background/50 p-3"
              speed={25}
              lineDelay={400}
            />
          </JarvisCard>
        </motion.div>
      }
    >
      <CallbackContent />
    </Suspense>
  )
}
