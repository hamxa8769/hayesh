'use client'

import { Mic, MicOff, Video, VideoOff } from 'lucide-react'
import { useParticipants } from '@livekit/components-react'
import { BottomSheet } from '@/components/video/BottomSheet'
import { parseParticipantMeta } from '@/components/video/room-messaging'

export interface ParticipantsSheetProps {
  open: boolean
  onClose: () => void
  /** Keyed by participant identity. */
  handsRaised: Record<string, boolean>
}

function getRoleLabel(metadata: string | undefined): string | null {
  const meta = parseParticipantMeta(metadata)
  if (meta.isHost) return 'Host'
  if (meta.role === 'admin') return 'Admin'
  if (meta.role) return meta.role.charAt(0).toUpperCase() + meta.role.slice(1)
  return null
}

export function ParticipantsSheet({ open, onClose, handsRaised }: ParticipantsSheetProps) {
  const participants = useParticipants()

  return (
    <BottomSheet open={open} onClose={onClose} title={`Participants (${participants.length})`}>
      <ul className="divide-y divide-border px-2 py-2">
        {participants.map((participant) => {
          const roleLabel = getRoleLabel(participant.metadata)
          const handRaised = Boolean(handsRaised[participant.identity])
          const displayName = participant.name || participant.identity

          return (
            <li key={participant.identity} className="flex items-center gap-3 px-2 py-3">
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
                  <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">{roleLabel}</span>
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
            </li>
          )
        })}
      </ul>
    </BottomSheet>
  )
}
