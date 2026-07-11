"use client"

import { useState, useEffect, useCallback } from "react"
import { usePathname, useRouter } from "next/navigation"
import { DashboardSidebar } from "@/components/layout/DashboardSidebar"
import { DashboardHeader } from "@/components/layout/DashboardHeader"
import { useSupabase } from "@/hooks/useSupabase"
import { cn } from "@/lib/utils/cn"
import type { UserRole } from "@/types/database"
import { motion, useReducedMotion } from "framer-motion"

interface Props {
  role: UserRole
  title: string
  allowedRoles: UserRole[]
  children: React.ReactNode
}

export function DashboardLayoutShell({ role, title, allowedRoles, children }: Props) {
  const { user, profile, loading, refreshProfile } = useSupabase()
  const router = useRouter()
  const pathname = usePathname()
  const prefersReducedMotion = useReducedMotion()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [retries, setRetries] = useState(0)

  const retryProfile = useCallback(async () => {
    if (!loading && user && !profile && retries < 5) {
      await refreshProfile()
      setRetries((r) => r + 1)
    }
  }, [loading, user, profile, retries, refreshProfile])

  useEffect(() => {
    if (!loading && user && !profile && retries < 5) {
      const t = setTimeout(retryProfile, 500)
      return () => clearTimeout(t)
    }
  }, [loading, user, profile, retries, retryProfile])

  useEffect(() => {
    if (!loading && !user) router.push("/auth/login")
  }, [user, loading, router])

  useEffect(() => {
    if (!loading && profile && !allowedRoles.includes(profile.role)) router.push("/")
  }, [profile, loading, router, allowedRoles])

  if (loading || (!profile && retries < 5)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <motion.div key={i} className="h-2 w-2 rounded-full bg-accent-primary"
                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} />
            ))}
          </div>
          <p className="text-sm text-text-muted">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) return null
  const effectiveRole = profile?.role || role

  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar role={effectiveRole} collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)}
        mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <DashboardHeader title={title} role={effectiveRole} collapsed={collapsed} onMenuOpen={() => setMobileOpen(true)} />
      <main className="pt-16">
        <div className={cn("transition-[padding-left] duration-300 ease-out", collapsed ? "lg:pl-[92px]" : "lg:pl-[264px]")}>
          <motion.div
            key={pathname}
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="p-4 sm:p-6"
          >
            {children}
          </motion.div>
        </div>
      </main>
    </div>
  )
}
