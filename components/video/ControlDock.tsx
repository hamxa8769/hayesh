'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { DisconnectButton, TrackToggle, useLocalParticipant } from '@livekit/components-react'
import { Track } from 'livekit-client'
import {
  Check,
  Copy,
  Hand,
  MessageSquare,
  Loader2,
  Mic,
  MicOff,
  PhoneOff,
  Presentation,
  ScreenShare,
  ScreenShareOff,
  Share2,
  Smile,
  Users,
  Video,
  VideoOff,
} from 'lucide-react'
import { InviteePicker, type SelectedUser } from '@/components/meetings/InviteePicker'
import type { PresentRequestState } from '@/components/video/room-messaging'
import { cn } from '@/lib/utils/cn'

const REACTION_EMOJIS = ['👍', '❤️', '😂', '🎉', '👏']

export interface ControlDockProps {
  role: string | null
  isHost: boolean
  /** Keyed by participant identity. */
  handsRaised: Record<string, boolean>
  onToggleChat: () => void
  onToggleParticipants: () => void
  chatUnread: number
  onSendReaction: (emoji: string) => void
  onRaiseHand: (raised: boolean) => void
  /** Whether the local participant may moderate this room (host or admin). */
  canModerate: boolean
  /** The LiveKit room name — required to target moderation actions server-side. */
  roomName: string
  /** Room-wide recording state (host/admin can toggle it). */
  isRecording: boolean
  /** A record start/stop request is in flight. */
  recordingPending: boolean
  /** Start/stop recording — owned by VideoRoom (holds the egress id). */
  onToggleRecording: () => void
  /** Shareable join link for this meeting (empty until resolved client-side). */
  meetingLink: string
  /** Posts the join link into the in-call chat. */
  onShareLinkToChat: () => void
  /** The meeting uuid — target of the in-call invite endpoint. */
  meetingId: string
  /** Whether the local participant may share their screen right now
   *  (host/admin always; attendees only after the host allows it). */
  canPresent: boolean
  /** State of the local participant's own "request to present". */
  presentRequestState: PresentRequestState
  /** Attendee: ask the host for permission to present. */
  onRequestPresent: () => void
}

/** Fixed bottom control bar: mic/camera/screen-share toggles, reactions,
 *  raise-hand, chat, participants, and a visually separated red Leave
 *  button. When `canModerate` is true (host or admin), a "Mute all" button
 *  is also shown, kept visually distinct from Leave since it affects
 *  everyone else in the room. */
