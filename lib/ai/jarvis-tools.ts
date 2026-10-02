import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { computeTeacherBalance } from "@/components/teacher/teacher-balance"
import type { Payout, Transaction, UserRole } from "@/types/database"

if (typeof window !== "undefined") {
  throw new Error("lib/ai/jarvis-tools.ts must never be imported client-side")
}

/**
 * JARVIS read-only tools. Every tool runs with the caller's cookie-scoped
 * Supabase client (RLS applies) except `admin_overview`, which uses the
 * service-role client strictly after the admin role check.
 */
export interface JarvisToolContext {
  userId: string
  role: UserRole
  supabase: SupabaseClient
}

export type JarvisToolSchema = {
  type: "object"
  properties: Record<string, unknown>
  required?: string[]
  [key: string]: unknown
}

export interface JarvisTool {
  name: string
  description: string
  input_schema: JarvisToolSchema
  roles: readonly UserRole[]
  run: (ctx: JarvisToolContext, input: unknown) => Promise<unknown>
}

const MAX_ROWS = 20
const ALL_ROLES: readonly UserRole[] = ["admin", "teacher", "parent", "seller", "buyer"]
const EMPTY_SCHEMA: JarvisToolSchema = { type: "object", properties: {} }
const emptyInput = z.object({}).passthrough()

function fail(label: string, error: { message: string } | null): void {
  if (error) throw new Error(`Could not load ${label}`)
}

function sumByCurrency(rows: ReadonlyArray<{ currency: string | null; value: number }>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const r of rows) {
    const c = r.currency ?? "PKR"
    out[c] = (out[c] ?? 0) + (r.value || 0)
  }
  return out
}

function groupBalances(txs: Transaction[], payouts: Payout[]): Record<string, ReturnType<typeof computeTeacherBalance>> {
  const currencies = new Set<string>([...txs.map((t) => t.currency), ...payouts.map((p) => p.currency)])
  const out: Record<string, ReturnType<typeof computeTeacherBalance>> = {}
  for (const c of currencies) {
    out[c] = computeTeacherBalance(
      txs.filter((t) => t.currency === c),
      payouts.filter((p) => p.currency === c)
    )
  }
  return out
}

function nowIso(): string {
  return new Date().toISOString()
}

function daysFromNowIso(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString()
}

async function getTeacherId(ctx: JarvisToolContext): Promise<string | null> {
  const { data } = await ctx.supabase.from("teachers").select("id").eq("user_id", ctx.userId).maybeSingle()
  return (data as { id: string } | null)?.id ?? null
}

async function getSellerId(ctx: JarvisToolContext): Promise<string | null> {
  const { data } = await ctx.supabase.from("sellers").select("id").eq("user_id", ctx.userId).maybeSingle()
  return (data as { id: string } | null)?.id ?? null
}

/** Strips characters that would break a PostgREST ilike filter. */
function safeLike(q: string): string {
  return q.replace(/[%_,()\\*]/g, " ").trim()
}

// ── Tools ─────────────────────────────────────────────────────

