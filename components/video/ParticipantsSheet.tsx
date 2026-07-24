'use client'

import { useState } from 'react'
import { Mic, MicOff, UserCheck, Video, VideoOff } from 'lucide-react'
import { useParticipants, useRemoteParticipants } from '@livekit/components-react'
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

interface AdmitRowState {
  pending: boolean
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
  const remoteParticipants = useRemoteParticipants()
  const [rowState, setRowState] = useState<Record<string, RowModerationState>>({})
  const [admitState, setAdmitState] = useState<Record<string, AdmitRowState>>({})

  // A remote participant is "waiting" when LiveKit has NOT granted them
  // canSubscribe — i.e. they connected under a waiting-room token (see
  // app/api/livekit/token/route.ts) and the host hasn't admitted them yet.
  // `permissions` is undefined until LiveKit resolves it for that
  // participant; treat that as "normal/admitted" so nobody briefly shows up
  // as waiting by accident.
  const waitingParticipants = remoteParticipants.filter(
    (participant) => participant.permissions?.canSubscribe === false
  )
  const waitingIdentities = new Set(waitingParticipants.map((participant) => participant.identity))
  // Keep the existing list below scoped to admitted participants so nobody
  // waiting shows up twice.
  const admittedParticipants = participants.filter((participant) => !waitingIdentities.has(participant.identity))

  const runAdmit = async (identity: string) => {
    setAdmitState((current) => ({ ...current, [identity]: { pending: true, error: null } }))

    try {
      const response = await fetch('/api/livekit/admit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room: roomName, target_identity: identity }),
      })
      const data: { ok?: true; error?: string } = await response.json()

      if (!response.ok || !data.ok) {
        setAdmitState((current) => ({
          ...current,
          [identity]: { pending: false, error: data.error ?? 'Could not admit this participant' },
        }))
        return
      }

      // On success the participant's own permissions change fires
      // ParticipantPermissionsChanged, which drops them out of
      // remoteParticipants.filter(canSubscribe === false) automatically —
      // no local state to clear beyond the pending flag.
      setAdmitState((current) => ({ ...current, [identity]: { pending: false, error: null } }))
    } catch {
      setAdmitState((current) => ({
        ...current,
        [identity]: { pending: false, error: 'Network error — please try again' },
      }))
    }
  }

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
    <BottomSheet open={open} onClose={onClose} title={`Participants (${admittedParticipants.length})`}>
      {canModerate && waitingParticipants.length > 0 && (
        <div className="border-b border-border px-2 py-2">
          <div className="flex items-center gap-2 px-2 py-1">
            <UserCheck className="h-3.5 w-3.5 text-accent-warning" />
            <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-accent-warning">
              Waiting room ({waitingParticipants.length})
            </span>
          </div>
          <ul className="divide-y divide-border">
            {waitingParticipants.map((participant) => {
              const displayName = participant.name || participant.identity
              const { pending, error } = admitState[participant.identity] ?? { pending: false, error: null }

              return (
                <li key={participant.identity} className="flex flex-col gap-2 px-2 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-warning/15 font-display text-sm font-semibold text-accent-warning">
                      {displayName.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="truncate text-sm text-text-primary">{displayName}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => runAdmit(participant.identity)}
                      disabled={pending}
                      className="shrink-0 rounded-md border border-accent-primary/40 bg-accent-primary/10 px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-accent-primary transition-colors hover:bg-accent-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {pending ? 'Admitting…' : 'Admit'}
                    </button>
                  </div>
                  {error && (
                    <p role="alert" className="ml-[52px] text-xs text-accent-danger">
                      {error}
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <ul className="divide-y divide-border px-2 py-2">
        {admittedParticipants.map((participant) => {
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
