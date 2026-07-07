"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { DashboardSidebar } from "@/components/layout/DashboardSidebar"
import { DashboardHeader } from "@/components/layout/DashboardHeader"
import { useSupabase } from "@/hooks/useSupabase"
import { cn } from "@/lib/utils/cn"
import type { UserRole } from "@/types/database"
import { motion } from "framer-motion"

interface DashboardLayoutShellProps {
  role: UserRole
  title: string
  allowedRoles: UserRole[]
  children: React.ReactNode
}

export function DashboardLayoutShell({ role, title, allowedRoles, children }: DashboardLayoutShellProps) {
  const { user, profile, loading, refreshProfile } = useSupabase()
  const router = useRouter()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [retries, setRetries] = useState(0)

  // Retry profile fetch if missing (middleware may be creating it)
  const retryProfile = useCallback(async () => {
    if (!loading && user && !profile && retries < 5) {
      await refreshProfile()
      setRetries((r) => r + 1)
    }
  }, [loading, user, profile, retries, refreshProfile])

  useEffect(() => {
    if (!loading && user && !profile && retries < 5) {
      const timer = setTimeout(retryProfile, 500)
      return () => clearTimeout(timer)
    }
  }, [loading, user, profile, retries, retryProfile])

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth/login")
    }
  }, [user, loading, router])

  useEffect(() => {
    if (!loading && profile && !allowedRoles.includes(profile.role)) {
      router.push("/")
    }
  }, [profile, loading, router, allowedRoles])

  if (loading || (!profile && retries < 5)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="h-2 w-2 rounded-full bg-accent-primary"
                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </div>
          <p className="text-sm text-text-muted">Loading profile...</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  // Use layout prop role as fallback if profile fetch failed
  const effectiveRole = profile?.role || role

  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar
        role={effectiveRole}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <DashboardHeader
        title={title}
        sidebarCollapsed={sidebarCollapsed}
        onMobileMenuOpen={() => setMobileOpen(true)}
      />
      <main className="pt-16">
        <div className={cn("p-6 transition-all duration-200", sidebarCollapsed ? "lg:pl-20" : "lg:pl-72")}>
          {children}
        </div>
      </main>
    </div>
  )
}
