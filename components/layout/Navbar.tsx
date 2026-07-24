"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Menu, X, LayoutDashboard, LogOut } from "lucide-react"
import { JarvisButton } from "@/components/ui/jarvis-button"
import { ThemeToggle } from "@/components/ui/ThemeToggle"
import { NotificationBell } from "@/components/notifications/NotificationBell"
import { useSupabase } from "@/hooks/useSupabase"
import { cn } from "@/lib/utils/cn"
import type { UserRole } from "@/types/database"

const links = [
  { href: "/explore", label: "Explore" },
  { href: "/teachers", label: "Teachers" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/ai-services", label: "AI Services" },
]

const ROLE_HOME: Record<UserRole, string> = {
  admin: "/admin",
  teacher: "/teacher/dashboard",
  parent: "/parent/dashboard",
  seller: "/seller/dashboard",
  buyer: "/buyer/dashboard",
}

function getInitial(name: string | undefined, email: string | undefined): string {
  const source = name?.trim() || email?.trim() || "?"
  return source.charAt(0).toUpperCase()
}

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const router = useRouter()
  const { user, profile, loading, signOut } = useSupabase()
  const accountButtonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const isAuthed = !loading && Boolean(user)
  const dashboardHref = profile ? ROLE_HOME[profile.role] : "/"
  const initial = getInitial(profile?.full_name, user?.email)

  // Matches the Escape-closes / focus-into-overlay / focus-restored-on-close
  // pattern established in components/jarvis/JarvisWidget.tsx + JarvisPanel.tsx.
  useEffect(() => {
    if (!menuOpen) return
    const frame = requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLElement>("a, button")?.focus()
    })
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("keydown", onKeyDown)
      accountButtonRef.current?.focus()
    }
  }, [menuOpen])

  const handleSignOut = async () => {
    setMenuOpen(false)
    setMobileOpen(false)
    await signOut()
    router.push("/")
  }

  return (
    <nav className="glass-strong fixed top-0 z-50 w-full">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="font-display text-xl font-bold">
          <span className="aurora-text">H</span>
          <span className="text-text-primary">AYESH</span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-sm text-text-muted transition-colors hover:text-text-primary">
              {l.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <ThemeToggle />

          {/* Neutral placeholder while the session is still resolving — identical
              markup on server and first client render, so there is no hydration
              mismatch and no flash of the wrong auth state. */}
          {loading ? (
            <div className="flex items-center gap-3" aria-hidden="true">
              <div className="h-8 w-20 animate-pulse rounded-md bg-surface-elevated" />
              <div className="h-8 w-8 animate-pulse rounded-full bg-surface-elevated" />
            </div>
          ) : isAuthed ? (
            <div className="relative flex items-center gap-3">
              <Link href={dashboardHref}>
                <JarvisButton variant="secondary" size="sm">
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </JarvisButton>
              </Link>

              <NotificationBell isAuthed={isAuthed} />

              <button
                ref={accountButtonRef}
                onClick={() => setMenuOpen((o) => !o)}
                aria-label="Account menu"
                aria-expanded={menuOpen}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface-elevated font-mono text-xs font-semibold text-text-primary transition-colors hover:border-accent-primary/50 hover:shadow-[0_0_15px_rgba(39,196,160,0.3)]"
              >
                {initial}
              </button>

              <AnimatePresence>
                {menuOpen && (
                  <>
                    <button
                      aria-hidden="true"
                      tabIndex={-1}
                      className="fixed inset-0 z-40 cursor-default"
                      onClick={() => setMenuOpen(false)}
                    />
                    <motion.div
                      ref={menuRef}
                      role="menu"
                      aria-label="Account menu"
                      initial={{ opacity: 0, y: -6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.98 }}
                      transition={{ duration: 0.15 }}
                      className="glass absolute right-0 top-11 z-50 w-56 overflow-hidden rounded-lg border border-border shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
                    >
                      <div className="border-b border-border px-4 py-3">
                        <p className="truncate text-sm font-medium text-text-primary">
                          {profile?.full_name || "Your account"}
                        </p>
                        <p className="truncate font-mono text-xs text-text-muted">{user?.email}</p>
                      </div>
                      <Link
                        href={dashboardHref}
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-text-muted transition-colors hover:bg-surface-elevated hover:text-text-primary"
                      >
                        <LayoutDashboard className="h-4 w-4" /> Dashboard
                      </Link>
                      <button
                        onClick={handleSignOut}
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-text-muted transition-colors hover:bg-accent-danger/10 hover:text-accent-danger"
                      >
                        <LogOut className="h-4 w-4" /> Sign out
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <>
              <Link href="/auth/login">
                <JarvisButton variant="secondary" size="sm">Sign In</JarvisButton>
              </Link>
              <Link href="/auth/register">
                <JarvisButton variant="primary" size="sm">Get Started</JarvisButton>
              </Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-3 md:hidden">
          {isAuthed && <NotificationBell isAuthed={isAuthed} />}
          <button onClick={() => setMobileOpen(!mobileOpen)} className="text-text-muted">
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
            className="overflow-hidden border-t border-border md:hidden">
            <div className="space-y-2 px-6 py-4">
              {links.map((l) => (
                <Link key={l.href} href={l.href} onClick={() => setMobileOpen(false)}
                  className="block py-2 text-sm text-text-muted hover:text-text-primary">{l.label}</Link>
              ))}
              <div className="flex items-center gap-3 pt-2">
                <ThemeToggle />
                {loading ? (
                  <div className="flex flex-1 items-center gap-3" aria-hidden="true">
                    <div className="h-8 flex-1 animate-pulse rounded-md bg-surface-elevated" />
                  </div>
                ) : isAuthed ? (
                  <div className={cn("flex flex-1 flex-col gap-2")}>
                    <Link href={dashboardHref} onClick={() => setMobileOpen(false)}>
                      <JarvisButton variant="secondary" size="sm" className="w-full">
                        <LayoutDashboard className="h-4 w-4" /> Dashboard
                      </JarvisButton>
                    </Link>
                    <JarvisButton variant="danger" size="sm" className="w-full" onClick={handleSignOut}>
                      <LogOut className="h-4 w-4" /> Sign out
                    </JarvisButton>
                  </div>
                ) : (
                  <>
                    <Link href="/auth/login" onClick={() => setMobileOpen(false)} className="flex-1">
                      <JarvisButton variant="secondary" size="sm" className="w-full">Sign In</JarvisButton>
                    </Link>
                    <Link href="/auth/register" onClick={() => setMobileOpen(false)} className="flex-1">
                      <JarvisButton variant="primary" size="sm" className="w-full">Get Started</JarvisButton>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  )
}