export function ControlDock({
  handsRaised,
  onToggleChat,
  onToggleParticipants,
  chatUnread,
  onSendReaction,
  onRaiseHand,
  canModerate,
  roomName,
  isRecording,
  recordingPending,
  onToggleRecording,
  meetingLink,
  onShareLinkToChat,
  meetingId,
  canPresent,
  presentRequestState,
  onRequestPresent,
}: ControlDockProps) {
  const { isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled, localParticipant } = useLocalParticipant()
  const [deviceError, setDeviceError] = useState<string | null>(null)
  const [reactionsOpen, setReactionsOpen] = useState(false)
  const [muteAllPending, setMuteAllPending] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [invitees, setInvitees] = useState<SelectedUser[]>([])
  const [inviting, setInviting] = useState(false)
  const [inviteNotice, setInviteNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  // Screen sharing needs getDisplayMedia, which mobile browsers don't expose —
  // detect on mount and hide the button rather than let it throw "not supported".
  const [canShareScreen, setCanShareScreen] = useState(false)
  const prefersReducedMotion = useReducedMotion()

  useEffect(() => {
    setCanShareScreen(
      typeof navigator !== 'undefined' &&
        !!navigator.mediaDevices &&
        typeof navigator.mediaDevices.getDisplayMedia === 'function'
    )
  }, [])

  // Auto-dismiss transient device/copy errors so they don't stick forever.
  useEffect(() => {
    if (!deviceError) return
    const t = setTimeout(() => setDeviceError(null), 6000)
    return () => clearTimeout(t)
  }, [deviceError])

  const isHandRaised = Boolean(handsRaised[localParticipant.identity])

  const handleCopyLink = async () => {
    if (!meetingLink) return
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(meetingLink)
      } else {
        // Fallback for non-secure contexts (e.g. http:// over a LAN IP) where
        // the async clipboard API isn't available.
        const el = document.createElement('textarea')
        el.value = meetingLink
        el.style.position = 'fixed'
        el.style.opacity = '0'
        document.body.appendChild(el)
        el.focus()
        el.select()
        document.execCommand('copy')
        document.body.removeChild(el)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setDeviceError('Could not copy the link — long-press it to copy manually.')
    }
  }

  const handleNativeShare = async () => {
    if (!meetingLink) return
    // Web Share API → the OS share sheet (WhatsApp, email, etc.). Not on all
    // desktop browsers, so fall back to copying.
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'Join my Hayesh meeting', url: meetingLink })
        setShareOpen(false)
      } catch {
        // user cancelled or share failed — no-op
      }
    } else {
      void handleCopyLink()
    }
  }

  const handleInvite = async () => {
    if (invitees.length === 0) return
    setInviting(true)
    setInviteNotice(null)
    try {
      const response = await fetch(`/api/meetings/${meetingId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitee_ids: invitees.map((user) => user.id) }),
      })
      const data: { invited?: number; already_invited?: number; error?: string } = await response.json()
      if (!response.ok) {
        setInviteNotice({ tone: 'error', text: data.error ?? 'Could not send invitations' })
        return
      }
      const invited = data.invited ?? 0
      const already = data.already_invited ?? 0
      setInvitees([])
      setInviteNotice({
        tone: 'success',
        text:
          `Invited ${invited} ${invited === 1 ? 'person' : 'people'}` +
          (already > 0 ? ` (${already} already invited)` : ''),
      })
    } catch {
      setInviteNotice({ tone: 'error', text: 'Network error — could not send invitations' })
    } finally {
      setInviting(false)
    }
  }

  const handleMuteAll = async () => {
    if (!window.confirm('Mute every other participant in this meeting?')) return

    setMuteAllPending(true)
    try {
      const response = await fetch('/api/livekit/moderate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room: roomName, action: 'mute_all' }),
      })
      const data: { ok?: true; error?: string } = await response.json()
      if (!response.ok || !data.ok) {
        setDeviceError(data.error ?? 'Failed to mute all participants')
      }
    } catch {
      setDeviceError('Network error — could not mute all participants')
    } finally {
      setMuteAllPending(false)
    }
  }

  return (
    <div className="relative shrink-0 border-t border-border bg-surface/95 px-3 py-3 backdrop-blur">
      {(reactionsOpen || shareOpen) && (
        <button
          type="button"
          aria-hidden="true"
          tabIndex={-1}
          onClick={() => {
            setReactionsOpen(false)
            setShareOpen(false)
          }}
          className="fixed inset-0 z-40 cursor-default"
        />
      )}

      {deviceError && (
        <div className="mb-2 rounded-md border border-accent-danger/30 bg-accent-danger/10 px-3 py-2 text-xs text-accent-danger">
          {deviceError}
        </div>
      )}

      <AnimatePresence>
        {reactionsOpen && (
          <motion.div
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-1/2 z-50 mb-2 flex -translate-x-1/2 gap-1 rounded-full border border-line-strong bg-surface px-2 py-2 shadow-[0_8px_30px_rgba(0,0,0,0.6)]"
          >
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onSendReaction(emoji)
                  setReactionsOpen(false)
                }}
                aria-label={`Send ${emoji} reaction`}
                className="flex h-12 w-12 items-center justify-center rounded-full text-2xl transition-colors hover:bg-surface-elevated"
              >
                {emoji}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {shareOpen && (
          <motion.div
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-1/2 z-50 mb-2 w-[min(20rem,90vw)] -translate-x-1/2 rounded-lg border border-line-strong bg-surface p-3 shadow-[0_8px_30px_rgba(0,0,0,0.6)]"
          >
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-text-muted">Invite people</p>
            <div className="mt-2 flex items-center gap-2 rounded-md border border-border bg-surface-elevated px-2.5 py-2">
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-text-primary">
                {meetingLink || 'Preparing link…'}
              </span>
              <button
                type="button"
                onClick={handleCopyLink}
                disabled={!meetingLink}
                aria-label="Copy meeting link"
                className="flex shrink-0 items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-xs text-text-primary transition-colors hover:border-line-strong disabled:opacity-50"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-accent-success" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleNativeShare}
                disabled={!meetingLink}
                className="flex items-center justify-center gap-1.5 rounded-md border border-border bg-surface-elevated px-3 py-2 text-xs font-medium text-text-primary transition-colors hover:border-line-strong disabled:opacity-50"
              >
                <Share2 className="h-3.5 w-3.5" /> Share…
              </button>
              <button
                type="button"
                onClick={() => {
                  onShareLinkToChat()
                  setShareOpen(false)
                }}
                disabled={!meetingLink}
                className="flex items-center justify-center gap-1.5 rounded-md border border-accent-primary/40 bg-accent-primary/10 px-3 py-2 text-xs font-medium text-accent-primary transition-colors hover:bg-accent-primary/20 disabled:opacity-50"
              >
                <MessageSquare className="h-3.5 w-3.5" /> Send in chat
              </button>
            </div>
            {canModerate && (
              <div className="mt-3 border-t border-border pt-3">
                <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-text-muted">
                  Invite registered users
                </p>
                <div className="mt-2">
                  <InviteePicker value={invitees} onChange={setInvitees} />
                </div>
                {inviteNotice && (
                  <p
                    role="status"
                    className={cn(
                      'mt-2 text-xs',
                      inviteNotice.tone === 'success' ? 'text-accent-success' : 'text-accent-danger'
                    )}
                  >
                    {inviteNotice.text}
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleInvite}
                  disabled={inviting || invitees.length === 0}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-accent-primary/40 bg-accent-primary/10 px-3 py-2 text-xs font-medium text-accent-primary transition-colors hover:bg-accent-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {inviting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {inviting ? 'Inviting…' : `Invite${invitees.length > 0 ? ` ${invitees.length}` : ''}`}
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <TrackToggle
            source={Track.Source.Microphone}
            showIcon={false}
            onDeviceError={(error) => setDeviceError(error.message)}
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-full border transition-colors',
              isMicrophoneEnabled
                ? 'border-border bg-surface-elevated text-text-primary hover:bg-surface'
                : 'border-accent-danger/40 bg-accent-danger/10 text-accent-danger'
            )}
            aria-label={isMicrophoneEnabled ? 'Mute microphone' : 'Unmute microphone'}
          >
            {isMicrophoneEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </TrackToggle>

          <TrackToggle
            source={Track.Source.Camera}
            showIcon={false}
            onDeviceError={(error) => setDeviceError(error.message)}
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-full border transition-colors',
              isCameraEnabled
                ? 'border-border bg-surface-elevated text-text-primary hover:bg-surface'
                : 'border-accent-danger/40 bg-accent-danger/10 text-accent-danger'
            )}
            aria-label={isCameraEnabled ? 'Turn camera off' : 'Turn camera on'}
          >
            {isCameraEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </TrackToggle>

          {canShareScreen && !canPresent && (
            <button
              type="button"
              onClick={onRequestPresent}
              disabled={presentRequestState === 'pending'}
              aria-label={
                presentRequestState === 'pending'
                  ? 'Waiting for the host to allow presenting'
                  : 'Request to present'
              }
              title={
                presentRequestState === 'pending'
                  ? 'Waiting for the host…'
                  : presentRequestState === 'denied'
                    ? 'The host declined — tap to ask again'
                    : 'Request to present'
              }
              className={cn(
                'relative flex h-12 w-12 items-center justify-center rounded-full border transition-colors disabled:cursor-not-allowed',
                presentRequestState === 'pending'
                  ? 'border-accent-warning/40 bg-accent-warning/10 text-accent-warning'
                  : presentRequestState === 'denied'
                    ? 'border-accent-danger/40 bg-accent-danger/10 text-accent-danger'
                    : 'border-border bg-surface-elevated text-text-primary hover:bg-surface'
              )}
            >
              <Presentation className="h-5 w-5" />
            </button>
          )}

          {canShareScreen && canPresent && (
            <TrackToggle
              source={Track.Source.ScreenShare}
              showIcon={false}
              onDeviceError={(error) => setDeviceError(error.message)}
              className={cn(
                'flex h-12 w-12 items-center justify-center rounded-full border transition-colors',
                isScreenShareEnabled
                  ? 'border-accent-primary/40 bg-accent-primary/10 text-accent-primary'
                  : 'border-border bg-surface-elevated text-text-primary hover:bg-surface'
              )}
              aria-label={isScreenShareEnabled ? 'Stop screen share' : 'Share your screen'}
            >
              {isScreenShareEnabled ? <ScreenShareOff className="h-5 w-5" /> : <ScreenShare className="h-5 w-5" />}
            </TrackToggle>
          )}

          <button
            type="button"
            onClick={() => setReactionsOpen((current) => !current)}
            aria-label="Send a reaction"
            aria-expanded={reactionsOpen}
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-full border transition-colors',
              reactionsOpen
                ? 'border-accent-primary/40 bg-accent-primary/10 text-accent-primary'
                : 'border-border bg-surface-elevated text-text-primary hover:bg-surface'
            )}
          >
            <Smile className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={() => onRaiseHand(!isHandRaised)}
            aria-label={isHandRaised ? 'Lower hand' : 'Raise hand'}
            aria-pressed={isHandRaised}
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-full border transition-colors',
              isHandRaised
                ? 'border-accent-warning/40 bg-accent-warning/10 text-accent-warning'
                : 'border-border bg-surface-elevated text-text-primary hover:bg-surface'
            )}
          >
            <Hand className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={onToggleChat}
            aria-label="Toggle chat"
            className="relative flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface-elevated text-text-primary transition-colors hover:bg-surface"
          >
            <MessageSquare className="h-5 w-5" />
            {chatUnread > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-danger px-1 font-mono text-[10px] font-semibold text-white">
                {chatUnread > 9 ? '9+' : chatUnread}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={onToggleParticipants}
            aria-label="Toggle participants list"
            className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface-elevated text-text-primary transition-colors hover:bg-surface"
          >
            <Users className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={() => setShareOpen((current) => !current)}
            aria-label="Invite / share meeting link"
            aria-expanded={shareOpen}
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-full border transition-colors',
              shareOpen
                ? 'border-accent-primary/40 bg-accent-primary/10 text-accent-primary'
                : 'border-border bg-surface-elevated text-text-primary hover:bg-surface'
            )}
          >
            <Share2 className="h-5 w-5" />
          </button>
        </div>

        {canModerate && (
          <button
            type="button"
            onClick={handleMuteAll}
            disabled={muteAllPending}
            aria-label="Mute all participants"
            className="ml-2 flex h-12 items-center justify-center rounded-full border border-accent-warning/40 bg-accent-warning/10 px-4 font-mono text-xs uppercase tracking-[0.08em] text-accent-warning transition-colors hover:bg-accent-warning/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {muteAllPending ? 'Muting…' : 'Mute all'}
          </button>
        )}

        {canModerate && (
          <button
            type="button"
            onClick={onToggleRecording}
            disabled={recordingPending}
            aria-label={isRecording ? 'Stop recording' : 'Start recording'}
            aria-pressed={isRecording}
            className={cn(
              'flex h-12 items-center justify-center gap-2 rounded-full border px-4 font-mono text-xs uppercase tracking-[0.08em] transition-colors disabled:cursor-not-allowed disabled:opacity-50',
              isRecording
                ? 'border-accent-danger/40 bg-accent-danger/15 text-accent-danger hover:bg-accent-danger/25'
                : 'border-border bg-surface-elevated text-text-primary hover:bg-surface'
            )}
          >
            <span
              className={cn(
                'h-2.5 w-2.5 rounded-full',
                isRecording ? 'animate-pulse bg-accent-danger' : 'bg-accent-danger/70'
              )}
            />
            {recordingPending ? '…' : isRecording ? 'Stop' : 'Record'}
          </button>
        )}

        <DisconnectButton
          className="ml-2 flex h-12 w-12 items-center justify-center rounded-full bg-accent-danger text-white transition-colors hover:bg-accent-danger/90"
          aria-label="Leave meeting"
        >
          <PhoneOff className="h-5 w-5" />
        </DisconnectButton>
      </div>
    </div>
  )
}
