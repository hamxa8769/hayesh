'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  LiveKitRoom,
  RoomAudioRenderer,
  TrackToggle,
  DisconnectButton,
  ParticipantTile,
  useTracks,
  useParticipants,
  useConnectionState,
  useLocalParticipant,
  useRoomContext,
} from '@livekit/components-react'
import { ConnectionState, Track } from 'livekit-client'
import type { TrackReference } from '@livekit/components-core'
import { Mic, MicOff, Video, VideoOff, ScreenShare, ScreenShareOff, PhoneOff, Users, X, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

/**
 * VideoRoom — the actual LiveKit call surface. This component (and every
 * hook/component it renders from @livekit/components-react) must NEVER run
 * during SSR: the caller (components/video/PreJoin.tsx) loads it via
 * `next/dynamic(..., { ssr: false })`, mirroring the mount-gate pattern
 * components/three/ConstellationField.tsx already uses for its WebGL canvas
 * after this repo's production React #418 hydration crash. Do not import
 * this component directly anywhere else without the same ssr:false guard.
 */

export interface VideoRoomProps {
  token: string
  serverUrl: string
  roomName: string
  initialAudioEnabled: boolean
  initialVideoEnabled: boolean
  audioDeviceId?: string
  videoDeviceId?: string
  onLeave: () => void
}

export function VideoRoom({
  token,
  serverUrl,
  roomName,
  initialAudioEnabled,
  initialVideoEnabled,
  audioDeviceId,
  videoDeviceId,
  onLeave,
}: VideoRoomProps) {
  const [connectionError, setConnectionError] = useState<string | null>(null)

  return (
    <div className="flex min-h-[60vh] w-full max-w-full flex-col overflow-hidden rounded-lg border border-border bg-surface">
      {/* @livekit/components-styles is NOT installed in this project (not
          in package.json/node_modules, and adding a dependency is out of
          scope), so ParticipantTile's internal <video>/<audio> elements
          have no default sizing. styled-jsx ships built into Next.js
          itself (no new dependency) and is used here purely to make the
          LiveKit-rendered media fill its tile — every other visual choice
          in this file is plain Tailwind classes via componentProps. */}
      <style jsx global>{`
        .lk-participant-tile {
          position: relative;
          width: 100%;
          height: 100%;
        }
        .lk-participant-tile video,
        .lk-participant-tile audio {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .lk-participant-placeholder {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-text-muted);
        }
      `}</style>
      <LiveKitRoom
        serverUrl={serverUrl}
        token={token}
        connect
        audio={initialAudioEnabled ? (audioDeviceId ? { deviceId: audioDeviceId } : true) : false}
        video={initialVideoEnabled ? (videoDeviceId ? { deviceId: videoDeviceId } : true) : false}
        onDisconnected={() => onLeave()}
        onError={(error) => setConnectionError(error.message)}
        className="flex min-h-[60vh] w-full max-w-full flex-1 flex-col"
      >
        <RoomAudioRenderer />
        <RoomInterior roomName={roomName} connectionError={connectionError} onDismissError={() => setConnectionError(null)} />
      </LiveKitRoom>
    </div>
  )
}

interface RoomInteriorProps {
  roomName: string
  connectionError: string | null
  onDismissError: () => void
}

function RoomInterior({ roomName, connectionError, onDismissError }: RoomInteriorProps) {
  const room = useRoomContext()
  const connectionState = useConnectionState(room)
  const participants = useParticipants()
  const { isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } = useLocalParticipant()
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare], { onlySubscribed: false })
  const [participantListOpen, setParticipantListOpen] = useState(false)
  const [deviceError, setDeviceError] = useState<string | null>(null)
  const prefersReducedMotion = useReducedMotion()

  // Defensive cleanup: LiveKitRoom already disconnects on unmount, but this
  // guarantees it — a leaked room connection keeps the camera light on and
  // is a real privacy problem, not just a resource leak. Explicitly stopping
  // local track media (not just unpublishing) ensures the OS camera/mic
  // indicator actually turns off.
  useEffect(() => {
    return () => {
      room.localParticipant.trackPublications.forEach((publication) => {
        publication.track?.stop()
      })
      room.disconnect()
    }
  }, [room])

  const isReconnecting =
    connectionState === ConnectionState.Reconnecting || connectionState === ConnectionState.SignalReconnecting
  const isConnecting = connectionState === ConnectionState.Connecting

  return (
    <div className="relative flex flex-1 flex-col">
      {(isReconnecting || isConnecting || connectionError) && (
        <div className="absolute inset-x-0 top-0 z-20 flex justify-center p-2">
          <div
            className={cn(
              'flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-xs',
              connectionError
                ? 'border-accent-danger/40 bg-accent-danger/10 text-accent-danger'
                : 'border-accent-warning/40 bg-accent-warning/10 text-accent-warning'
            )}
          >
            <WifiOff className="h-3.5 w-3.5 shrink-0" />
            <span className="max-w-[70vw] truncate sm:max-w-xs">
              {connectionError ?? (isConnecting ? 'Connecting…' : 'Reconnecting…')}
            </span>
            {connectionError && (
              <button type="button" onClick={onDismissError} className="shrink-0 text-accent-danger/80 hover:text-accent-danger">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-2 sm:p-3">
        {tracks.length > 0 ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {tracks.map((trackRef) => (
              <TileFrame key={`${trackRef.participant.identity}-${trackRef.source}`} trackRef={trackRef} />
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-center gap-3 py-10">
            {participants.map((participant) => (
              <div
                key={participant.identity}
                className="flex flex-col items-center gap-2 rounded-lg border border-border bg-surface-elevated px-4 py-3"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-primary/15 font-display text-lg font-semibold text-accent-primary">
                  {(participant.name || participant.identity).slice(0, 1).toUpperCase()}
                </span>
                <span className="max-w-[8rem] truncate text-xs text-text-muted">{participant.name || participant.identity}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {participantListOpen && (
          <motion.div
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-x-2 bottom-20 z-30 max-h-64 overflow-y-auto rounded-lg border border-line-strong bg-surface-elevated p-3 shadow-[0_8px_30px_rgba(0,0,0,0.5)] sm:right-3 sm:left-auto sm:w-72"
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">
                Participants ({participants.length})
              </p>
              <button type="button" onClick={() => setParticipantListOpen(false)} className="text-text-muted hover:text-text-primary">
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="space-y-1.5">
              {participants.map((participant) => (
                <li key={participant.identity} className="flex items-center justify-between gap-2 text-sm text-text-primary">
                  <span className="truncate">{participant.name || participant.identity}</span>
                  {participant.isLocal && <span className="shrink-0 text-xs text-text-muted">(you)</span>}
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>

      {deviceError && (
        <div className="mx-2 mb-2 rounded-md border border-accent-danger/30 bg-accent-danger/10 px-3 py-2 text-xs text-accent-danger sm:mx-3">
          {deviceError}
        </div>
      )}

      <div className="flex shrink-0 flex-wrap items-center justify-center gap-3 border-t border-border bg-surface/95 px-3 py-3 backdrop-blur">
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
          onClick={() => setParticipantListOpen((open) => !open)}
          className={cn(
            'flex h-12 w-12 items-center justify-center rounded-full border transition-colors',
            participantListOpen
              ? 'border-accent-primary/40 bg-accent-primary/10 text-accent-primary'
              : 'border-border bg-surface-elevated text-text-primary hover:bg-surface'
          )}
          aria-label="Toggle participant list"
        >
          <Users className="h-5 w-5" />
        </button>

        <DisconnectButton
          className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-danger text-white transition-colors hover:bg-accent-danger/90"
          aria-label="Leave meeting"
        >
          <PhoneOff className="h-5 w-5" />
        </DisconnectButton>
      </div>

      <p className="sr-only">Room: {roomName}</p>
    </div>
  )
}

function TileFrame({ trackRef }: { trackRef: TrackReference }) {
  const isScreenShare = trackRef.source === Track.Source.ScreenShare
  return (
    <ParticipantTile
      trackRef={trackRef}
      className={cn(
        'aspect-video w-full overflow-hidden rounded-lg border border-border bg-surface-elevated',
        isScreenShare && 'sm:col-span-2 lg:col-span-3'
      )}
    />
  )
}
