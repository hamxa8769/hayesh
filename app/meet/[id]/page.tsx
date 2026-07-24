import Link from 'next/link'
import { ShieldAlert, CalendarX2, SearchX, LogIn } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Button } from '@/components/ui/button'
import { PreJoin } from '@/components/video/PreJoin'
import { formatDateTime } from '@/lib/utils/format'

/**
 * /meet/[id] — the meeting room page.
 *
 * Server Component: fetches + authorises the meeting server-side (mirroring
 * the same organizer/participant/admin rule as POST /api/livekit/token), so
 * "not authorised" and "not found" render as genuinely distinct states
 * instead of both collapsing to a blank screen. The interactive join flow
 * (device check -> token fetch -> the actual call) lives entirely inside
 * the client component <PreJoin>, which this page only hands serializable
 * props to.
 *
 * Uses the service-role admin client for the lookup, not the RLS-scoped
 * cookie client — see the comment in app/api/livekit/token/route.ts for why
 * an RLS-scoped lookup can't tell "exists but not yours" apart from
 * "doesn't exist".
 */

interface MeetPageProps {
  params: Promise<{ id: string }>
}

function StateCard({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: typeof ShieldAlert
  title: string
  description: string
  action?: { href: string; label: string }
}) {
  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface-elevated p-6 text-center">
        <Icon className="mx-auto h-6 w-6 text-text-muted" />
        <p className="mt-3 font-display text-lg font-semibold text-text-primary">{title}</p>
        <p className="mt-2 text-sm text-text-muted">{description}</p>
        {action && (
          <Button asChild className="mt-4 w-full">
            <Link href={action.href}>{action.label}</Link>
          </Button>
        )}
      </div>
    </div>
  )
}

export default async function MeetPage({ params }: MeetPageProps) {
  const { id } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <StateCard
        icon={LogIn}
        title="Sign in to join"
        description="You need to be signed in to enter this meeting."
        action={{ href: `/auth/login?redirect=/meet/${id}`, label: 'Sign in' }}
      />
    )
  }

  const adminClient = createAdminClient()

  const { data: meeting } = await adminClient
    .from('meetings')
    .select('id, organizer_id, participant_id, is_group, title, agenda, scheduled_at, duration_minutes, status')
    .eq('id', id)
    .maybeSingle()

  if (!meeting) {
    return (
      <StateCard
        icon={SearchX}
        title="Meeting not found"
        description="This meeting link doesn't point to a meeting that exists."
      />
    )
  }

  const { data: viewerProfile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()

  const isOrganizer = meeting.organizer_id === user.id
  const isParticipant = meeting.participant_id === user.id
  const isAdmin = viewerProfile?.role === 'admin'

  // Group meetings (migration 016) authorise attendees through
  // meeting_invitations, not participant_id — mirror the same invitee check
  // the token route enforces so this page and the token grant never disagree.
  let isInvitee = false
  if (!isOrganizer && !isParticipant && !isAdmin) {
    const { data: invitation } = await adminClient
      .from('meeting_invitations')
      .select('id')
      .eq('meeting_id', meeting.id)
      .eq('invitee_id', user.id)
      .in('status', ['invited', 'accepted'])
      .maybeSingle()
    isInvitee = invitation !== null
  }

  if (!isOrganizer && !isParticipant && !isAdmin && !isInvitee) {
    return (
      <StateCard
        icon={ShieldAlert}
        title="Not authorised"
        description="You weren't invited to this meeting, so you can't join it."
      />
    )
  }

  if (meeting.status === 'cancelled') {
    return (
      <StateCard
        icon={CalendarX2}
        title="Meeting cancelled"
        description={`"${meeting.title}" was cancelled and is no longer joinable.`}
      />
    )
  }

  // Who "the other party" is depends on the meeting shape. In a group room the
  // organizer has many invitees (no single counterpart), so label it as such;
  // everyone else (invitee or 1:1 participant) sees the organizer/host.
  const otherPartyId = isOrganizer ? meeting.participant_id : meeting.organizer_id
  const { data: otherProfile } = otherPartyId
    ? await adminClient.from('profiles').select('full_name').eq('id', otherPartyId).maybeSingle()
    : { data: null }
  const otherPartyName =
    meeting.is_group && isOrganizer
      ? 'your invitees'
      : otherProfile?.full_name || (meeting.is_group ? 'your host' : 'the other participant')

  return (
    <div className="min-h-screen bg-background px-3 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-3xl">
        {meeting.status === 'completed' && (
          <p className="mb-4 rounded-lg border border-accent-warning/30 bg-accent-warning/5 px-3 py-2 text-center text-xs text-accent-warning">
            This meeting was already marked complete. You can still open the room below.
          </p>
        )}
        <PreJoin
          meetingId={meeting.id}
          title={meeting.title}
          scheduledAt={meeting.scheduled_at}
          durationMinutes={meeting.duration_minutes ?? 30}
          otherPartyName={otherPartyName}
        />
        <p className="mt-6 text-center font-mono text-xs text-text-disabled">
          Scheduled for {formatDateTime(meeting.scheduled_at)} · {meeting.duration_minutes ?? 30} min
        </p>
      </div>
    </div>
  )
}
