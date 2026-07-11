"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Calendar, Users, Wallet, UserCog, Clock, ArrowRight, Activity } from "lucide-react"
import { StatTile } from "@/components/dashboard/StatTile"
import { PanelGroup } from "@/components/dashboard/PanelGroup"
import { Reveal } from "@/components/motion/Reveal"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils/cn"
import { useSupabase } from "@/hooks/useSupabase"
import { formatPKR, formatDateTime, formatDate } from "@/lib/utils/format"
import type { Session, Transaction } from "@/types/database"

interface DashboardStats {
  sessions: number
  students: number
  balance: number
}

interface RatingSummary {
  average: number | null
  totalReviews: number
}

const QUICK_ACTIONS = [
  { href: "/teacher/sessions", label: "View Sessions", icon: Calendar },
  { href: "/teacher/profile", label: "Edit Profile", icon: UserCog },
  { href: "/teacher/earnings", label: "Earnings", icon: Wallet },
  { href: "/teacher/students", label: "Students", icon: Users },
] as const

export default function TeacherDashboard() {
  const { user } = useSupabase()
  const [stats, setStats] = useState<DashboardStats>({ sessions: 0, students: 0, balance: 0 })
  const [rating, setRating] = useState<RatingSummary>({ average: null, totalReviews: 0 })
  const [upcoming, setUpcoming] = useState<Session[]>([])
  const [recentActivity, setRecentActivity] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const load = async () => {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const [sessions, students, tx, teacher, upcomingSessions, activity] = await Promise.all([
        supabase.from("sessions").select("id", { count: "exact", head: true }).eq("teacher_id", user.id),
        supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("teacher_id", user.id).eq("status", "active"),
        supabase.from("transactions").select("net_amount").eq("payee_id", user.id).eq("status", "completed"),
        supabase.from("teachers").select("average_rating, total_reviews").eq("user_id", user.id).single(),
        supabase.from("sessions").select("*").eq("teacher_id", user.id).eq("status", "scheduled").order("scheduled_at", { ascending: true }).limit(5),
        supabase.from("transactions").select("*").eq("payee_id", user.id).order("created_at", { ascending: false }).limit(5),
      ])
      setStats({
        sessions: sessions.count || 0,
        students: students.count || 0,
        balance: (tx.data || []).reduce((s, t) => s + (t.net_amount || 0), 0),
      })
      setRating({
        average: teacher.data?.average_rating ?? null,
        totalReviews: teacher.data?.total_reviews ?? 0,
      })
      setUpcoming((upcomingSessions.data || []) as Session[])
      setRecentActivity((activity.data || []) as Transaction[])
      setLoading(false)
    }
    load()
  }, [user])

  return (
    <div className="space-y-8">
      <Reveal>
        <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] text-text-primary">Welcome back!</h2>
        <p className="mt-1 text-text-muted">Here&apos;s your teaching overview.</p>
      </Reveal>

      <PanelGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Sessions" value={stats.sessions} />
        <StatTile label="Active Students" value={stats.students} />
        <StatTile label="Balance" value={formatPKR(stats.balance)} accent />
        <StatTile
          label="Rating"
          value={rating.average != null ? rating.average.toFixed(1) : "—"}
          delta={rating.totalReviews > 0 ? { value: `${rating.totalReviews} reviews`, direction: "flat" } : undefined}
        />
      </PanelGroup>

      <div className="grid gap-4 lg:grid-cols-2">
        <PanelGroup title="Upcoming Sessions">
          <div className="rounded-lg border border-border bg-surface p-1">
            <div className="flex items-center justify-between px-4 pt-3 pb-2">
              <p className="flex items-center gap-2 text-sm font-medium text-text-primary">
                <Calendar className="h-4 w-4 text-accent-primary" /> Next up
              </p>
              <Link href="/teacher/sessions" className="flex items-center gap-1 text-xs font-mono text-text-muted transition-colors hover:text-accent-primary">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {loading ? (
              <p className="px-4 pb-4 text-sm text-text-muted">Loading...</p>
            ) : upcoming.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-text-muted">No upcoming sessions scheduled.</p>
            ) : (
              <ul className="divide-y divide-border">
                {upcoming.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-text-primary">{s.subject || "Session"}</p>
                      <p className="mt-0.5 flex items-center gap-1 font-mono text-xs tabular-nums text-text-muted">
                        <Clock className="h-3 w-3" /> {s.scheduled_at ? formatDateTime(s.scheduled_at) : "TBD"}
                      </p>
                    </div>
                    <Badge variant="outline" className="shrink-0">Scheduled</Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </PanelGroup>

        <PanelGroup title="Recent Activity">
          <div className="rounded-lg border border-border bg-surface p-1">
            <div className="flex items-center gap-2 px-4 pt-3 pb-2">
              <Activity className="h-4 w-4 text-accent-primary" />
              <p className="text-sm font-medium text-text-primary">Latest transactions</p>
            </div>
            {loading ? (
              <p className="px-4 pb-4 text-sm text-text-muted">Loading...</p>
            ) : recentActivity.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-text-muted">No activity yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {recentActivity.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm capitalize text-text-primary">{t.type.replace("_", " ")}</p>
                      <p className="mt-0.5 font-mono text-xs text-text-muted">{t.created_at ? formatDate(t.created_at) : ""}</p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 font-mono text-sm font-semibold tabular-nums",
                        t.status === "completed" ? "text-accent-success" : "text-text-muted"
                      )}
                    >
                      {formatPKR(t.net_amount || 0)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </PanelGroup>
      </div>

      <div className="rounded-lg border border-border bg-surface p-6">
        <h3 className="mb-4 font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Quick Actions</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK_ACTIONS.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="flex items-center gap-3 rounded-lg border border-border p-4 transition-colors hover:border-line-strong hover:bg-surface-2"
            >
              <a.icon className="h-5 w-5 text-accent-primary" />
              <span className="text-sm text-text-primary">{a.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
