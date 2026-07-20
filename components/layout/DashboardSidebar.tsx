"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import {
  LayoutDashboard, Calendar, Users, Wallet, UserCog, Search,
  ShoppingBag, Package, MessageSquare, GraduationCap, Cpu, CreditCard,
  Globe, AlertTriangle, Settings, ChevronLeft, ChevronRight, LogOut, X,
} from "lucide-react"
import { cn } from "@/lib/utils/cn"
import { createClient } from "@/lib/supabase/client"
import type { UserRole } from "@/types/database"

interface NavItem { icon: React.ComponentType<{ className?: string }>; label: string; href: string }

const navItems: Record<UserRole, NavItem[]> = {
  admin: [
    { icon: LayoutDashboard, label: "Overview", href: "/admin" },
    { icon: MessageSquare, label: "Requests", href: "/admin/requests" },
    { icon: AlertTriangle, label: "Support", href: "/admin/support" },
    { icon: GraduationCap, label: "Teachers", href: "/admin/teachers" },
    { icon: ShoppingBag, label: "Sellers", href: "/admin/sellers" },
    { icon: Users, label: "Users", href: "/admin/users" },
    { icon: Cpu, label: "AI Services", href: "/admin/ai-services" },
    { icon: CreditCard, label: "Payments", href: "/admin/payments" },
    { icon: Globe, label: "Translation", href: "/admin/translation" },
    { icon: AlertTriangle, label: "Disputes", href: "/admin/disputes" },
    { icon: Settings, label: "Settings", href: "/admin/settings" },
  ],
  teacher: [
    { icon: LayoutDashboard, label: "Dashboard", href: "/teacher/dashboard" },
    { icon: Calendar, label: "Sessions", href: "/teacher/sessions" },
    { icon: Users, label: "Students", href: "/teacher/students" },
    { icon: GraduationCap, label: "Assignments", href: "/teacher/assignments" },
    { icon: MessageSquare, label: "Announcements", href: "/teacher/announcements" },
    { icon: Wallet, label: "Earnings", href: "/teacher/earnings" },
    { icon: UserCog, label: "Profile", href: "/teacher/profile" },
    { icon: AlertTriangle, label: "Support", href: "/teacher/support" },
  ],
  parent: [
    { icon: LayoutDashboard, label: "Dashboard", href: "/parent/dashboard" },
    { icon: GraduationCap, label: "My Children", href: "/parent/students" },
    { icon: MessageSquare, label: "Requests", href: "/parent/requests" },
    { icon: Search, label: "Find Teachers", href: "/parent/find-teachers" },
    { icon: Users, label: "Progress", href: "/parent/progress" },
    { icon: CreditCard, label: "Payments", href: "/parent/payments" },
  ],
  seller: [
    { icon: LayoutDashboard, label: "Dashboard", href: "/seller/dashboard" },
    { icon: Package, label: "My Gigs", href: "/seller/gigs" },
    { icon: ShoppingBag, label: "Orders", href: "/seller/orders" },
    { icon: Wallet, label: "Earnings", href: "/seller/earnings" },
    { icon: UserCog, label: "Profile", href: "/seller/profile" },
  ],
  buyer: [
    { icon: LayoutDashboard, label: "Dashboard", href: "/buyer/dashboard" },
    { icon: Package, label: "Orders", href: "/buyer/orders" },
    { icon: MessageSquare, label: "Messages", href: "/buyer/messages" },
  ],
}

const roleLabelColors: Record<UserRole, string> = {
  admin: "text-accent-danger", teacher: "text-accent-primary", parent: "text-accent-secondary",
  seller: "text-accent-success", buyer: "text-accent-primary",
}

const RAIL_TRANSITION = { type: "spring" as const, stiffness: 320, damping: 32 }

interface Props { role: UserRole; collapsed: boolean; onToggle: () => void; mobileOpen: boolean; onMobileClose: () => void }

export function DashboardSidebar({ role, collapsed, onToggle, mobileOpen, onMobileClose }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const prefersReducedMotion = useReducedMotion()
  const items = navItems[role] || []

  const signOut = async () => { await createClient().auth.signOut(); router.push("/") }

  const renderNav = (onNavigate: () => void) => (
    <nav className="flex-1 space-y-1 px-2 py-2">
      {items.map((item) => {
        const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
        return (
          <Link key={item.href} href={item.href} onClick={onNavigate}
            className={cn("relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150",
              active ? "bg-surface-elevated text-text-primary" : "text-text-muted hover:bg-surface-elevated hover:text-text-primary",
              collapsed && "justify-center px-2")}>
            {active && (
              <motion.span
                layoutId="dashboard-nav-active-indicator"
                className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-accent-primary"
                transition={prefersReducedMotion ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 32 }}
              />
            )}
            <item.icon className="h-5 w-5 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </Link>
        )
      })}
    </nav>
  )

  const railHeader = (
    <div className={cn("flex h-16 items-center gap-2 border-b border-border px-4", collapsed && "justify-center px-0")}>
      <Link href="/" className="flex min-w-0 items-center font-display text-lg font-bold tracking-tight">
        <span className="aurora-text">H</span>
        {!collapsed && <span className="text-text-primary">AYESH</span>}
      </Link>
      {!collapsed && (
        <button onClick={onToggle} aria-label="Collapse sidebar"
          className="ml-auto hidden shrink-0 rounded-md p-1.5 text-text-muted transition-colors hover:bg-surface-elevated hover:text-text-primary lg:flex">
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
    </div>
  )

  const railBody = (
    <div className="flex h-full flex-col">
      {railHeader}

      {!collapsed && (
        <div className="px-4 py-3">
          <span className={cn("font-mono text-xs uppercase tracking-[0.12em]", roleLabelColors[role])}>{role}</span>
        </div>
      )}

      {renderNav(onMobileClose)}

      <div className="border-t border-border p-2">
        <button onClick={signOut}
          className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-text-muted transition-colors hover:bg-accent-danger/10 hover:text-accent-danger",
            collapsed && "justify-center px-2")}>
          <LogOut className="h-5 w-5 shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>

      {collapsed && (
        <button onClick={onToggle} aria-label="Expand sidebar"
          className="hidden items-center justify-center border-t border-border py-3 text-text-muted transition-colors hover:text-text-primary lg:flex">
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  )

  return (
    <>
      <motion.aside
        animate={{ width: collapsed ? 68 : 240 }}
        transition={prefersReducedMotion ? { duration: 0 } : RAIL_TRANSITION}
        className="glass hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:flex-col lg:border-r lg:border-border"
      >
        {railBody}
      </motion.aside>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={onMobileClose} />
            <motion.aside
              initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
              transition={prefersReducedMotion ? { duration: 0 } : { type: "spring", stiffness: 340, damping: 34 }}
              className="glass fixed inset-y-0 left-0 z-50 w-64 border-r border-border lg:hidden"
            >
              <button onClick={onMobileClose} aria-label="Close menu"
                className="absolute right-3 top-3 text-text-muted transition-colors hover:text-text-primary">
                <X className="h-5 w-5" />
              </button>
              {railBody}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
