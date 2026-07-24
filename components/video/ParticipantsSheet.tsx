'use client'

import { useState } from 'react'
import { Mic, MicOff, Video, VideoOff } from 'lucide-react'
import { useParticipants } from '@livekit/components-react'
import { BottomSheet } from '@/components/video/BottomSheet'
import { parseParticipantMeta } from '@/components/video/room-messaging'

export interface ParticipantsSheetProps {
  open: boolean
  onClose: () => void
  /** Keyed by participant identity. */
  handsRaised: Record<string, boolean>
  /** Whether the local participant may mute/remove others (host or admin). */
  canModerate: boolean
  /** The LiveKit room name — required to target moderation actions server-side. */
  roomName: string
}

type ModerateAction = 'mute_participant' | 'remove_participant'

interface RowModerationState {
  pendingAction: ModerateAction | null
  error: string | null
}

function getRoleLabel(metadata: string | undefined): string | null {
  const meta = parseParticipantMeta(metadata)
  if (meta.isHost) return 'Host'
  if (meta.role === 'admin') return 'Admin'
  if (meta.role) return meta.role.charAt(0).toUpperCase() + meta.role.slice(1)
  return null
}

export function ParticipantsSheet({ open, onClose, handsRaised, canModerate, roomName }: ParticipantsSheetProps) {
  const participants = useParticipants()
  const [rowState, setRowState] = useState<Record<string, RowModerationState>>({})

  const runModeration = async (identity: string, action: ModerateAction) => {
    setRowState((current) => ({ ...current, [identity]: { pendingAction: action, error: null } }))

    try {
      const response = await fetch('/api/livekit/moderate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room: roomName, action, target_identity: identity }),
      })
      const data: { ok?: true; error?: string } = await response.json()

      if (!response.ok || !data.ok) {
        setRowState((current) => ({
          ...current,
          [identity]: { pendingAction: null, error: data.error ?? 'Action failed' },
        }))
        return
      }

      setRowState((current) => ({ ...current, [identity]: { pendingAction: null, error: null } }))
    } catch {
      setRowState((current) => ({
        ...current,
        [identity]: { pendingAction: null, error: 'Network error — please try again' },
      }))
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={`Participants (${participants.length})`}>
      <ul className="divide-y divide-border px-2 py-2">
        {participants.map((participant) => {
          const roleLabel = getRoleLabel(participant.metadata)
          const handRaised = Boolean(handsRaised[participant.identity])
          const displayName = participant.name || participant.identity
          const { pendingAction, error } = rowState[participant.identity] ?? { pendingAction: null, error: null }
          const showModerationControls = canModerate && !participant.isLocal

          return (
            <li key={participant.identity} className="flex flex-col gap-2 px-2 py-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-primary/15 font-display text-sm font-semibold text-accent-primary">
                  {displayName.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm text-text-primary">
                      {displayName}
                      {participant.isLocal && <span className="ml-1 text-xs text-text-muted">(you)</span>}
                    </span>
                    {handRaised && (
                      <span aria-label="Hand raised" title="Hand raised">
                        ✋
                      </span>
                    )}
                  </div>
                  {roleLabel && (
                    <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">
                      {roleLabel}
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2 text-text-muted">
                  {participant.isMicrophoneEnabled ? (
                    <Mic className="h-4 w-4" aria-label="Microphone on" />
                  ) : (
                    <MicOff className="h-4 w-4 text-accent-danger" aria-label="Microphone off" />
                  )}
                  {participant.isCameraEnabled ? (
                    <Video className="h-4 w-4" aria-label="Camera on" />
                  ) : (
                    <VideoOff className="h-4 w-4 text-text-disabled" aria-label="Camera off" />
                  )}
                </div>
              </div>

              {showModerationControls && (
                <div className="ml-[52px] flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => runModeration(participant.identity, 'mute_participant')}
                    disabled={pendingAction !== null}
                    className="rounded-md border border-border bg-surface-elevated px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-text-primary transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {pendingAction === 'mute_participant' ? 'Muting…' : 'Mute'}
                  </button>
                  <button
                    type="button"
                    onClick={() => runModeration(participant.identity, 'remove_participant')}
                    disabled={pendingAction !== null}
                    className="rounded-md border border-accent-danger/40 bg-accent-danger/10 px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-accent-danger transition-colors hover:bg-accent-danger/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {pendingAction === 'remove_participant' ? 'Removing…' : 'Remove'}
                  </button>
                </div>
              )}

              {error && (
                <p role="alert" className="ml-[52px] text-xs text-accent-danger">
                  {error}
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </BottomSheet>
  )
}