const myPendingPayments: JarvisTool = {
  name: "my_pending_payments",
  description: "Payments the user still has to make (pending transactions), with checkout links.",
  input_schema: EMPTY_SCHEMA,
  roles: ALL_ROLES,
  async run(ctx, input) {
    emptyInput.parse(input ?? {})
    const { data, error } = await ctx.supabase
      .from("transactions")
      .select("id, description, gross_amount, currency, reference_code, bank_transfer_proof, created_at")
      .eq("payer_id", ctx.userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(MAX_ROWS)
    fail("payments", error)
    const rows = (data ?? []) as Array<{
      id: string
      description: string | null
      gross_amount: number
      currency: string
      reference_code: string | null
      bank_transfer_proof: string | null
    }>
    return {
      count: rows.length,
      payments: rows.map((r) => ({
        description: r.description,
        amount: r.gross_amount,
        currency: r.currency,
        reference: r.reference_code,
        status: r.bank_transfer_proof ? "proof submitted, awaiting admin verification" : "awaiting payment",
        checkout_url: `/checkout/${r.id}`,
      })),
    }
  },
}

const myOrders: JarvisTool = {
  name: "my_orders",
  description: "The user's latest gig orders and AI service orders as a buyer, with status.",
  input_schema: EMPTY_SCHEMA,
  roles: ALL_ROLES,
  async run(ctx, input) {
    emptyInput.parse(input ?? {})
    const [gigs, ais] = await Promise.all([
      ctx.supabase
        .from("gig_orders")
        .select("id, gig_title, status, package_tier, delivery_due_at, amount_pkr, amount_usd, currency, created_at")
        .eq("buyer_id", ctx.userId)
        .order("created_at", { ascending: false })
        .limit(10),
      ctx.supabase
        .from("ai_orders")
        .select("id, service_id, status, amount_pkr, amount_usd, currency, created_at")
        .eq("buyer_id", ctx.userId)
        .order("created_at", { ascending: false })
        .limit(10),
    ])
    fail("orders", gigs.error ?? ais.error)
    const aiRows = (ais.data ?? []) as Array<{ id: string; service_id: string; status: string | null; currency: string | null; amount_pkr: number | null; amount_usd: number | null; created_at: string | null }>
    const ids = [...new Set(aiRows.map((a) => a.service_id))]
    const titles = new Map<string, string>()
    if (ids.length > 0) {
      const { data } = await ctx.supabase.from("ai_services").select("id, title").in("id", ids)
      for (const s of (data ?? []) as Array<{ id: string; title: string }>) titles.set(s.id, s.title)
    }
    return {
      gig_orders: ((gigs.data ?? []) as Array<Record<string, unknown>>).map((g) => ({
        title: g.gig_title,
        status: g.status,
        tier: g.package_tier,
        due: g.delivery_due_at,
        amount: g.currency === "USD" ? g.amount_usd : g.amount_pkr,
        currency: g.currency,
        url: "/orders",
      })),
      ai_orders: aiRows.map((a) => ({
        service: titles.get(a.service_id) ?? "AI service",
        status: a.status,
        amount: a.currency === "USD" ? a.amount_usd : a.amount_pkr,
        currency: a.currency,
        created_at: a.created_at,
        url: "/orders",
      })),
    }
  },
}

const myNotifications: JarvisTool = {
  name: "my_notifications",
  description: "The user's latest unread notifications.",
  input_schema: EMPTY_SCHEMA,
  roles: ALL_ROLES,
  async run(ctx, input) {
    emptyInput.parse(input ?? {})
    const { data, error } = await ctx.supabase
      .from("notifications")
      .select("title, message, action_url, created_at")
      .eq("user_id", ctx.userId)
      .eq("read", false)
      .order("created_at", { ascending: false })
      .limit(10)
    fail("notifications", error)
    return { unread: data ?? [] }
  },
}

const findTeachersInput = z.object({
  subject: z.string().trim().max(80).optional(),
  max_price_pkr: z.number().positive().optional(),
})

const findTeachers: JarvisTool = {
  name: "find_teachers",
  description: "Search approved teachers by subject and/or maximum monthly price in PKR. Sorted by rating.",
  input_schema: {
    type: "object",
    properties: {
      subject: { type: "string", description: "Subject to match, e.g. Math" },
      max_price_pkr: { type: "number", description: "Maximum monthly price in PKR (lowest tier)" },
    },
  },
  roles: ALL_ROLES,
  async run(ctx, input) {
    const { subject, max_price_pkr } = findTeachersInput.parse(input ?? {})
    const { data, error } = await ctx.supabase
      .from("teachers")
      .select("id, display_name, tagline, subjects, group_price_pkr, standard_price_pkr, private_price_pkr, average_rating")
      .eq("status", "approved")
      .limit(100)
    fail("teachers", error)
    const needle = subject?.toLowerCase()
    const rows = ((data ?? []) as Array<{
      id: string
      display_name: string
      tagline: string | null
      subjects: unknown
      group_price_pkr: number | null
      standard_price_pkr: number | null
      private_price_pkr: number | null
      average_rating: number | null
    }>)
      .filter((t) => !needle || JSON.stringify(t.subjects ?? []).toLowerCase().includes(needle))
      .filter((t) => {
        if (!max_price_pkr) return true
        const prices = [t.group_price_pkr, t.standard_price_pkr, t.private_price_pkr].filter((p): p is number => typeof p === "number" && p > 0)
        return prices.length > 0 && Math.min(...prices) <= max_price_pkr
      })
      .sort((a, b) => (b.average_rating ?? 0) - (a.average_rating ?? 0))
      .slice(0, MAX_ROWS)
    return {
      count: rows.length,
      teachers: rows.map((t) => ({
        name: t.display_name,
        tagline: t.tagline,
        subjects: Array.isArray(t.subjects)
          ? (t.subjects as Array<{ name?: string; subject?: string }>).map((s) => s.name ?? s.subject).filter(Boolean)
          : [],
        group_price_pkr: t.group_price_pkr,
        standard_price_pkr: t.standard_price_pkr,
        private_price_pkr: t.private_price_pkr,
        rating: t.average_rating,
        profile_url: `/teachers/${t.id}`,
      })),
    }
  },
}

const findServicesInput = z.object({ query: z.string().trim().max(80).optional() })

const findServices: JarvisTool = {
  name: "find_services",
  description: "Search approved marketplace gigs and active HayeshAI Studio services by keyword in the title.",
  input_schema: {
    type: "object",
    properties: { query: { type: "string", description: "Keyword to search for in titles" } },
  },
  roles: ALL_ROLES,
  async run(ctx, input) {
    const { query } = findServicesInput.parse(input ?? {})
    const term = query ? safeLike(query) : ""
    let gigQ = ctx.supabase.from("gigs").select("id, title, category").eq("status", "approved").limit(10)
    let aiQ = ctx.supabase
      .from("ai_services")
      .select("id, title, description, category, price_pkr, price_usd")
      .eq("status", "active")
      .limit(10)
    if (term) {
      gigQ = gigQ.ilike("title", `%${term}%`)
      aiQ = aiQ.ilike("title", `%${term}%`)
    }
    const [gigs, ais] = await Promise.all([gigQ, aiQ])
    fail("services", gigs.error ?? ais.error)
    return {
      gigs: ((gigs.data ?? []) as Array<{ id: string; title: string; category: string | null }>).map((g) => ({
        title: g.title,
        category: g.category,
        url: `/marketplace/${g.id}`,
      })),
      ai_services: ((ais.data ?? []) as Array<{ id: string; title: string; description: string; category: string; price_pkr: number | null; price_usd: number | null }>).map((s) => ({
        title: s.title,
        description: s.description.slice(0, 160),
        category: s.category,
        price_pkr: s.price_pkr,
        price_usd: s.price_usd,
        url: `/ai-services/${s.id}`,
      })),
    }
  },
}

const myChildrenProgress: JarvisTool = {
  name: "my_children_progress",
  description: "For a parent: each child with active tuition subscriptions (teacher, subject, paid through) and assignment counts.",
  input_schema: EMPTY_SCHEMA,
  roles: ["parent"],
  async run(ctx, input) {
    emptyInput.parse(input ?? {})
    const [studentsRes, subsRes] = await Promise.all([
      ctx.supabase.from("students").select("id, full_name, grade_level").eq("parent_id", ctx.userId).limit(MAX_ROWS),
      ctx.supabase
        .from("subscriptions")
        .select("teacher_id, child_name, subject, student_id, current_period_end")
        .eq("parent_id", ctx.userId)
        .eq("status", "active")
        .limit(50),
    ])
    fail("children", studentsRes.error ?? subsRes.error)
    const students = (studentsRes.data ?? []) as Array<{ id: string; full_name: string; grade_level: string | null }>
    const subs = (subsRes.data ?? []) as Array<{ teacher_id: string; child_name: string; subject: string; student_id: string | null; current_period_end: string | null }>

    const teacherNames = new Map<string, string>()
    const tIds = [...new Set(subs.map((s) => s.teacher_id))]
    if (tIds.length > 0) {
      const { data } = await ctx.supabase.from("teachers").select("id, display_name").in("id", tIds)
      for (const t of (data ?? []) as Array<{ id: string; display_name: string }>) teacherNames.set(t.id, t.display_name)
    }

    const counts = new Map<string, { to_do: number; submitted: number; graded: number }>()
    if (students.length > 0) {
      const { data } = await ctx.supabase.from("assignments").select("student_id, status").in("student_id", students.map((s) => s.id)).limit(500)
      for (const a of (data ?? []) as Array<{ student_id: string; status: string }>) {
        const c = counts.get(a.student_id) ?? { to_do: 0, submitted: 0, graded: 0 }
        if (a.status === "graded") c.graded += 1
        else if (a.status === "submitted") c.submitted += 1
        else c.to_do += 1
        counts.set(a.student_id, c)
      }
    }

    return {
      children: students.map((s) => ({
        name: s.full_name,
        grade_level: s.grade_level,
        subscriptions: subs
          .filter((x) => x.student_id === s.id || (!x.student_id && x.child_name.toLowerCase() === s.full_name.toLowerCase()))
          .map((x) => ({ teacher: teacherNames.get(x.teacher_id) ?? "Teacher", subject: x.subject, paid_through: x.current_period_end })),
        assignments: counts.get(s.id) ?? { to_do: 0, submitted: 0, graded: 0 },
        progress_url: `/parent/progress/${s.id}`,
      })),
    }
  },
}

const myUpcomingLessons: JarvisTool = {
  name: "my_upcoming_lessons",
  description: "Scheduled lessons and meetings in the next 14 days.",
  input_schema: EMPTY_SCHEMA,
  roles: ["parent", "teacher"],
  async run(ctx, input) {
    emptyInput.parse(input ?? {})
    const from = nowIso()
    const to = daysFromNowIso(14)
    let sessionQ = ctx.supabase
      .from("sessions")
      .select("child_name, subject, scheduled_at, duration_mins")
      .eq("status", "scheduled")
      .gte("scheduled_at", from)
      .lte("scheduled_at", to)
      .order("scheduled_at", { ascending: true })
      .limit(MAX_ROWS)
    if (ctx.role === "parent") {
      sessionQ = sessionQ.eq("parent_id", ctx.userId)
    } else {
      const tid = await getTeacherId(ctx)
      if (!tid) return { lessons: [], meetings: [], note: "No teacher profile found." }
      sessionQ = sessionQ.eq("teacher_id", tid)
    }
    const meetingQ = ctx.supabase
      .from("meetings")
      .select("title, scheduled_at, duration_minutes, context")
      .eq("status", "scheduled")
      .gte("scheduled_at", from)
      .lte("scheduled_at", to)
      .or(`organizer_id.eq.${ctx.userId},participant_id.eq.${ctx.userId}`)
      .order("scheduled_at", { ascending: true })
      .limit(MAX_ROWS)
    const [sessions, meetings] = await Promise.all([sessionQ, meetingQ])
    fail("lessons", sessions.error ?? meetings.error)
    return { lessons: sessions.data ?? [], meetings: meetings.data ?? [], meetings_url: "/meetings" }
  },
}

const myStudents: JarvisTool = {
  name: "my_students",
  description: "For a teacher: students with active subscriptions (child, subject, tier, paid through).",
  input_schema: EMPTY_SCHEMA,
  roles: ["teacher"],
  async run(ctx, input) {
    emptyInput.parse(input ?? {})
    const tid = await getTeacherId(ctx)
    if (!tid) return { students: [], note: "No teacher profile found." }
    const { data, error } = await ctx.supabase
      .from("subscriptions")
      .select("child_name, subject, tier, current_period_end")
      .eq("teacher_id", tid)
      .eq("status", "active")
      .limit(MAX_ROWS)
    fail("students", error)
    return { count: (data ?? []).length, students: data ?? [], students_url: "/teacher/students" }
  },
}

const myEarnings: JarvisTool = {
  name: "my_earnings",
  description: "Earnings summary by currency: total earned, in escrow, available to withdraw, withdrawn, pending payouts.",
  input_schema: EMPTY_SCHEMA,
  roles: ["teacher", "seller"],
  async run(ctx, input) {
    emptyInput.parse(input ?? {})
    const [txRes, payRes] = await Promise.all([
      ctx.supabase.from("transactions").select("*").eq("payee_id", ctx.userId).limit(1000),
      ctx.supabase.from("payouts").select("*").eq("recipient_id", ctx.userId).limit(1000),
    ])
    fail("earnings", txRes.error ?? payRes.error)
    return {
      balances_by_currency: groupBalances((txRes.data ?? []) as Transaction[], (payRes.data ?? []) as Payout[]),
      earnings_url: ctx.role === "teacher" ? "/teacher/earnings" : "/seller/earnings",
    }
  },
}

const mySellerOrders: JarvisTool = {
  name: "my_seller_orders",
  description: "For a seller: active orders with due dates; overdue ones are flagged.",
  input_schema: EMPTY_SCHEMA,
  roles: ["seller"],
  async run(ctx, input) {
    emptyInput.parse(input ?? {})
    const sid = await getSellerId(ctx)
    if (!sid) return { orders: [], note: "No seller profile found." }
    const { data, error } = await ctx.supabase
      .from("gig_orders")
      .select("gig_title, status, delivery_due_at, package_tier")
      .eq("seller_id", sid)
      .in("status", ["in_progress", "revision_requested", "delivered", "disputed"])
      .order("delivery_due_at", { ascending: true })
      .limit(MAX_ROWS)
    fail("orders", error)
    const now = Date.now()
    return {
      orders: ((data ?? []) as Array<{ gig_title: string | null; status: string | null; delivery_due_at: string | null; package_tier: string }>).map((o) => ({
        title: o.gig_title,
        status: o.status,
        tier: o.package_tier,
        due: o.delivery_due_at,
        overdue: o.delivery_due_at !== null && o.status !== "delivered" && new Date(o.delivery_due_at).getTime() < now,
      })),
      orders_url: "/seller/orders",
    }
  },
}

async function count(promise: PromiseLike<{ count: number | null; error: { message: string } | null }>): Promise<number | null> {
  const { count: c, error } = await promise
  return error ? null : c ?? 0
}

const adminOverview: JarvisTool = {
  name: "admin_overview",
  description: "Admin only: what needs attention (pending verifications, disputes, approvals, open tickets) and revenue this month.",
  input_schema: EMPTY_SCHEMA,
  roles: ["admin"],
  async run(ctx, input) {
    emptyInput.parse(input ?? {})
    if (ctx.role !== "admin") throw new Error("Not allowed")
    const admin = createAdminClient()
    const monthStart = new Date()
    monthStart.setUTCDate(1)
    monthStart.setUTCHours(0, 0, 0, 0)
    const head = { count: "exact" as const, head: true }

    const [verifications, disputes, teachers, sellers, tickets, revenue] = await Promise.all([
      count(admin.from("transactions").select("id", head).eq("status", "pending").not("bank_transfer_proof", "is", null)),
      count(admin.from("gig_orders").select("id", head).eq("status", "disputed")),
      count(admin.from("teachers").select("id", head).eq("status", "pending")),
      count(admin.from("sellers").select("id", head).eq("status", "pending")),
      count(admin.from("support_tickets").select("id", head).eq("status", "open")),
      admin
        .from("transactions")
        .select("platform_fee, currency")
        .in("status", ["completed", "processing"])
        .gte("created_at", monthStart.toISOString())
        .limit(5000),
    ])
    const revRows = (revenue.data ?? []) as Array<{ platform_fee: number | null; currency: string }>
    return {
      pending_payment_verifications: verifications,
      verifications_url: "/admin/payments",
      disputed_gig_orders: disputes,
      disputes_url: "/admin/disputes",
      pending_teacher_approvals: teachers,
      teachers_url: "/admin/teachers",
      pending_seller_approvals: sellers,
      sellers_url: "/admin/sellers",
      open_support_tickets: tickets,
      platform_revenue_this_month: revenue.error
        ? null
        : sumByCurrency(revRows.map((r) => ({ currency: r.currency, value: r.platform_fee ?? 0 }))),
    }
  },
}

export const JARVIS_TOOLS: readonly JarvisTool[] = [
  myPendingPayments,
  myOrders,
  myNotifications,
  findTeachers,
  findServices,
  myChildrenProgress,
  myUpcomingLessons,
  myStudents,
  myEarnings,
  mySellerOrders,
  adminOverview,
]

export function toolsForRole(role: UserRole): JarvisTool[] {
  return JARVIS_TOOLS.filter((t) => t.roles.includes(role))
}

export async function runTool(ctx: JarvisToolContext, name: string, input: unknown): Promise<unknown> {
  const tool = toolsForRole(ctx.role).find((t) => t.name === name)
  if (!tool) throw new Error("Unknown tool")
  return tool.run(ctx, input)
}
