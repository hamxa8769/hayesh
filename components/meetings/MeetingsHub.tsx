"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AlertTriangle, CalendarClock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Reveal } from "@/components/motion/Reveal"
import { CreateMeetingModal } from "@/components/meetings/CreateMeetingModal"
import { InvitationInbox, type InvitationInboxItem } from "@/components/meetings/InvitationInbox"
import { MeetingCard, type HostingMeetingData, type InvitedMeetingData } from "@/components/meetings/MeetingCard"
import { useSupabase } from "@/hooks/useSupabase"

interface MeetingsApiResponse {
  hosting?: HostingMeetingData[]
  invited?: InvitedMeetingData[]
  error?: string
}

interface InvitationsApiResponse {
  invitations?: InvitationInboxItem[]
  error?: string
}

type MeetingItem =
  | { variant: "hosting"; meeting: HostingMeetingData }
  | { variant: "invited"; meeting: InvitedMeetingData }

const HOST_ROLES = new Set(["teacher", "seller", "admin"])

function SkeletonRows({ count }: { count: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="h-24 animate-pulse rounded-lg border border-border bg-surface-elevated/60" />
      ))}
    </div>
  )
}

function EmptyNote({ message }: { message: string }) {
  return (
    <p className="mt-3 rounded-lg border border-border bg-surface p-6 text-center text-sm text-text-muted">
      {message}
    </p>
  )
}

function MeetingList({ items, onChanged }: { items: MeetingItem[]; onChanged: () => void }) {
  return (
    <div className="mt-3 space-y-3">
      {items.map((item) =>
        item.variant === "hosting" ? (
          <MeetingCard key={item.meeting.id} variant="hosting" meeting={item.meeting} onChanged={onChanged} />
        ) : (
          <MeetingCard key={item.meeting.id} variant="invited" meeting={item.meeting} onChanged={onChanged} />
        )
      )}
    </div>
  )
}

/**
 * /meetings coordinator — fetches GET /api/meetings + GET /api/meetings/invitations
 * in parallel and splits the combined hosting+invited rows into Upcoming and
 * Past. A meeting the caller hosts is never one they're also invited to (the
 * organizer isn't their own invitee), so the two lists need no de-dup pass.
 */
export function MeetingsHub() {
  const { profile } = useSupabase()
  const [hosting, setHosting] = useState<HostingMeetingData[]>([])
  const [invited, setInvited] = useState<InvitedMeetingData[]>([])
  const [invitations, setInvitations] = useState<InvitationInboxItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const hasLoadedRef = useRef(false)
  const requestIdRef = useRef(0)

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current
    if (!hasLoadedRef.current) {
      setLoading(true)
    }
    setError(null)
    try {
      const [meetingsRes, invitationsRes] = await Promise.all([
        fetch("/api/meetings"),
        fetch("/api/meetings/invitations"),
      ])
      const meetingsJson = (await meetingsRes.json()) as MeetingsApiResponse
      const invitationsJson = (await invitationsRes.json()) as InvitationsApiResponse

      if (!meetingsRes.ok) {
        throw new Error(meetingsJson.error ?? "Could not load your meetings")
      }
      if (!invitationsRes.ok) {
        throw new Error(invitationsJson.error ?? "Could not load your invitations")
      }

      if (requestIdRef.current !== requestId) return

      setHosting(meetingsJson.hosting ?? [])
      setInvited(meetingsJson.invited ?? [])
      setInvitations(invitationsJson.invitations ?? [])
    } catch (e) {
      if (requestIdRef.current !== requestId) return
      setError(e instanceof Error ? e.message : "Could not load your meetings")
    } finally {
      if (requestIdRef.current === requestId) {
        hasLoadedRef.current = true
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const canHost = Boolean(profile && HOST_ROLES.has(profile.role))

  const items: MeetingItem[] = [
    ...hosting.map((meeting) => ({ variant: "hosting" as const, meeting })),
    ...invited.map((meeting) => ({ variant: "invited" as const, meeting })),
  ]

  const now = Date.now()
  const isUpcoming = (item: MeetingItem) =>
    item.meeting.status === "scheduled" && new Date(item.meeting.scheduled_at).getTime() > now

  const upcoming = items
    .filter(isUpcoming)
    .sort((a, b) => new Date(a.meeting.scheduled_at).getTime() - new Date(b.meeting.scheduled_at).getTime())

  const past = items
    .filter((item) => !isUpcoming(item))
    .sort((a, b) => new Date(b.meeting.scheduled_at).getTime() - new Date(a.meeting.scheduled_at).getTime())

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Meetings</p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.02em] text-text-primary sm:text-4xl">
            Your meeting room
          </h1>
          <p className="mt-2 max-w-xl text-sm text-text-muted">
            Schedule and join video sessions with the people you work with on Hayesh.
          </p>
        </div>
        {canHost && (
          <Button type="button" variant="aurora" onClick={() => setCreateOpen(true)}>
            <CalendarClock className="h-4 w-4" />
            Host a Meeting
          </Button>
        )}
      </div>

      {loading ? (
        <div className="mt-8">
          <SkeletonRows count={3} />
        </div>
      ) : error ? (
        <div className="mt-8 rounded-lg border border-border bg-surface p-6 text-center">
          <AlertTriangle className="mx-auto mb-2 h-5 w-5 text-accent-danger" />
          <p className="text-sm text-accent-danger">{error}</p>
          <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={refresh}>
            Try again
          </Button>
        </div>
      ) : (
        <div className="mt-8 space-y-10">
          <Reveal>
            <section>
              <h2 className="font-display text-lg font-semibold text-text-primary">Upcoming</h2>
              {upcoming.length === 0 ? (
                <EmptyNote
                  message={canHost ? "No upcoming meetings. Host one to get started." : "No upcoming meetings yet."}
                />
              ) : (
                <MeetingList items={upcoming} onChanged={refresh} />
              )}
            </section>
          </Reveal>

          <Reveal delay={0.1}>
            <section>
              <h2 className="font-display text-lg font-semibold text-text-primary">Invitations</h2>
              <div className="mt-3">
                <InvitationInbox invitations={invitations} onChanged={refresh} />
              </div>
            </section>
          </Reveal>

          <Reveal delay={0.2}>
            <section>
              <h2 className="font-display text-lg font-semibold text-text-muted">Past</h2>
              {past.length === 0 ? (
                <EmptyNote message="No past meetings yet." />
              ) : (
                <div className="opacity-80">
                  <MeetingList items={past} onChanged={refresh} />
                </div>
              )}
            </section>
          </Reveal>
        </div>
      )}

      <CreateMeetingModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={refresh} />
    </div>
  )
}
