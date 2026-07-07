"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion } from "framer-motion"

function CallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get("redirect") || "/"
  const [status, setStatus] = useState("Authenticating...")

  useEffect(() => {
    const handle = async () => {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()

      const urlParams = new URLSearchParams(window.location.search)
      const code = urlParams.get("code")

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(window.location.search)
        if (error) {
          const { data: { session } } = await supabase.auth.getSession()
          if (!session) { setStatus("Authentication failed: " + error.message); return }
        }
      } else {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          const hash = new URLSearchParams(window.location.hash.substring(1))
          const at = hash.get("access_token")
          const rt = hash.get("refresh_token")
          if (at && rt) {
            const { error } = await supabase.auth.setSession({ access_token: at, refresh_token: rt })
            if (error) { setStatus("Session error: " + error.message); return }
          } else { setStatus("No active session found."); return }
        }
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setStatus("No user found."); return }

      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
      if (!profile) { setStatus("Profile not found."); return }

      const roleMap: Record<string, string> = { admin: "/admin", teacher: "/teacher/dashboard", parent: "/parent/dashboard", seller: "/seller/dashboard", buyer: "/buyer/dashboard" }
      window.location.href = roleMap[profile.role] || redirectTo
    }
    handle()
  }, [redirectTo, router, searchParams])

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className="flex min-h-screen items-center justify-center px-4">
      <div className="glass max-w-md rounded-2xl p-8 text-center">
        <div className="mb-4 flex justify-center gap-1">
          {[0, 1, 2].map((i) => (
            <motion.div key={i} className="h-2 w-2 rounded-full bg-accent-primary"
              animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} />
          ))}
        </div>
        <p className="text-sm text-text-muted">{status}</p>
      </div>
    </motion.div>
  )
}

export default function CallbackPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-text-muted">Loading...</div>}>
      <CallbackContent />
    </Suspense>
  )
}
