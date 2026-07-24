'use client'

import { useEffect, useState } from 'react'
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useConnectionState,
  useLocalParticipant,
  useRoomContext,
} from '@livekit/components-react'
import { ConnectionState } from 'livekit-client'
import { X, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { MeetingStage } from '@/components/video/MeetingStage'
import { ControlDock } from '@/components/video/ControlDock'
import { ChatSheet } from '@/components/video/ChatSheet'
import { ParticipantsSheet } from '@/components/video/ParticipantsSheet'
import { ReactionsOverlay } from '@/components/video/ReactionsOverlay'
import { Lobby } from '@/components/video/Lobby'
import { useRoomMessaging } from '@/components/video/room-messaging'

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
  /** The local joiner's platform role (from the token route). */
  role?: string | null
  /** Whether the local joiner is this meeting's host (organizer). */
  isHost?: boolean
  /** Whether the local joiner is already admitted into the room (i.e. not
   *  stuck in the meeting's waiting room). Defaults to true so meetings
   *  without a waiting room behave exactly as before. When false, the
   *  joiner connects but must not attempt to publish audio/video until the
   *  host admits them — see the gate below. */
  admitted?: boolean
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
  role = null,
  isHost = false,
  admitted = true,
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
      {/* adaptiveStream: automatically drops the received resolution of tiles
          that are small/off-screen; dynacast: pauses layers no one is
          subscribed to. Together they cut mobile bandwidth + battery use and
          deliver the blueprint's "auto-lower quality on weak networks / 540p on
          mobile" behaviour without any manual logic. */}
      <LiveKitRoom
        serverUrl={serverUrl}
        token={token}
        connect
        options={{ adaptiveStream: true, dynacast: true }}
        // A lobby attendee (admitted === false) must never attempt to
        // publish — canPublish is false on their token, so trying would just
        // surface a publish error. Force both off regardless of the
        // caller's requested initial device state; once admitted, the gate
        // below swaps in RoomInterior which is unaffected by this (device
        // enable/disable from here on is handled by ControlDock/TrackToggle).
        audio={admitted ? (initialAudioEnabled ? (audioDeviceId ? { deviceId: audioDeviceId } : true) : false) : false}
        video={admitted ? (initialVideoEnabled ? (videoDeviceId ? { deviceId: videoDeviceId } : true) : false) : false}
        onDisconnected={() => onLeave()}
        onError={(error) => setConnectionError(error.message)}
        className="flex min-h-[60vh] w-full max-w-full flex-1 flex-col"
      >
        <RoomAudioRenderer />
        <RoomGate
          roomName={roomName}
          role={role}
          isHost={isHost}
          admitted={admitted}
          connectionError={connectionError}
          onDismissError={() => setConnectionError(null)}
        />
      </LiveKitRoom>
    </div>
  )
}

interface RoomGateProps {
  roomName: string
  role: string | null
  isHost: boolean
  /** The joiner's admission state as of the token fetch — see VideoRoomProps.admitted. */
  admitted: boolean
  connectionError: string | null
  onDismissError: () => void
}

/**
 * Waiting-room gate: renders <Lobby /> until the local participant may
 * subscribe, then swaps in the normal <RoomInterior />. `admitted` (the
 * token-time snapshot) short-circuits the check for the common case where
 * there's no waiting room at all. Once actually granted, `useLocalParticipant`
 * re-renders on LiveKit's ParticipantPermissionsChanged event, so this
 * updates live with no polling — the permission transition only ever goes
 * not-admitted -> admitted for a given join, never back.
 */
function RoomGate({ roomName, role, isHost, admitted, connectionError, onDismissError }: RoomGateProps) {
  const { localParticipant } = useLocalParticipant()
  // Start from the token-time snapshot (authoritative and already correct
  // for the overwhelmingly common non-waiting-room case), then flip to
  // admitted once LiveKit confirms canSubscribe permission was actually
  // granted. Checking `=== true` (rather than defaulting undefined to
  // admitted) matters here specifically because `admitted` may start false:
  // permissions can be momentarily undefined right after connecting, and
  // treating that as "admitted" would flash the call UI before the host has
  // actually let this participant in.
  const isAdmitted = admitted || localParticipant.permissions?.canSubscribe === true

  if (!isAdmitted) {
    return <Lobby />
  }

  return (
    <RoomInterior
      roomName={roomName}
      role={role}
      isHost={isHost}
      connectionError={connectionError}
      onDismissError={onDismissError}
    />
  )
}

interface RoomInteriorProps {
  roomName: string
  role: string | null
  isHost: boolean
  connectionError: string | null
  onDismissError: () => void
}

/** "Host", "Admin · observer", or the capitalized role — shown top-left so
 *  everyone can see the local joiner's standing in the room. */
function getRoleBadge(role: string | null, isHost: boolean): string | null {
  if (isHost) return 'Host'
  if (role === 'admin') return 'Admin · observer'
  if (role) return role.charAt(0).toUpperCase() + role.slice(1)
  return null
}

function RoomInterior({ roomName, role, isHost, connectionError, onDismissError }: RoomInteriorProps) {
  const roleBadge = getRoleBadge(role, isHost)
  // Moderation (mute/remove/mute-all) is available to this meeting's host
  // (organizer) and to platform admins observing the room — never to a
  // plain participant, regardless of what the client believes; the API
  // route re-derives and re-checks this same authorisation server-side.
  const canModerate = isHost || role === 'admin'
  const room = useRoomContext()
  const connectionState = useConnectionState(room)
  const [chatOpen, setChatOpen] = useState(false)
  const [participantsOpen, setParticipantsOpen] = useState(false)

  const { messages, reactions, handsRaised, unreadCount, sendChat, sendReaction, raiseHand, markRead } =
    useRoomMessaging()

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

  const handleToggleChat = () => {
    setChatOpen((open) => {
      const next = !open
      if (next) markRead()
      return next
    })
  }

  return (
    <div className="relative flex flex-1 flex-col">
      {roleBadge && (
        <div className="pointer-events-none absolute left-2 top-2 z-20 sm:left-3 sm:top-3">
          <span
            className={cn(
              'rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] backdrop-blur',
              isHost
                ? 'border-accent-primary/40 bg-accent-primary/10 text-accent-primary'
                : 'border-border bg-surface/80 text-text-muted'
            )}
          >
            {roleBadge}
          </span>
        </div>
      )}

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

      <MeetingStage handsRaised={handsRaised} />
      <ReactionsOverlay reactions={reactions} />

      <ControlDock
        role={role}
        isHost={isHost}
        handsRaised={handsRaised}
        onToggleChat={handleToggleChat}
        onToggleParticipants={() => setParticipantsOpen((open) => !open)}
        chatUnread={unreadCount}
        onSendReaction={sendReaction}
        onRaiseHand={raiseHand}
        canModerate={canModerate}
        roomName={roomName}
      />

      <ChatSheet open={chatOpen} onClose={() => setChatOpen(false)} messages={messages} onSend={sendChat} />
      <ParticipantsSheet
        open={participantsOpen}
        onClose={() => setParticipantsOpen(false)}
        handsRaised={handsRaised}
        canModerate={canModerate}
        roomName={roomName}
      />

      <p className="sr-only">Room: {roomName}</p>
    </div>
  )
}
