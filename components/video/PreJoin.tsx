'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { motion, useReducedMotion } from 'framer-motion'
import { Mic, MicOff, Video, VideoOff, Clock, ShieldAlert, RefreshCw, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { JarvisCard } from '@/components/ui/jarvis-card'
import { cn } from '@/lib/utils/cn'
import { formatDateTime } from '@/lib/utils/format'

// VideoRoom pulls in livekit-client, which must never execute during SSR —
// dynamic-import it with ssr:false so it only ever mounts after this
// component has confirmed we're in the browser, mirroring the mount-gate
// pattern in components/three/ConstellationField.tsx.
const VideoRoom = dynamic(() => import('@/components/video/VideoRoom').then((mod) => ({ default: mod.VideoRoom })), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[40vh] w-full items-center justify-center rounded-lg border border-border bg-surface-elevated">
      <p className="flex items-center gap-2 font-mono text-xs text-text-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
        Connecting to call…
      </p>
    </div>
  ),
})

export interface PreJoinProps {
  meetingId: string
  title: string
  scheduledAt: string
  durationMinutes: number
  otherPartyName: string
}

type Phase = 'countdown' | 'setup' | 'in-call' | 'left'
type PermissionState = 'idle' | 'pending' | 'granted' | 'partial' | 'denied' | 'error'

interface CallInfo {
  token: string
  url: string
  roomName: string
  role: string | null
  isHost: boolean
  /** Whether the token route admitted this joiner immediately, or they must
   *  wait in the meeting's waiting room. Absent from the response = admitted
   *  (keeps older/non-waiting-room responses working unchanged). */
  admitted: boolean
}

