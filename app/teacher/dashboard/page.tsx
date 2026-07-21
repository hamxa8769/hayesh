"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Calendar, Users, Wallet, UserCog, Clock, ArrowRight, Activity, GraduationCap } from "lucide-react"
import { StatTile } from "@/components/dashboard/StatTile"
import { PanelGroup } from "@/components/dashboard/PanelGroup"
import { Reveal } from "@/components/motion/Reveal"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils/cn"
import { useSupabase } from "@/hooks/useSupabase"
import { formatPKR, formatDateTime, formatDate } from "@/lib/utils/format"
import { EscrowBalanceCard } from "@/components/teacher/EscrowBalanceCard"
import { TeacherProfileCompletionCard } from "@/components/teacher/TeacherProfileCompletionCard"
import { computeTeacherBalance, type TeacherBalance } from "@/components/teacher/teacher-balance"
import { currentWeekRange, sessionsPerDaySpark, cumulativeEarningsSpark } from "@/components/teacher/teacher-metrics"
import type { Session, Teacher, Transaction, Payout } from "@/types/database"

interface DashboardStats {
  activeStudents: number
  sessionsThisWeek: number
  sessionsSpark: number[]
  balanceSpark: number[]
  pendingDemoRequests: number
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
  const [teacher, setTeacher] = useState<Teacher | null>(null)
  const [stats, setStats] = useState<DashboardStats>({ activeStudents: 0, sessionsThisWeek: 0, sessionsSpark: [], balanceSpark: [], pendingDemoRequests: 0 })
  const [rating, setRating] = useState<RatingSummary>({ average: null, totalReviews: 0 })
  const [balance, setBalance] = useState<TeacherBalance | null>(null)
  const [upcoming, setUpcoming] = useState<Session[]>([])
  const [recentActivity, setRecentActivity] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)

  useEffect(() => {
    if (!user) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      setNeedsOnboarding(false)

      try {
        const { createClient } = await import("@/lib/supabase/client")
        const supabase = createClient()

        // `sessions.teacher_id` / `subscriptions.teacher_id` reference teachers(id),
        // NOT auth.uid() — resolve the teacher row first before filtering on it.
        // `.maybeSingle()` (not `.single()`) because a signed-in teacher who
        // hasn't finished onboarding legitimately has zero rows here — `.single()`
        // makes PostgREST return a 406 for that case instead of null data.
        const { data: teacherRow, error: teacherError } = await supabase
          .from("teachers")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle()

        if (cancelled) return

        if (teacherError) {
          setError("We couldn't load your teacher profile yet.")
          setLoading(false)
          return
        }

        if (!teacherRow) {
          setNeedsOnboarding(true)
          setLoading(false)
          return
        }

        const teacherData = teacherRow as Teacher
        const week = currentWeekRange()

        const [activeSubs, weekSessions, upcomingSessions, allTx, allPayouts, pendingDemos] = await Promise.all([
          supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("teacher_id", teacherData.id).eq("status", "active"),
          supabase.from("sessions").select("scheduled_at").eq("teacher_id", teacherData.id).gte("scheduled_at", week.start.toISOString()).lt("scheduled_at", week.end.toISOString()),
          supabase.from("sessions").select("*").eq("teacher_id", teacherData.id).eq("status", "scheduled").order("scheduled_at", { ascending: true }).limit(5),
          supabase.from("transactions").select("*").eq("payee_id", user.id),
          supabase.from("payouts").select("*").eq("recipient_id", user.id),
          supabase.from("demo_bookings").select("id", { count: "exact", head: true }).eq("teacher_id", teacherData.id).eq("status", "pending"),
        ])

        if (cancelled) return

        const transactions = (allTx.data || []) as Transaction[]
        const payouts = (allPayouts.data || []) as Payout[]
        const weekSessionRows = (weekSessions.data || []) as Pick<Session, "scheduled_at">[]

        setTeacher(teacherData)
        setStats({
          activeStudents: activeSubs.count || 0,
          sessionsThisWeek: weekSessionRows.length,
          sessionsSpark: sessionsPerDaySpark(weekSessionRows, week),
          balanceSpark: cumulativeEarningsSpark(transactions.filter((t) => t.status === "completed")),
          pendingDemoRequests: pendingDemos.count || 0,
        })
        setRating({
          average: teacherData.average_rating ?? null,
          totalReviews: teacherData.total_reviews ?? 0,
        })
        setBalance(computeTeacherBalance(transactions, payouts))
        setUpcoming((upcomingSessions.data || []) as Session[])
        const recentActivitySorted = [...transactions].sort((a, b) => {
          const aTime = a.created_at ? new Date(a.created_at).getTime() : 0
          const bTime = b.created_at ? new Date(b.created_at).getTime() : 0
          return bTime - aTime
        })
        setRecentActivity(recentActivitySorted.slice(0, 5))
        setLoading(false)
      } catch {
        if (cancelled) return
        setError("We couldn't load your teacher profile yet.")
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [user])

  return (
    <div className="space-y-8">
      <Reveal>
        <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] text-text-primary">
          Welcome back{teacher?.display_name ? `, ${teacher.display_name}` : ""}!
        </h2>
        <p className="mt-1 text-text-muted">Here&apos;s your teaching overview.</p>
      </Reveal>

      {error ? (
        <div className="rounded-lg border border-accent-danger/30 bg-accent-danger/10 p-6 text-sm text-accent-danger">{error}</div>
      ) : needsOnboarding ? (
        <div className="relative overflow-hidden rounded-lg border border-border bg-surface p-8">
          <span aria-hidden="true" className="aurora-bg absolute inset-x-0 top-0 h-[2px]" />
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-line-strong bg-surface-elevated">
                <GraduationCap className="h-6 w-6 text-accent-primary" />
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold tracking-[-0.02em] text-text-primary">
                  Complete your teacher profile
                </h3>
                <p className="mt-1 max-w-md text-sm text-text-muted">
                  You haven&apos;t finished onboarding yet. Add your education, subjects, and pricing to start
                  accepting students.
                </p>
              </div>
            </div>
            <Link href="/teacher/onboarding" className="shrink-0">
              <Button variant="aurora">
                Start Onboarding <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <>
          <PanelGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Active Students" value={stats.activeStudents} />
            <StatTile label="Sessions This Week" value={stats.sessionsThisWeek} spark={stats.sessionsSpark} />
            <StatTile
              label="Available Balance"
              value={loading ? "…" : formatPKR(balance?.available ?? 0)}
              spark={stats.balanceSpark}
              accent
            />
            <StatTile
              label="Rating"
              value={rating.average != null ? rating.average.toFixed(1) : "—"}
              delta={rating.totalReviews > 0 ? { value: `${rating.totalReviews} reviews`, direction: "flat" } : undefined}
            />
            <Link href="/teacher/sessions" className="block">
              <StatTile
                label="Pending Demo Requests"
                value={loading ? "…" : stats.pendingDemoRequests}
                delta={
                  !loading && stats.pendingDemoRequests > 0
                    ? { value: "Needs your response", direction: "down" }
                    : undefined
                }
                className="cursor-pointer transition-colors hover:border-line-strong"
              />
            </Link>
          </PanelGroup>

          {balance && <EscrowBalanceCard balance={balance} />}

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

          {teacher && <TeacherProfileCompletionCard teacher={teacher} />}
        </>
      )}

      <div className="rounded-lg border border-border bg-surface p-6">
        <h3 className="mb-4 font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Quick Actions</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK_ACTIONS.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="flex items-center gap-3 rounded-lg border border-border p-4 transition-colors hover:border-line-strong hover:bg-surface-elevated"
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
