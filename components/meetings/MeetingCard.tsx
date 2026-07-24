"use client"

import { useState } from "react"
import Link from "next/link"
import { Loader2, Users, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { StatusPill, type PillTone } from "@/components/teacher/StatusPill"
import { cn } from "@/lib/utils/cn"
import { formatDateTime } from "@/lib/utils/format"
import type { Meeting } from "@/types/database"

export interface HostingInvitation {
  invitee_id: string
  status: "invited" | "accepted" | "declined"
  full_name: string | null
}

export interface HostingMeetingData extends Meeting {
  invitations: HostingInvitation[]
}

export interface InvitedMeetingData extends Meeting {
  invitation_id: string
  invitation_status: "invited" | "accepted" | "declined"
  organizer_name: string | null
}

export type MeetingCardProps =
  | { variant: "hosting"; meeting: HostingMeetingData; onChanged?: () => void }
  | { variant: "invited"; meeting: InvitedMeetingData; onChanged?: () => void }

const MEETING_STATUS_TONE: Record<Meeting["status"], PillTone> = {
  scheduled: "neutral",
  completed: "neutral",
  cancelled: "danger",
}

const MEETING_STATUS_LABEL: Record<Meeting["status"], string> = {
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
}

const INVITEE_DOT_TONE: Record<HostingInvitation["status"], string> = {
  invited: "bg-text-muted",
  accepted: "bg-accent-success",
  declined: "bg-accent-danger",
}

/**
 * One meeting row on /meetings. `variant` discriminates between a meeting
 * the caller organizes (shows the invitee list + Cancel) and one they were
 * invited to (shows who's hosting it). Accept/decline for invited meetings
 * lives in InvitationInbox, not here — this card only ever shows a Join link
 * for the invited case.
 */
export function MeetingCard({ variant, meeting, onChanged }: MeetingCardProps) {
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canAct = meeting.status === "scheduled"

  const handleCancel = async () => {
    if (!window.confirm(`Cancel "${meeting.title}"? Every invitee will be notified.`)) {
      return
    }
    setCancelling(true)
    setError(null)
    try {
      const res = await fetch("/api/meetings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meeting_id: meeting.id, status: "cancelled" }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) {
        throw new Error(json.error ?? "Could not cancel this meeting")
      }
      onChanged?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not cancel this meeting")
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4 transition-colors hover:border-line-strong sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-display text-base font-semibold text-text-primary">{meeting.title}</h3>
            {meeting.is_group && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-line-strong bg-surface-elevated px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide text-text-muted">
                <Users className="h-3 w-3" /> Group
              </span>
            )}
          </div>
          <p className="mt-1 font-mono text-xs tabular-nums text-text-muted">
            {formatDateTime(meeting.scheduled_at)}
            {meeting.duration_minutes ? ` · ${meeting.duration_minutes} min` : ""}
          </p>
        </div>
        <StatusPill label={MEETING_STATUS_LABEL[meeting.status]} tone={MEETING_STATUS_TONE[meeting.status]} />
      </div>

      {meeting.agenda && <p className="mt-3 line-clamp-2 text-sm text-text-muted">{meeting.agenda}</p>}

      {variant === "hosting" ? (
        <>
          {meeting.invitations.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {meeting.invitations.map((invitation) => (
                <span
                  key={invitation.invitee_id}
                  title={`${invitation.full_name ?? "Invitee"} — ${invitation.status}`}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-elevated px-2.5 py-1 text-xs text-text-muted"
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", INVITEE_DOT_TONE[invitation.status])} />
                  {invitation.full_name ?? "Invitee"}
                  <span className="sr-only"> ({invitation.status})</span>
                </span>
              ))}
            </div>
          )}

          {error && (
            <p role="alert" className="mt-3 text-xs text-accent-danger">
              {error}
            </p>
          )}

          {canAct && (
            <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-border pt-3">
              <Button type="button" variant="destructive" size="sm" onClick={handleCancel} disabled={cancelling}>
                {cancelling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                Cancel
              </Button>
              <Button asChild variant="aurora" size="sm">
                <Link href={`/meet/${meeting.id}`}>Join</Link>
              </Button>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-text-muted">
            Hosted by <span className="text-text-primary">{meeting.organizer_name ?? "Someone"}</span>
          </p>

          {canAct && (
            <div className="mt-4 flex justify-end border-t border-border pt-3">
              <Button asChild variant="aurora" size="sm">
                <Link href={`/meet/${meeting.id}`}>Join</Link>
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