// How early a caller may enter the device-check / join screen before the
// scheduled start time. Before this window they only see a countdown.
const EARLY_JOIN_WINDOW_MS = 10 * 60 * 1000

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Something went wrong'
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (value: number) => value.toString().padStart(2, '0')
  return hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`
}

/** Device-check + countdown gate that precedes the actual call. Owns the
 * whole join flow: countdown -> camera/mic setup -> fetch a token -> mount
 * VideoRoom. Kept as a single client component so app/meet/[id]/page.tsx can
 * stay a server component that only fetches and authorises the meeting. */
export function PreJoin({ meetingId, title, scheduledAt, durationMinutes, otherPartyName }: PreJoinProps) {
  const prefersReducedMotion = useReducedMotion()
  const scheduledMs = new Date(scheduledAt).getTime()
  const joinableAtMs = scheduledMs - EARLY_JOIN_WINDOW_MS

  const [phase, setPhase] = useState<Phase>(Date.now() >= joinableAtMs ? 'setup' : 'countdown')
  const [msUntilJoinable, setMsUntilJoinable] = useState(() => joinableAtMs - Date.now())

  const [permissionState, setPermissionState] = useState<PermissionState>('idle')
  const [permissionMessage, setPermissionMessage] = useState<string | null>(null)
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([])
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([])
  const [selectedAudioId, setSelectedAudioId] = useState<string | undefined>(undefined)
  const [selectedVideoId, setSelectedVideoId] = useState<string | undefined>(undefined)
  const [micEnabled, setMicEnabled] = useState(true)
  const [camEnabled, setCamEnabled] = useState(true)

  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [callInfo, setCallInfo] = useState<CallInfo | null>(null)

  const previewStreamRef = useRef<MediaStream | null>(null)
  const videoElRef = useRef<HTMLVideoElement | null>(null)

  const stopPreview = useCallback(() => {
    previewStreamRef.current?.getTracks().forEach((track) => track.stop())
    previewStreamRef.current = null
    if (videoElRef.current) videoElRef.current.srcObject = null
  }, [])

  // Countdown tick — flips to 'setup' automatically once the early-join
  // window opens, so nobody has to manually refresh.
  useEffect(() => {
    if (phase !== 'countdown') return
    const interval = setInterval(() => {
      const remaining = joinableAtMs - Date.now()
      setMsUntilJoinable(remaining)
      if (remaining <= 0) {
        setPhase('setup')
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [phase, joinableAtMs])

  const refreshDeviceList = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const audio = devices.filter((d) => d.kind === 'audioinput')
      const video = devices.filter((d) => d.kind === 'videoinput')
      setAudioInputs(audio)
      setVideoInputs(video)
      setSelectedAudioId((current) => current ?? audio[0]?.deviceId)
      setSelectedVideoId((current) => current ?? video[0]?.deviceId)
    } catch {
      // Device labels are only available after permission is granted; a
      // failure here is non-fatal, the user can still join.
    }
  }, [])

  const attachPreview = useCallback((stream: MediaStream) => {
    previewStreamRef.current = stream
    if (videoElRef.current) {
      videoElRef.current.srcObject = stream
    }
  }, [])

  const requestDevices = useCallback(async () => {
    setPermissionState('pending')
    setPermissionMessage(null)
    stopPreview()

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
      attachPreview(stream)
      setPermissionState('granted')
      setMicEnabled(true)
      setCamEnabled(true)
      await refreshDeviceList()
      return
    } catch (error: unknown) {
      const name = error instanceof DOMException ? error.name : ''

      // No camera present at all — still let the call happen, audio-only.
      if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        try {
          const audioOnlyStream = await navigator.mediaDevices.getUserMedia({ audio: true })
          attachPreview(audioOnlyStream)
          setPermissionState('partial')
          setPermissionMessage('No camera was found on this device. You can still join with audio only.')
          setMicEnabled(true)
          setCamEnabled(false)
          await refreshDeviceList()
          return
        } catch (audioError: unknown) {
          setPermissionState('denied')
          setPermissionMessage(getErrorMessage(audioError))
          return
        }
      }

      if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
        setPermissionState('denied')
        setPermissionMessage(
          "Camera and microphone access is blocked. Allow access in your browser's site settings for this page, then try again — or continue and join view-only."
        )
        return
      }

      setPermissionState('error')
      setPermissionMessage(getErrorMessage(error))
    }
  }, [attachPreview, refreshDeviceList, stopPreview])

  useEffect(() => {
    if (phase !== 'setup' || permissionState !== 'idle') return
    requestDevices()
  }, [phase, permissionState, requestDevices])

  // Attach the preview stream whenever the <video> element mounts/remounts.
  useEffect(() => {
    if (videoElRef.current && previewStreamRef.current) {
      videoElRef.current.srcObject = previewStreamRef.current
    }
  })

  useEffect(() => () => stopPreview(), [stopPreview])

  const toggleMic = () => {
    const next = !micEnabled
    setMicEnabled(next)
    previewStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = next
    })
  }

  const toggleCam = () => {
    const next = !camEnabled
    setCamEnabled(next)
    previewStreamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = next
    })
  }

  const switchDevice = async (kind: 'audio' | 'video', deviceId: string) => {
    if (kind === 'audio') setSelectedAudioId(deviceId)
    else setSelectedVideoId(deviceId)

    try {
      const constraints: MediaStreamConstraints =
        kind === 'audio'
          ? { audio: { deviceId: { exact: deviceId } }, video: camEnabled ? { deviceId: selectedVideoId } : false }
          : { audio: micEnabled ? { deviceId: selectedAudioId } : false, video: { deviceId: { exact: deviceId } } }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      stopPreview()
      attachPreview(stream)
    } catch (error: unknown) {
      setPermissionMessage(getErrorMessage(error))
    }
  }

  const handleJoin = async () => {
    setJoining(true)
    setJoinError(null)
    try {
      const response = await fetch('/api/livekit/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meeting_id: meetingId }),
      })
      const json: {
        token?: string
        url?: string
        roomName?: string
        role?: string | null
        isHost?: boolean
        admitted?: boolean
        error?: string
      } = await response.json()
      if (!response.ok || !json.token || !json.url || !json.roomName) {
        throw new Error(json.error || 'Failed to join the meeting')
      }
      stopPreview()
      setCallInfo({
        token: json.token,
        url: json.url,
        roomName: json.roomName,
        role: json.role ?? null,
        isHost: json.isHost ?? false,
        admitted: json.admitted ?? true,
      })
      setPhase('in-call')
    } catch (error: unknown) {
      setJoinError(getErrorMessage(error))
    } finally {
      setJoining(false)
    }
  }

  const handleLeave = useCallback(() => {
    setCallInfo(null)
    setPhase('left')
  }, [])

  const handleRejoin = () => {
    setPermissionState('idle')
    setPhase(Date.now() >= joinableAtMs ? 'setup' : 'countdown')
  }

  if (phase === 'in-call' && callInfo) {
    return (
      <VideoRoom
        token={callInfo.token}
        serverUrl={callInfo.url}
        roomName={callInfo.roomName}
        role={callInfo.role}
        isHost={callInfo.isHost}
        admitted={callInfo.admitted}
        initialAudioEnabled={micEnabled}
        initialVideoEnabled={camEnabled && permissionState !== 'partial'}
        audioDeviceId={selectedAudioId}
        videoDeviceId={selectedVideoId}
        onLeave={handleLeave}
      />
    )
  }

  if (phase === 'left') {
    return (
      <JarvisCard glow="none" className="mx-auto max-w-md p-6 text-center">
        <p className="font-display text-lg font-semibold text-text-primary">You left the meeting</p>
        <p className="mt-2 text-sm text-text-muted">You can rejoin at any time before it&apos;s marked complete.</p>
        <Button type="button" className="mt-4 w-full" onClick={handleRejoin}>
          Rejoin
        </Button>
      </JarvisCard>
    )
  }

  if (phase === 'countdown') {
    return (
      <JarvisCard glow="none" className="mx-auto max-w-md p-6 text-center">
        <Clock className="mx-auto h-6 w-6 text-accent-primary" />
        <p className="mt-3 font-mono text-3xl font-semibold tabular-nums text-text-primary">
          {formatCountdown(msUntilJoinable)}
        </p>
        <p className="mt-2 text-sm text-text-muted">
          &ldquo;{title}&rdquo; with {otherPartyName} starts {formatDateTime(scheduledAt)}
        </p>
        <p className="mt-1 text-xs text-text-disabled">You can join up to 10 minutes early.</p>
        {/*
          The countdown is informational only — it must never block joining.
          A teacher/seller/admin may need to open the room right now to set it
          up or hold an ad-hoc meeting, so anyone with access to this page can
          enter immediately. Authorization is already enforced server-side by
          the token route; this button only skips the visual wait.
        */}
        <Button type="button" variant="outline" className="mt-4 w-full" onClick={() => setPhase('setup')}>
          Join now
        </Button>
      </JarvisCard>
    )
  }

  // phase === 'setup'
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
      <div className="text-center">
        <p className="font-display text-lg font-semibold text-text-primary">{title}</p>
        <p className="text-sm text-text-muted">with {otherPartyName} · {formatDateTime(scheduledAt)}</p>
      </div>

      <JarvisCard glow="none" className="overflow-hidden p-0">
        <div className="relative aspect-video w-full bg-surface-elevated">
          {camEnabled && permissionState !== 'partial' && permissionState !== 'denied' ? (
            <video ref={videoElRef} autoPlay playsInline muted className="h-full w-full object-cover [transform:scaleX(-1)]" />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-4 text-center">
              {permissionState === 'pending' ? (
                <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
              ) : (
                <VideoOff className="h-6 w-6 text-text-muted" />
              )}
              <p className="text-xs text-text-muted">
                {permissionState === 'pending' ? 'Requesting camera access…' : 'Camera is off'}
              </p>
            </div>
          )}

          {permissionState === 'granted' || permissionState === 'partial' ? (
            <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-2">
              <button
                type="button"
                onClick={toggleMic}
                aria-label={micEnabled ? 'Mute microphone' : 'Unmute microphone'}
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur transition-colors',
                  micEnabled ? 'border-border bg-surface/80 text-text-primary' : 'border-accent-danger/40 bg-accent-danger/10 text-accent-danger'
                )}
              >
                {micEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              </button>
              {permissionState === 'granted' && (
                <button
                  type="button"
                  onClick={toggleCam}
                  aria-label={camEnabled ? 'Turn camera off' : 'Turn camera on'}
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur transition-colors',
                    camEnabled ? 'border-border bg-surface/80 text-text-primary' : 'border-accent-danger/40 bg-accent-danger/10 text-accent-danger'
                  )}
                >
                  {camEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                </button>
              )}
            </div>
          ) : null}
        </div>
      </JarvisCard>

      {permissionState === 'denied' && (
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-2 rounded-lg border border-accent-warning/30 bg-accent-warning/5 p-3 text-sm text-text-primary"
        >
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-accent-warning" />
          <div className="min-w-0 space-y-2">
            <p className="text-xs text-text-muted">{permissionMessage}</p>
            <Button type="button" variant="secondary" size="sm" onClick={requestDevices}>
              <RefreshCw className="h-3.5 w-3.5" />
              Try again
            </Button>
          </div>
        </motion.div>
      )}

      {permissionState === 'partial' && permissionMessage && (
        <p className="rounded-lg border border-border bg-surface-elevated px-3 py-2 text-xs text-text-muted">{permissionMessage}</p>
      )}

      {(permissionState === 'granted' || permissionState === 'partial') && (audioInputs.length > 0 || videoInputs.length > 0) && (
        <div className="flex flex-col gap-2">
          {audioInputs.length > 0 && (
            <select
              value={selectedAudioId}
              onChange={(event) => switchDevice('audio', event.target.value)}
              className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-xs text-text-primary focus:border-accent-primary focus:outline-none"
            >
              {audioInputs.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || 'Microphone'}
                </option>
              ))}
            </select>
          )}
          {videoInputs.length > 0 && permissionState === 'granted' && (
            <select
              value={selectedVideoId}
              onChange={(event) => switchDevice('video', event.target.value)}
              className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-xs text-text-primary focus:border-accent-primary focus:outline-none"
            >
              {videoInputs.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || 'Camera'}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {joinError && (
        <p className="rounded-lg border border-accent-danger/30 bg-accent-danger/5 px-3 py-2 text-xs text-accent-danger">{joinError}</p>
      )}

      <Button type="button" size="lg" className="w-full" onClick={handleJoin} disabled={joining || permissionState === 'pending'}>
        {joining ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Joining…
          </>
        ) : (
          'Join meeting'
        )}
      </Button>
    </div>
  )
}
