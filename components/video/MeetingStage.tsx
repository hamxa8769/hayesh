'use client'

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  useConnectionQualityIndicator,
  useIsSpeaking,
  useLocalParticipant,
  useTracks,
  VideoTrack,
} from '@livekit/components-react'
import { ConnectionQuality, Track } from 'livekit-client'
import type { TrackReference, TrackReferenceOrPlaceholder } from '@livekit/components-core'
import { isTrackReferencePlaceholder } from '@livekit/components-core'
import { LayoutGrid, Maximize, Minimize, MicOff, Pin, PinOff } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Avatar } from '@/components/video/Avatar'
import { parseParticipantMeta } from '@/components/video/room-messaging'

export interface MeetingStageProps {
  /** Keyed by participant identity. */
  handsRaised: Record<string, boolean>
}

function getTrackKey(trackRef: TrackReferenceOrPlaceholder): string {
  return `${trackRef.participant.identity}-${trackRef.source}`
}

/** A track that is actually showing video (subscribed, published, not muted). */
function hasLiveVideo(trackRef: TrackReferenceOrPlaceholder): boolean {
  if (isTrackReferencePlaceholder(trackRef)) return false
  const pub = trackRef.publication
  return Boolean(pub && !pub.isMuted && pub.track)
}

/**
 * Single-focus call layout: ONE thing fills the stage — the shared screen
 * (which takes over whenever anyone presents) or a focused participant.
 * Everyone else is a thin bottom band of round tiles (tap to focus). Uses the
 * raw <VideoTrack> (not <ParticipantTile>) so LiveKit's unstyled default
 * overlays never stack on top of ours — every label here is our own and is
 * positioned so nothing overlaps.
 */
