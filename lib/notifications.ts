import { createAdminClient } from "@/lib/supabase/admin"

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
      .select("id")
      .eq("role", "admin")

    if (lookupError) {
      return { ok: false, error: lookupError.message }
    }

    if (!admins || admins.length === 0) {
      return { ok: true }
    }

    const rows = (admins as Array<{ id: string }>).map((row) => ({
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
