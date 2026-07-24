"use client"

import { useState } from "react"
import Link from "next/link"
import { Check, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { StatusPill, type PillTone } from "@/components/teacher/StatusPill"
import { formatDateTime } from "@/lib/utils/format"

export interface InvitationInboxItem {
  invitation_id: string
  invitation_status: "invited" | "accepted" | "declined"
  meeting_id: string
  title: string
  scheduled_at: string
  duration_minutes: number | null
  meeting_status: "scheduled" | "completed" | "cancelled"
  organizer_name: string | null
}

export interface InvitationInboxProps {
  invitations: InvitationInboxItem[]
  onChanged: () => void
}

const INVITATION_TONE: Record<InvitationInboxItem["invitation_status"], PillTone> = {
  invited: "neutral",
  accepted: "success",
  declined: "danger",
}

/** The caller's invitation inbox — accept/decline pending invites, join ones already accepted. */
export function InvitationInbox({ invitations, onChanged }: InvitationInboxProps) {
  const [respondingId, setRespondingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const respond = async (invitationId: string, status: "accepted" | "declined") => {
    setRespondingId(invitationId)
    setError(null)
    try {
      const res = await fetch("/api/meetings/invitations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitation_id: invitationId, status }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) {
        throw new Error(json.error ?? "Could not update this invitation")
      }
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update this invitation")
    } finally {
      setRespondingId(null)
    }
  }

  if (invitations.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-6 text-center">
        <p className="text-sm text-text-muted">No invitations yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {error && (
        <p role="alert" className="text-xs text-accent-danger">
          {error}
        </p>
      )}
      {invitations.map((invitation) => {
        const canRespond = invitation.invitation_status === "invited" && invitation.meeting_status !== "cancelled"
        const canJoin = invitation.invitation_status === "accepted" && invitation.meeting_status === "scheduled"
        const isResponding = respondingId === invitation.invitation_id

        return (
          <div
            key={invitation.invitation_id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4 transition-colors hover:border-line-strong"
          >
            <div className="min-w-0">
              <p className="truncate font-display text-sm font-semibold text-text-primary">{invitation.title}</p>
              <p className="mt-0.5 truncate text-xs text-text-muted">
                Hosted by <span className="text-text-primary">{invitation.organizer_name ?? "Someone"}</span>
              </p>
              <p className="mt-1 font-mono text-xs tabular-nums text-text-muted">
                {formatDateTime(invitation.scheduled_at)}
                {invitation.duration_minutes ? ` · ${invitation.duration_minutes} min` : ""}
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <StatusPill label={invitation.invitation_status} tone={INVITATION_TONE[invitation.invitation_status]} />
              {canRespond && (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={isResponding}
                    onClick={() => respond(invitation.invitation_id, "declined")}
                  >
                    {isResponding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                    Decline
                  </Button>
                  <Button
                    type="button"
                    variant="aurora"
                    size="sm"
                    disabled={isResponding}
                    onClick={() => respond(invitation.invitation_id, "accepted")}
                  >
                    {isResponding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    Accept
                  </Button>
                </>
              )}
              {canJoin && (
                <Button asChild variant="aurora" size="sm">
                  <Link href={`/meet/${invitation.meeting_id}`}>Join</Link>
                </Button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
