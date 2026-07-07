"use client"

import { Menu } from "lucide-react"

interface Props { title: string; onMenuOpen: () => void }

export function DashboardHeader({ title, onMenuOpen }: Props) {
  return (
    <header className="glass-strong fixed top-0 z-30 flex h-16 w-full items-center justify-between border-b border-border px-6">
      <div className="flex items-center gap-4">
        <button onClick={onMenuOpen} className="lg:hidden text-text-muted hover:text-text-primary">
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="font-display text-lg font-bold text-text-primary">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs font-mono text-text-muted">JARVIS v1.0</span>
        <div className="h-2 w-2 rounded-full bg-accent-success animate-pulse" />
      </div>
    </header>
  )
}
