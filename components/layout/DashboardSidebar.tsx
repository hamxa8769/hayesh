"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  LayoutDashboard, Calendar, Users, Wallet, UserCog,
  Search, ShoppingBag, Package, MessageSquare,
  GraduationCap, Cpu, CreditCard,
  Globe, AlertTriangle, Settings, ChevronLeft,
  ChevronRight, LogOut, X,
} from "lucide-react"
import { cn } from "@/lib/utils/cn"
import { createClient } from "@/lib/supabase/client"
import type { UserRole } from "@/types/database"

interface NavItem {
  icon: React.ComponentType<{ className?: string }>
  label: string
  href: string
}

const roleNavItems: Record<UserRole, NavItem[]> = {
  admin: [
    { icon: LayoutDashboard, label: "Overview", href: "/admin" },
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
    { icon: Wallet, label: "Earnings", href: "/teacher/earnings" },
    { icon: UserCog, label: "Profile", href: "/teacher/profile" },
  ],
  parent: [
    { icon: LayoutDashboard, label: "Dashboard", href: "/parent/dashboard" },
    { icon: Search, label: "Find Teachers", href: "/parent/find-teachers" },
    { icon: Users, label: "Progress", href: "/parent/progress" },
    { icon: CreditCard, label: "Payments", href: "/parent/payments" },
  ],
  seller: [
    { icon: LayoutDashboard, label: "Dashboard", href: "/seller/dashboard" },
    { icon: Package, label: "My Gigs", href: "/seller/gigs" },
    { icon: ShoppingBag, label: "Orders", href: "/seller/orders" },
    { icon: Wallet, label: "Earnings", href: "/seller/earnings" },
  ],
  buyer: [
    { icon: LayoutDashboard, label: "Dashboard", href: "/buyer/dashboard" },
    { icon: Package, label: "Orders", href: "/buyer/orders" },
    { icon: MessageSquare, label: "Messages", href: "/buyer/messages" },
  ],
}

interface DashboardSidebarProps {
  role: UserRole
  collapsed: boolean
  onToggle: () => void
  mobileOpen: boolean
  onMobileClose: () => void
}

export function DashboardSidebar({ role, collapsed, onToggle, mobileOpen, onMobileClose }: DashboardSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const items = roleNavItems[role] || []

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/")
  }

  const roleColors: Record<UserRole, string> = {
    admin: "text-accent-danger",
    teacher: "text-accent-primary",
    parent: "text-accent-secondary",
    seller: "text-accent-success",
    buyer: "text-accent-primary",
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className={cn("flex h-16 items-center border-b border-border px-4", collapsed && "justify-center")}>
        {!collapsed && (
          <Link href="/" className="flex items-center gap-2">
            <span className="font-display text-lg font-bold bg-gradient-to-r from-accent-primary to-accent-secondary bg-clip-text text-transparent">
              HAYESH
            </span>
          </Link>
        )}
        {collapsed && (
          <Link href="/" className="font-display text-sm font-bold text-accent-primary">H</Link>
        )}
      </div>

      {/* Role badge */}
      {!collapsed && (
        <div className="px-4 py-3">
          <span className={cn("text-xs font-mono uppercase tracking-widest", roleColors[role])}>
            {role}
          </span>
        </div>
      )}

      {/* Nav items */}
      <nav className="flex-1 space-y-1 px-2 py-2">
        {items.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onMobileClose}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-accent-primary/10 text-accent-primary"
                  : "text-text-muted hover:bg-surface-elevated hover:text-text-primary",
                collapsed && "justify-center px-2"
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Sign out */}
      <div className="border-t border-border p-2">
        <button
          onClick={handleSignOut}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-text-muted hover:bg-accent-danger/10 hover:text-accent-danger transition-all",
            collapsed && "justify-center px-2"
          )}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className="hidden lg:flex items-center justify-center border-t border-border py-3 text-text-muted hover:text-text-primary transition-colors"
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 64 : 256 }}
        transition={{ duration: 0.2 }}
        className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:flex-col bg-surface/80 backdrop-blur-xl border-r border-border"
      >
        {sidebar}
      </motion.aside>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 lg:hidden"
              onClick={onMobileClose}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 25 }}
              className="fixed inset-y-0 left-0 z-50 w-64 bg-surface border-r border-border lg:hidden"
            >
              <button
                onClick={onMobileClose}
                className="absolute right-3 top-3 text-text-muted hover:text-text-primary"
              >
                <X className="h-5 w-5" />
              </button>
              {sidebar}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