export function MeetingStage({ handsRaised }: MeetingStageProps) {
  const [pinnedIdentity, setPinnedIdentity] = useState<string | null>(null)
  const [showGrid, setShowGrid] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const prefersReducedMotion = useReducedMotion()
  const stageRef = useRef<HTMLDivElement>(null)

  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  )
  const { localParticipant } = useLocalParticipant()

  const screenShareTrack = useMemo(() => tracks.find((t) => t.source === Track.Source.ScreenShare), [tracks])
  const cameraTiles = useMemo(() => tracks.filter((t) => t.source === Track.Source.Camera), [tracks])

  const localPlaceholder: TrackReferenceOrPlaceholder = useMemo(
    () => ({ participant: localParticipant, source: Track.Source.Camera }),
    [localParticipant]
  )

  const isScreenMode = Boolean(screenShareTrack)

  const primaryCamera: TrackReferenceOrPlaceholder = useMemo(() => {
    if (pinnedIdentity) {
      const pinned = cameraTiles.find((t) => t.participant.identity === pinnedIdentity)
      if (pinned) return pinned
    }
    const speaking = cameraTiles.find((t) => t.participant.isSpeaking && !t.participant.isLocal)
    if (speaking) return speaking
    return cameraTiles[0] ?? localPlaceholder
  }, [cameraTiles, localPlaceholder, pinnedIdentity])

  const primaryKey = isScreenMode && screenShareTrack ? getTrackKey(screenShareTrack) : getTrackKey(primaryCamera)

  const filmstripTiles = useMemo(() => {
    if (isScreenMode) return cameraTiles
    return cameraTiles.filter((t) => getTrackKey(t) !== primaryKey)
  }, [cameraTiles, isScreenMode, primaryKey])

  const focus = (identity: string) => {
    setPinnedIdentity(identity)
    setShowGrid(false)
  }

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggleFullscreen = useCallback(() => {
    const el = stageRef.current
    if (!el) return
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {})
    } else {
      void el.requestFullscreen().catch(() => {})
    }
  }, [])

  return (
    <div ref={stageRef} className="flex min-h-0 flex-1 flex-col bg-background">
      {showGrid && !isScreenMode ? (
        <div className="relative min-h-0 flex-1 p-2 sm:p-3">
          <TopControls
            showGrid
            isScreenMode={false}
            pinned={Boolean(pinnedIdentity)}
            isFullscreen={isFullscreen}
            onToggleGrid={() => setShowGrid((v) => !v)}
            onUnpin={() => setPinnedIdentity(null)}
            onToggleFullscreen={toggleFullscreen}
          />
          <div className="grid min-h-0 h-full auto-rows-fr grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
            {cameraTiles.map((trackRef) => (
              <button
                key={getTrackKey(trackRef)}
                type="button"
                onClick={() => focus(trackRef.participant.identity)}
                className="relative aspect-video overflow-hidden rounded-lg border border-border bg-surface-elevated transition-colors hover:border-line-strong"
                aria-label={`Focus ${trackRef.participant.name || trackRef.participant.identity}`}
              >
                <CameraTile trackRef={trackRef} handRaised={Boolean(handsRaised[trackRef.participant.identity])} avatarSize="md" />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* PRIMARY — fills all remaining height */}
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <TopControls
              showGrid={false}
              isScreenMode={isScreenMode}
              pinned={Boolean(pinnedIdentity)}
              isFullscreen={isFullscreen}
              onToggleGrid={() => setShowGrid((v) => !v)}
              onUnpin={() => setPinnedIdentity(null)}
              onToggleFullscreen={toggleFullscreen}
            />
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={primaryKey}
                initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: prefersReducedMotion ? 0.1 : 0.25 }}
                className="absolute inset-0"
              >
                {isScreenMode && screenShareTrack ? (
                  <div className="relative h-full w-full bg-black">
                    <VideoTrack trackRef={screenShareTrack as TrackReference} className="h-full w-full object-contain" />
                    <div className="pointer-events-none absolute left-3 top-3">
                      <span className="rounded-full border border-border bg-surface/85 px-2.5 py-1 text-xs text-text-primary backdrop-blur">
                        {(screenShareTrack.participant.name || screenShareTrack.participant.identity) + ' is presenting'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <CameraTile
                    trackRef={primaryCamera}
                    handRaised={Boolean(handsRaised[primaryCamera.participant.identity])}
                    avatarSize="lg"
                    isPrimary
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* FILMSTRIP — its own bottom band, so it never overlaps the primary */}
          {filmstripTiles.length > 0 && (
            <div className="shrink-0 border-t border-border bg-surface/60 px-2 py-2 backdrop-blur sm:px-3">
              <div className="flex justify-center gap-2 overflow-x-auto">
                <AnimatePresence initial={false}>
                  {filmstripTiles.map((trackRef) => (
                    <motion.button
                      key={getTrackKey(trackRef)}
                      layout={!prefersReducedMotion}
                      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.2 }}
                      type="button"
                      onClick={() => focus(trackRef.participant.identity)}
                      aria-label={`Focus ${trackRef.participant.name || trackRef.participant.identity}`}
                      className="shrink-0"
                    >
                      <RoundTile trackRef={trackRef} handRaised={Boolean(handsRaised[trackRef.participant.identity])} />
                    </motion.button>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

interface TopControlsProps {
  showGrid: boolean
  isScreenMode: boolean
  pinned: boolean
  isFullscreen: boolean
  onToggleGrid: () => void
  onUnpin: () => void
  onToggleFullscreen: () => void
}

function TopControls({
  showGrid,
  isScreenMode,
  pinned,
  isFullscreen,
  onToggleGrid,
  onUnpin,
  onToggleFullscreen,
}: TopControlsProps) {
  const btn = 'pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface/85 text-text-muted backdrop-blur transition-colors hover:text-text-primary'
  return (
    <div className="pointer-events-none absolute right-2 top-2 z-30 flex gap-2 sm:right-3 sm:top-3">
      {pinned && !isScreenMode && !showGrid && (
        <button type="button" onClick={onUnpin} aria-label="Unpin — back to active speaker" className={cn(btn, 'w-auto gap-1.5 px-3 text-xs')}>
          <PinOff className="h-3.5 w-3.5" /> Unpin
        </button>
      )}
      {!isScreenMode && (
        <button
          type="button"
          onClick={onToggleGrid}
          aria-label={showGrid ? 'Back to focus view' : 'Show everyone (grid)'}
          aria-pressed={showGrid}
          className={cn(btn, showGrid && 'border-accent-primary/40 bg-accent-primary/15 text-accent-primary')}
        >
          {showGrid ? <Pin className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
        </button>
      )}
      <button
        type="button"
        onClick={onToggleFullscreen}
        aria-label={isFullscreen ? 'Exit full screen' : 'Full screen'}
        className={btn}
      >
        {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
      </button>
    </div>
  )
}

type AvatarSize = 'sm' | 'md' | 'lg'

interface CameraTileProps {
  trackRef: TrackReferenceOrPlaceholder
  handRaised: boolean
  avatarSize?: AvatarSize
  isPrimary?: boolean
}

/** Rectangular camera tile with our own (non-overlapping) overlays. Memoized;
 *  owns its speaking/quality subscriptions. */
const CameraTile = memo(function CameraTile({ trackRef, handRaised, avatarSize = 'md', isPrimary = false }: CameraTileProps) {
  const { quality } = useConnectionQualityIndicator({ participant: trackRef.participant })
  const isSpeaking = useIsSpeaking(trackRef.participant)
  const prefersReducedMotion = useReducedMotion()
  const meta = parseParticipantMeta(trackRef.participant.metadata)
  const roleBadge = meta.isHost ? 'Host' : meta.role ? meta.role.charAt(0).toUpperCase() + meta.role.slice(1) : null
  const displayName = trackRef.participant.name || trackRef.participant.identity
  const showVideo = hasLiveVideo(trackRef)

  return (
    <div
      className={cn(
        'relative h-full w-full overflow-hidden bg-surface-elevated',
        !isPrimary && 'rounded-lg border',
        !isPrimary && (handRaised ? 'border-accent-warning/60' : isSpeaking ? 'border-accent-primary/60' : 'border-transparent'),
        isSpeaking && !isPrimary && 'glow-violet'
      )}
    >
      {showVideo ? (
        <VideoTrack trackRef={trackRef as TrackReference} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Avatar name={displayName} size={avatarSize} />
        </div>
      )}

      {/* hand — TOP-LEFT */}
      {handRaised && (
        <motion.span
          initial={{ scale: 0.85, opacity: 0 }}
          animate={prefersReducedMotion ? { opacity: 1 } : { scale: [1, 1.12, 1], opacity: 1 }}
          transition={
            prefersReducedMotion
              ? { duration: 0.15 }
              : { scale: { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }, opacity: { duration: 0.2 } }
          }
          role="img"
          aria-label="Hand raised"
          className="absolute left-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-accent-warning/50 bg-surface/90 text-lg shadow-[0_2px_10px_rgba(0,0,0,0.4)]"
        >
          ✋
        </motion.span>
      )}

      {/* name — BOTTOM-LEFT (opposite side from status, so no overlap) */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex items-center gap-1.5">
        <span className="max-w-[60vw] truncate rounded-md bg-background/70 px-2 py-1 text-sm font-medium text-text-primary backdrop-blur">
          {displayName}
        </span>
        {roleBadge && (
          <span className="rounded-md border border-accent-primary/40 bg-accent-primary/15 px-1.5 py-1 font-mono text-[9px] uppercase tracking-[0.08em] text-accent-primary backdrop-blur">
            {roleBadge}
          </span>
        )}
      </div>

      {/* status — BOTTOM-RIGHT */}
      <div className="pointer-events-none absolute bottom-3 right-3 z-10 flex items-center gap-1.5 rounded-md bg-background/70 px-1.5 py-1 backdrop-blur">
        {!trackRef.participant.isMicrophoneEnabled && <MicOff className="h-4 w-4 text-accent-danger" aria-label="Microphone off" />}
        <ConnectionBars quality={quality} />
      </div>
    </div>
  )
})

interface RoundTileProps {
  trackRef: TrackReferenceOrPlaceholder
  handRaised: boolean
}

/** Small CIRCULAR filmstrip tile. Memoized; owns its speaking subscription. */
const RoundTile = memo(function RoundTile({ trackRef, handRaised }: RoundTileProps) {
  const isSpeaking = useIsSpeaking(trackRef.participant)
  const displayName = trackRef.participant.name || trackRef.participant.identity
  const showVideo = hasLiveVideo(trackRef)

  return (
    <div
      className={cn(
        'relative h-14 w-14 overflow-hidden rounded-full border-2 bg-surface-elevated transition-colors sm:h-16 sm:w-16',
        handRaised ? 'border-accent-warning/70' : isSpeaking ? 'border-accent-primary' : 'border-border',
        isSpeaking && 'glow-violet'
      )}
      title={displayName}
    >
      {showVideo ? (
        <VideoTrack trackRef={trackRef as TrackReference} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Avatar name={displayName} size="sm" />
        </div>
      )}
      {handRaised && (
        <span role="img" aria-label="Hand raised" className="absolute -right-0.5 -top-0.5 text-xs">
          ✋
        </span>
      )}
      {!trackRef.participant.isMicrophoneEnabled && (
        <span className="absolute bottom-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-background/80">
          <MicOff className="h-2.5 w-2.5 text-accent-danger" aria-label="Microphone off" />
        </span>
      )}
    </div>
  )
})

function ConnectionBars({ quality }: { quality: ConnectionQuality }) {
  const barCount = quality === ConnectionQuality.Excellent ? 3 : quality === ConnectionQuality.Good ? 2 : 1
  const isPoor = quality === ConnectionQuality.Poor || quality === ConnectionQuality.Lost

  return (
    <div className="flex items-end gap-0.5" role="img" aria-label={`Connection quality: ${quality}`}>
      {[1, 2, 3].map((bar) => (
        <span
          key={bar}
          className={cn(
            'w-0.5 rounded-sm',
            bar === 1 ? 'h-1.5' : bar === 2 ? 'h-2.5' : 'h-3.5',
            bar <= barCount ? (isPoor ? 'bg-accent-danger' : 'bg-accent-success') : 'bg-text-disabled/40'
          )}
        />
      ))}
    </div>
  )
}
