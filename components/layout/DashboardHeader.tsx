"use client"

import { Menu, Bell, Command } from "lucide-react"
import { cn } from "@/lib/utils/cn"

interface DashboardHeaderProps {
  title: string
  sidebarCollapsed: boolean
  onMobileMenuOpen: () => void
}

export function DashboardHeader({ title, sidebarCollapsed, onMobileMenuOpen }: DashboardHeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-surface/60 backdrop-blur-xl px-6 transition-all duration-200",
        sidebarCollapsed ? "lg:pl-20" : "lg:pl-72"
      )}
    >
      <button
        onClick={onMobileMenuOpen}
        className="lg:hidden text-text-muted hover:text-text-primary"
      >
        <Menu className="h-5 w-5" />
      </button>

      <h1 className="font-display text-xl font-semibold text-text-primary">
        {title}
      </h1>

      <div className="ml-auto flex items-center gap-3">
        <button className="relative p-2 text-text-muted hover:text-text-primary transition-colors">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-accent-danger" />
        </button>
        <button className="hidden sm:flex items-center gap-2 rounded-lg border border-border bg-surface-elevated px-3 py-1.5 text-sm text-text-muted hover:text-text-primary transition-colors">
          <Command className="h-3.5 w-3.5" />
          <span>JARVIS</span>
        </button>
      </div>
    </header>
  )
}
