'use client'

import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { DisconnectButton, TrackToggle, useLocalParticipant } from '@livekit/components-react'
import { Track } from 'livekit-client'
import {
  Hand,
  MessageSquare,
  Mic,
  MicOff,
  PhoneOff,
  ScreenShare,
  ScreenShareOff,
  Smile,
  Users,
  Video,
  VideoOff,
} from 'lucide-react'
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
}: ControlDockProps) {
  const { isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled, localParticipant } = useLocalParticipant()
  const [deviceError, setDeviceError] = useState<string | null>(null)
  const [reactionsOpen, setReactionsOpen] = useState(false)
  const [muteAllPending, setMuteAllPending] = useState(false)
  const prefersReducedMotion = useReducedMotion()

  const isHandRaised = Boolean(handsRaised[localParticipant.identity])

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
            className="glass absolute bottom-full left-1/2 mb-2 flex -translate-x-1/2 gap-1 rounded-full border border-line-strong px-2 py-2"
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

          <TrackToggle
            source={Track.Source.ScreenShare}
            showIcon={false}
            onDeviceError={(error) => setDeviceError(error.message)}
            className={cn(
              'hidden h-12 w-12 items-center justify-center rounded-full border transition-colors sm:flex',
              isScreenShareEnabled
                ? 'border-accent-primary/40 bg-accent-primary/10 text-accent-primary'
                : 'border-border bg-surface-elevated text-text-primary hover:bg-surface'
            )}
            aria-label={isScreenShareEnabled ? 'Stop screen share' : 'Share your screen'}
          >
            {isScreenShareEnabled ? <ScreenShareOff className="h-5 w-5" /> : <ScreenShare className="h-5 w-5" />}
          </TrackToggle>

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
