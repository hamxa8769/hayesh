"use client"

import { Menu } from "lucide-react"
import { cn } from "@/lib/utils/cn"
import type { UserRole } from "@/types/database"

interface Props { title: string; role: UserRole; collapsed: boolean; onMenuOpen: () => void }

const roleLabels: Record<UserRole, string> = {
  admin: "Admin", teacher: "Teacher", parent: "Parent", seller: "Seller", buyer: "Buyer",
}

export function DashboardHeader({ title, role, collapsed, onMenuOpen }: Props) {
  const roleLabel = roleLabels[role]

  return (
    <header
      className={cn(
        "glass fixed top-0 z-30 flex h-16 w-full items-center justify-between border-b border-border px-6 transition-[padding-left] duration-300 ease-out",
        collapsed ? "lg:pl-[92px]" : "lg:pl-[264px]"
      )}
    >
      <div className="flex min-w-0 items-center gap-4">
        <button onClick={onMenuOpen} aria-label="Open menu" className="text-text-muted transition-colors hover:text-text-primary lg:hidden">
          <Menu className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-text-muted">{roleLabel}</p>
          <h1 className="truncate font-display text-lg font-bold text-text-primary">{title}</h1>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="hidden font-mono text-xs text-text-muted sm:inline">JARVIS v1.0</span>
        <div className="h-2 w-2 rounded-full bg-accent-success animate-pulse" />
      </div>
    </header>
  )
}
