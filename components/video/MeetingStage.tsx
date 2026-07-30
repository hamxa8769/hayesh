'use client'

import { memo, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  ParticipantTile,
  useConnectionQualityIndicator,
  useIsSpeaking,
  useLocalParticipant,
  useParticipants,
  useSpeakingParticipants,
  useTracks,
} from '@livekit/components-react'
import { ConnectionQuality, Track } from 'livekit-client'
import type { Participant } from 'livekit-client'
import { isTrackReferencePlaceholder, type TrackReferenceOrPlaceholder } from '@livekit/components-core'
import { LayoutGrid, MicOff, Rows3 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { parseParticipantMeta } from '@/components/video/room-messaging'
import { Avatar } from '@/components/video/Avatar'

export interface MeetingStageProps {
  /** Keyed by participant identity. */
  handsRaised: Record<string, boolean>
}

type StageView = 'speaker' | 'gallery'
type AvatarSize = 'sm' | 'md' | 'lg'

const GALLERY_TILE_LIMIT = 9

function getTrackKey(trackRef: TrackReferenceOrPlaceholder): string {
  return `${trackRef.participant.identity}-${trackRef.source}`
}

function hasLiveVideo(trackRef: TrackReferenceOrPlaceholder): boolean {
  if (trackRef.source === Track.Source.ScreenShare) return true
  return !isTrackReferencePlaceholder(trackRef) && trackRef.participant.isCameraEnabled
}

const stageTransition = { duration: 0.35, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }

/**
 * The video area: speaker view (pinned/loudest/first participant large, a
 * scrollable thumbnail strip below), gallery view (responsive grid), or
 * screen-share mode (screen fills the stage, every participant shrinks into
 * a filmstrip rail) whenever anyone is sharing their screen.
 */
export function MeetingStage({ handsRaised }: MeetingStageProps) {
  const [view, setView] = useState<StageView>('speaker')
  const [pinnedIdentity, setPinnedIdentity] = useState<string | null>(null)

  // Camera uses withPlaceholder so every participant gets a slot (real track
  // or placeholder) — this is what makes camera-off participants show up as
  // an avatar tile instead of vanishing from the stage entirely. ScreenShare
  // never needs a placeholder: it simply exists in the array while someone
  // is sharing.
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  )
  const participants = useParticipants()
  const speakingParticipants = useSpeakingParticipants()
  const { localParticipant } = useLocalParticipant()

  const screenShareTrack = useMemo(
    () => tracks.find((trackRef) => trackRef.source === Track.Source.ScreenShare),
    [tracks]
  )
  const cameraTracks = useMemo(() => tracks.filter((trackRef) => trackRef.source === Track.Source.Camera), [tracks])

  const mainTrack: TrackReferenceOrPlaceholder = useMemo(() => {
    if (pinnedIdentity) {
      const pinned = cameraTracks.find((trackRef) => trackRef.participant.identity === pinnedIdentity)
      if (pinned) return pinned
    }
    const loudest = speakingParticipants[0]
    if (loudest) {
      const loudestTrack = cameraTracks.find((trackRef) => trackRef.participant.identity === loudest.identity)
      if (loudestTrack) return loudestTrack
    }
    return cameraTracks[0] ?? { participant: localParticipant, source: Track.Source.Camera }
  }, [cameraTracks, localParticipant, pinnedIdentity, speakingParticipants])

  const mainTrackKey = getTrackKey(mainTrack)
  const thumbnailTracks = useMemo(
    () => cameraTracks.filter((trackRef) => getTrackKey(trackRef) !== mainTrackKey),
    [cameraTracks, mainTrackKey]
  )

  const raisedCount = useMemo(() => Object.values(handsRaised).filter(Boolean).length, [handsRaised])
  const isScreenMode = Boolean(screenShareTrack)

  return (
    <div className="relative flex min-h-0 flex-1 flex-col p-2 sm:p-3">
      <div className="pointer-events-none absolute inset-x-2 top-2 z-20 flex items-start justify-between gap-2 sm:inset-x-3 sm:top-3">
        {raisedCount > 0 ? (
          <span className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-accent-warning/40 bg-surface/80 px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-accent-warning backdrop-blur">
            <span aria-hidden="true">✋</span>
            {raisedCount}
          </span>
        ) : (
          <span />
        )}

        {!isScreenMode && (
          <div className="pointer-events-auto flex overflow-hidden rounded-full border border-border bg-surface/80 backdrop-blur">
            <button
              type="button"
              onClick={() => setView('speaker')}
              aria-label="Speaker view"
              aria-pressed={view === 'speaker'}
              className={cn(
                'flex h-10 w-10 items-center justify-center transition-colors',
                view === 'speaker' ? 'bg-accent-primary/15 text-accent-primary' : 'text-text-muted hover:text-text-primary'
              )}
            >
              <Rows3 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setView('gallery')}
              aria-label="Gallery view"
              aria-pressed={view === 'gallery'}
              className={cn(
                'flex h-10 w-10 items-center justify-center transition-colors',
                view === 'gallery' ? 'bg-accent-primary/15 text-accent-primary' : 'text-text-muted hover:text-text-primary'
              )}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {isScreenMode && screenShareTrack ? (
        <ScreenShareLayout screenShareTrack={screenShareTrack} cameraTracks={cameraTracks} handsRaised={handsRaised} />
      ) : view === 'gallery' ? (
        <GalleryLayout cameraTracks={cameraTracks} participants={participants} handsRaised={handsRaised} />
      ) : (
        <SpeakerLayout
          mainTrack={mainTrack}
          mainTrackKey={mainTrackKey}
          thumbnailTracks={thumbnailTracks}
          handsRaised={handsRaised}
          onPin={setPinnedIdentity}
        />
      )}
    </div>
  )
}

interface ScreenShareLayoutProps {
  screenShareTrack: TrackReferenceOrPlaceholder
  cameraTracks: TrackReferenceOrPlaceholder[]
  handsRaised: Record<string, boolean>
}

/**
 * Screen-share mode. The shared screen always renders in the prominent main
 * slot at full size (never hidden, never zero-size) — that's what keeps it
 * "visible" to adaptiveStream/dynacast so LiveKit doesn't pause its layers,
 * and it's true for a remote presenter's screen exactly the same way as the
 * local one, since screenShareTrack is whichever ScreenShare track exists in
 * the room regardless of who published it. Every participant (including the
 * presenter's own camera, if on) shrinks into the filmstrip rail.
 */
function ScreenShareLayout({ screenShareTrack, cameraTracks, handsRaised }: ScreenShareLayoutProps) {
  const presenterName = screenShareTrack.participant.name || screenShareTrack.participant.identity

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 lg:flex-row">
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-background">
        {/* Scoped override: a shared screen is never 16:9-croppable, so the
            global .lk-participant-tile video{object-fit:cover} rule (set in
            VideoRoom.tsx for camera tiles) must not apply here. !important
            wins regardless of stylesheet insertion order between the two
            styled-jsx blocks. */}
        <style jsx>{`
          div[data-screenshare] :global(video) {
            object-fit: contain !important;
            background: transparent;
          }
        `}</style>
        <div data-screenshare className="h-full w-full">
          <StageTile
            trackRef={screenShareTrack}
            handRaised={Boolean(handsRaised[screenShareTrack.participant.identity])}
            className="h-full w-full"
          />
        </div>
        <div className="pointer-events-none absolute left-2 top-2 sm:left-3 sm:top-3">
          <span className="rounded-full border border-border bg-surface/85 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-text-primary backdrop-blur">
            {presenterName} is presenting
          </span>
        </div>
      </div>

      {cameraTracks.length > 0 && (
        <div className="flex shrink-0 gap-2 overflow-x-auto pb-1 lg:w-48 lg:flex-col lg:overflow-x-visible lg:overflow-y-auto lg:pb-0 xl:w-60">
          {cameraTracks.map((trackRef) => (
            <div
              key={getTrackKey(trackRef)}
              className="relative h-20 w-32 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-elevated transition-colors hover:border-line-strong sm:h-24 sm:w-40 lg:h-auto lg:w-full lg:aspect-video lg:shrink-0"
            >
              <StageTile
                trackRef={trackRef}
                handRaised={Boolean(handsRaised[trackRef.participant.identity])}
                avatarSize="sm"
                className="h-full w-full"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface SpeakerLayoutProps {
  mainTrack: TrackReferenceOrPlaceholder
  mainTrackKey: string
  thumbnailTracks: TrackReferenceOrPlaceholder[]
  handsRaised: Record<string, boolean>
  onPin: (identity: string) => void
}

function SpeakerLayout({ mainTrack, mainTrackKey, thumbnailTracks, handsRaised, onPin }: SpeakerLayoutProps) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-surface-elevated">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={mainTrackKey}
            layout
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
            transition={prefersReducedMotion ? { duration: 0.1 } : stageTransition}
            className="absolute inset-0"
          >
            <StageTile
              trackRef={mainTrack}
              handRaised={Boolean(handsRaised[mainTrack.participant.identity])}
              avatarSize="lg"
              className="h-full w-full"
            />
          </motion.div>
        </AnimatePresence>
      </div>
      {thumbnailTracks.length > 0 && (
        <div className="flex shrink-0 gap-2 overflow-x-auto pb-1">
          <AnimatePresence mode="popLayout" initial={false}>
            {thumbnailTracks.map((trackRef) => (
              <motion.button
                key={getTrackKey(trackRef)}
                layout
                type="button"
                onClick={() => onPin(trackRef.participant.identity)}
                aria-label={`Pin ${trackRef.participant.name || trackRef.participant.identity}`}
                initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
                transition={prefersReducedMotion ? { duration: 0.1 } : { duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                className="relative h-20 w-32 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-elevated text-left transition-colors hover:border-line-strong sm:h-24 sm:w-40"
              >
                <StageTile
                  trackRef={trackRef}
                  handRaised={Boolean(handsRaised[trackRef.participant.identity])}
                  avatarSize="sm"
                  className="h-full w-full"
                />
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

interface GalleryLayoutProps {
  cameraTracks: TrackReferenceOrPlaceholder[]
  participants: Participant[]
  handsRaised: Record<string, boolean>
}

const galleryContainerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
}

const galleryItemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
}

function GalleryLayout({ cameraTracks, participants, handsRaised }: GalleryLayoutProps) {
  const prefersReducedMotion = useReducedMotion()
  const visible = cameraTracks.slice(0, GALLERY_TILE_LIMIT)
  const overflowCount = Math.max(0, participants.length - visible.length)

  return (
    <motion.div
      variants={prefersReducedMotion ? undefined : galleryContainerVariants}
      initial={prefersReducedMotion ? undefined : 'hidden'}
      animate={prefersReducedMotion ? undefined : 'visible'}
      className="grid min-h-0 flex-1 auto-rows-fr grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3"
    >
      {visible.map((trackRef) => (
        <motion.div
          key={getTrackKey(trackRef)}
          variants={prefersReducedMotion ? undefined : galleryItemVariants}
          className="relative aspect-video overflow-hidden rounded-lg border border-border bg-surface-elevated"
        >
          <StageTile
            trackRef={trackRef}
            handRaised={Boolean(handsRaised[trackRef.participant.identity])}
            avatarSize="md"
            className="h-full w-full"
          />
        </motion.div>
      ))}
      {overflowCount > 0 && (
        <div className="flex aspect-video items-center justify-center rounded-lg border border-border bg-surface-elevated font-mono text-sm text-text-muted">
          +{overflowCount} more
        </div>
      )}
    </motion.div>
  )
}

interface StageTileProps {
  trackRef: TrackReferenceOrPlaceholder
  handRaised: boolean
  className?: string
  avatarSize?: AvatarSize
}

/** Memoized to skip re-renders driven purely by an unrelated prop-identity
 *  change from the parent. Each tile owns its own speaking/quality/mic
 *  subscriptions (useIsSpeaking / useConnectionQualityIndicator + reading the
 *  participant during render), so those still update live regardless of memo —
 *  we deliberately do NOT add an identity-only comparator, which would stall
 *  the mic-off indicator when a track object is replaced on mute/unmute. */
const StageTile = memo(function StageTile({ trackRef, handRaised, className, avatarSize = 'md' }: StageTileProps) {
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
        'relative overflow-hidden rounded-lg border transition-[border-color,box-shadow] duration-300',
        handRaised ? 'border-accent-warning/60' : 'border-transparent',
        isSpeaking && 'glow-violet border-accent-primary/60',
        className
      )}
    >
      {showVideo ? (
        <ParticipantTile trackRef={trackRef} disableSpeakingIndicator className="h-full w-full" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-surface-elevated">
          <Avatar name={displayName} size={avatarSize} />
        </div>
      )}

      {handRaised && (
        <motion.span
          initial={{ scale: 0.85, opacity: 0 }}
          animate={prefersReducedMotion ? { opacity: 1 } : { scale: [1, 1.12, 1], opacity: 1 }}
          transition={
            prefersReducedMotion
              ? { duration: 0.15 }
              : { scale: { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }, opacity: { duration: 0.2 } }
          }
          className="absolute left-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-accent-warning/50 bg-surface/90 text-sm shadow-[0_2px_10px_rgba(0,0,0,0.4)]"
          role="img"
          aria-label="Hand raised"
          title="Hand raised"
        >
          ✋
        </motion.span>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-background/85 to-transparent px-2 py-1.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-xs font-medium text-text-primary">{displayName}</span>
          {roleBadge && (
            <span className="shrink-0 whitespace-nowrap rounded-full border border-accent-primary/40 bg-accent-primary/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-accent-primary">
              {roleBadge}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {!trackRef.participant.isMicrophoneEnabled && (
            <MicOff className="h-3.5 w-3.5 text-accent-danger" aria-label="Microphone off" />
          )}
          <ConnectionBars quality={quality} />
        </div>
      </div>
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
