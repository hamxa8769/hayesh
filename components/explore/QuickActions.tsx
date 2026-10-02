import Link from "next/link"
import {
  ArrowUpRight,
  BriefcaseBusiness,
  CircleDollarSign,
  GraduationCap,
  LayoutDashboard,
  MessageSquare,
  PackageCheck,
  PlusCircle,
  ReceiptText,
  ShieldAlert,
  Sparkles,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react"
import type { ExploreViewer } from "./explore-data"

interface Action {
  href: string
  label: string
  hint: string
  icon: LucideIcon
}

type Role = NonNullable<ExploreViewer["role"]>

const MESSAGES: Action = { href: "/messages", label: "Messages", hint: "Chat with your contacts", icon: MessageSquare }

const ACTIONS: Record<Role, Action[]> = {
  parent: [
    { href: "/teachers", label: "Find a tutor", hint: "Browse verified teachers", icon: GraduationCap },
    { href: "/parent/students", label: "My children", hint: "Profiles and progress", icon: Users },
    { href: "/parent/payments", label: "Payments", hint: "Subscriptions and receipts", icon: Wallet },
    MESSAGES,
  ],
  teacher: [
    { href: "/teacher/dashboard", label: "Dashboard", hint: "Today at a glance", icon: LayoutDashboard },
    { href: "/teacher/students", label: "Students", hint: "Your active learners", icon: Users },
    { href: "/teacher/earnings", label: "Earnings", hint: "Payouts and history", icon: CircleDollarSign },
    MESSAGES,
  ],
  seller: [
    { href: "/seller/gigs/new", label: "Create a gig", hint: "List a new service", icon: PlusCircle },
    { href: "/seller/orders", label: "Orders", hint: "Manage deliveries", icon: PackageCheck },
    { href: "/seller/earnings", label: "Earnings", hint: "Payouts and history", icon: CircleDollarSign },
    MESSAGES,
  ],
  buyer: [
    { href: "/orders", label: "My orders", hint: "Track and accept work", icon: ReceiptText },
    MESSAGES,
    { href: "/ai-services", label: "AI Studio", hint: "Instant AI delivery", icon: Sparkles },
  ],
  admin: [
    { href: "/admin", label: "Admin overview", hint: "Platform health", icon: LayoutDashboard },
    { href: "/admin/payments", label: "Payments", hint: "Verify and pay out", icon: BriefcaseBusiness },
    { href: "/admin/disputes", label: "Disputes", hint: "Resolve open cases", icon: ShieldAlert },
  ],
}

const ROLE_LABEL: Record<Role, string> = {
  parent: "Parent",
  teacher: "Teacher",
  seller: "Seller",
  buyer: "Buyer",
  admin: "Admin",
}

export function QuickActions({ role }: { role: Role }) {
  const actions = ACTIONS[role]
  return (
    <section aria-label="Your shortcuts" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Your shortcuts</h2>
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-text-disabled">{ROLE_LABEL[role]}</span>
      </div>
      <ul className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-4">
        {actions.map(({ href, label, hint, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="group flex h-full items-center gap-3 rounded-lg border border-border bg-surface p-3.5 outline-none transition-[border-color,background-color] duration-150 hover:border-line-strong hover:bg-surface-elevated focus-visible:ring-2 focus-visible:ring-accent-primary/60"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-surface-elevated text-accent-primary">
                <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-text-primary">{label}</span>
                <span className="block truncate text-xs text-text-muted">{hint}</span>
              </span>
              <ArrowUpRight
                className="h-4 w-4 shrink-0 text-text-disabled transition-colors group-hover:text-text-primary"
                aria-hidden="true"
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
