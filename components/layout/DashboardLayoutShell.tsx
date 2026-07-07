"use client"

import { useState, useEffect } from "react"
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
  const { user, profile, loading } = useSupabase()
  const router = useRouter()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth/login")
    }
    if (!loading && profile && !allowedRoles.includes(profile.role)) {
      router.push("/")
    }
  }, [user, profile, loading, router, allowedRoles])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
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
      </div>
    )
  }

  if (!user || !profile) return null

  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar
        role={role}
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
