import { createAdminClient } from "@/lib/supabase/admin"
import { isEmailEnabled, sendEmail } from "@/lib/email/send"
import { renderNotificationEmail } from "@/lib/email/templates"

if (typeof window !== "undefined") {
  throw new Error("lib/notifications.ts must never be imported client-side")
}

/**
 * Server-side notification write helpers.
 *
 * These write on behalf of OTHER users (e.g. notifying every admin that a
 * parent submitted a student request), so they always use the service-role
 * admin client — RLS on `public.notifications` only allows a user to write
 * rows where `user_id = auth.uid()`, which a normal request-scoped client
 * cannot satisfy for a different recipient.
 *
 * Every helper returns a result instead of throwing: a failed notification
 * must never break the user action that triggered it (booking a demo,
 * submitting a request, etc.).
 */

export type NotificationType =
  | "student_request_created"
  | "student_request_assigned"
  | "support_ticket_created"
  | "assignment_created"
  | "demo_booked"
  | "payout_requested"
  | "meeting_invite"
  | "meeting_cancelled"
  | "payment_submitted"
  | "payment_confirmed"
  | "payment_rejected"
  | "order_received"
  | "order_delivered"
  | "order_completed"
  | "order_revision"
  | "order_disputed"
  | "dispute_resolved"
  | "subscription_activated"
  | "subscription_renewal_due"
  | "subscription_past_due"
  | "registration_paid"
  | "message_received"

/** Money / order lifecycle types that are also delivered by email. */
const EMAIL_NOTIFICATION_TYPES: ReadonlySet<NotificationType> = new Set<NotificationType>([
  "payment_confirmed",
  "payment_rejected",
  "order_received",
  "order_delivered",
  "order_completed",
  "order_revision",
  "order_disputed",
  "dispute_resolved",
  "subscription_activated",
  "subscription_renewal_due",
  "subscription_past_due",
  "registration_paid",
  "student_request_assigned",
  "demo_booked",
  "meeting_invite",
])

/** Admin fan-outs that are also emailed (everything else is in-app only). */
const ADMIN_EMAIL_TYPES: ReadonlySet<NotificationType> = new Set<NotificationType>([
  "payment_submitted",
  "order_disputed",
])

const MAX_ADMIN_EMAILS = 10

export interface NotificationResult {
  ok: boolean
  error?: string
}

interface NotifyUserParams {
  userId: string
  type: NotificationType
  title: string
  message: string
  actionUrl?: string
}

interface NotifyAdminsParams {
  type: NotificationType
  title: string
  message: string
  actionUrl?: string
}

interface NotifyTeacherByTeacherIdParams {
  teacherId: string
  type: NotificationType
  title: string
  message: string
  actionUrl?: string
}

interface EmailRecipient {
  email: string | null
  full_name: string | null
}

async function emailRecipient(
  recipient: EmailRecipient,
  content: { title: string; message: string; actionUrl?: string }
): Promise<void> {
  if (!recipient.email) return
  const rendered = renderNotificationEmail({
    title: content.title,
    message: content.message,
    actionUrl: content.actionUrl,
    recipientName: recipient.full_name,
  })
  await sendEmail({ to: recipient.email, ...rendered })
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  return "Unknown error"
}

/** Writes a single notification for one user. */
export async function notifyUser(params: NotifyUserParams): Promise<NotificationResult> {
  try {
    const admin = createAdminClient()
    const { error } = await admin.from("notifications").insert({
      user_id: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      action_url: params.actionUrl ?? null,
    })

    if (error) {
      return { ok: false, error: error.message }
    }

    if (EMAIL_NOTIFICATION_TYPES.has(params.type) && isEmailEnabled()) {
      try {
        const { data: profile } = await admin
          .from("profiles")
          .select("email, full_name")
          .eq("id", params.userId)
          .maybeSingle()
        if (profile) {
          await emailRecipient(profile as EmailRecipient, params)
        }
      } catch (emailError: unknown) {
        console.error("[notifications] email delivery failed:", getErrorMessage(emailError))
      }
    }

    return { ok: true }
  } catch (error: unknown) {
    return { ok: false, error: getErrorMessage(error) }
  }
}

/**
 * Fans a notification out to every admin in one batched insert (never a
 * loop of single-row inserts).
 */
export async function notifyAdmins(params: NotifyAdminsParams): Promise<NotificationResult> {
  try {
    const admin = createAdminClient()

    const { data: admins, error: lookupError } = await admin
      .from("profiles")
      .select("id, email, full_name")
      .eq("role", "admin")

    if (lookupError) {
      return { ok: false, error: lookupError.message }
    }

    if (!admins || admins.length === 0) {
      return { ok: true }
    }

    const rows = (admins as Array<{ id: string } & EmailRecipient>).map((row) => ({
      user_id: row.id,
      type: params.type,
      title: params.title,
      message: params.message,
      action_url: params.actionUrl ?? null,
    }))

    const { error: insertError } = await admin.from("notifications").insert(rows)

    if (insertError) {
      return { ok: false, error: insertError.message }
    }

    if (ADMIN_EMAIL_TYPES.has(params.type) && isEmailEnabled()) {
      try {
        const recipients = (admins as Array<{ id: string } & EmailRecipient>).slice(
          0,
          MAX_ADMIN_EMAILS
        )
        for (const recipient of recipients) {
          await emailRecipient(recipient, params)
        }
      } catch (emailError: unknown) {
        console.error("[notifications] admin email delivery failed:", getErrorMessage(emailError))
      }
    }

    return { ok: true }
  } catch (error: unknown) {
    return { ok: false, error: getErrorMessage(error) }
  }
}

/** Resolves `teachers.user_id` from a teacher row id, then notifies that user. */
export async function notifyTeacherByTeacherId(
  params: NotifyTeacherByTeacherIdParams
): Promise<NotificationResult> {
  try {
    const admin = createAdminClient()

    const { data: teacher, error: lookupError } = await admin
      .from("teachers")
      .select("user_id")
      .eq("id", params.teacherId)
      .maybeSingle()

    if (lookupError) {
      return { ok: false, error: lookupError.message }
    }

    if (!teacher) {
      return { ok: false, error: `No teacher found for id ${params.teacherId}` }
    }

    return notifyUser({
      userId: (teacher as { user_id: string }).user_id,
      type: params.type,
      title: params.title,
      message: params.message,
      actionUrl: params.actionUrl,
    })
  } catch (error: unknown) {
    return { ok: false, error: getErrorMessage(error) }
  }
}
