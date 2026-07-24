'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Building2, Flower2, Rows3, Sprout, TreeDeciduous } from 'lucide-react'
import { VoxelIsland } from '@/components/three/VoxelIsland'
import {
  buildIslandModel,
  type IslandAssignmentInput,
  type IslandModel,
  type IslandProgressInput,
} from '@/components/three/voxel-island-model'
import { cn } from '@/lib/utils/cn'

// ---------------------------------------------------------------------------
// ProgressIsland — wraps VoxelIsland with a legend + non-3D fallback. Decides
// whether to attempt 3D at all: reduced-motion, small/low-power devices, and
// missing WebGL support all route to the fallback by default (mirroring the
// hard rule that a hidden/unmounted-on-demand <Canvas> must never be mounted
// when the fallback is shown). Desktop/capable devices get the island by
// default with a toggle back to the plain summary.
// ---------------------------------------------------------------------------

export interface ProgressIslandProps {
  childName: string
  assignments: IslandAssignmentInput[]
  progress: IslandProgressInput[]
}

type ViewMode = 'fallback' | '3d'

interface NavigatorWithMemory extends Navigator {
  deviceMemory?: number
}

/** Mirrors the ECC motion-ui low-end heuristic used elsewhere in this repo
 * (see ScrollWorld.tsx): low memory (Chrome/Android), or few cores with no
 * memory API at all (covers Safari/Firefox). */
function isLowEndDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const nav = navigator as NavigatorWithMemory
  if (nav.deviceMemory !== undefined) return nav.deviceMemory <= 2
  return nav.hardwareConcurrency <= 4
}

function isSmallViewport(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(max-width: 768px)').matches
}

function isWebglSupported(): boolean {
  if (typeof document === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

const LEGEND_ITEMS = [
  { icon: TreeDeciduous, label: 'Tree', description: 'A graded assignment' },
  { icon: Sprout, label: 'Sapling', description: 'Submitted, awaiting grading' },
  { icon: Rows3, label: 'Seed plot', description: 'Assigned, not yet submitted' },
  { icon: Building2, label: 'Building', description: 'One per subject studied' },
  { icon: Flower2, label: 'Flowers & lanterns', description: 'Grow with attendance and finished work' },
] as const

function IslandLegend() {
  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {LEGEND_ITEMS.map(({ icon: Icon, label, description }) => (
        <li
          key={label}
          className="flex items-start gap-2 rounded-[10px] border border-border bg-surface-elevated/60 p-2.5"
        >
          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-accent-primary" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-text-primary">{label}</p>
            <p className="text-xs text-text-muted">{description}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border border-border bg-surface-elevated/60 p-3">
      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-text-muted">{label}</p>
      <p className="mt-1 font-mono text-xl font-bold tabular-nums text-text-primary">{value}</p>
    </div>
  )
}

function IslandFallbackSummary({ model }: { model: IslandModel }) {
  const { summary } = model
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <StatTile label="Graded" value={String(summary.gradedCount)} />
      <StatTile label="Submitted" value={String(summary.submittedCount)} />
      <StatTile label="Assigned" value={String(summary.assignedCount)} />
      <StatTile label="Subjects" value={String(summary.subjectCount)} />
      <StatTile label="Attendance" value={summary.avgAttendancePct !== null ? `${summary.avgAttendancePct}%` : '—'} />
      <StatTile label="Decorations" value={String(summary.decorationCount)} />
    </div>
  )
}

/** Parent-facing wrapper: computes the deterministic island model from raw
 * homework/progress rows, decides 3D-vs-fallback for the current device, and
 * renders a legend so the visual is self-explanatory even to a parent who
 * only ever sees the plain summary. */
export function ProgressIsland({ childName, assignments, progress }: ProgressIslandProps) {
  const prefersReducedMotion = useReducedMotion()
  const model = useMemo(
    () => buildIslandModel({ childName, assignments, progress }),
    [childName, assignments, progress]
  )

  // Server + first client render must match: default to the fallback view
  // (plain HTML, no WebGL) until an effect resolves the real device
  // capabilities. See the VoxelIsland/ScrollWorld hydration-safety note.
  const [mounted, setMounted] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('fallback')
  const [canOptIn3d, setCanOptIn3d] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Reduced motion: prefer the non-3D fallback entirely — no opt-in offered.
    if (prefersReducedMotion) return
    // No WebGL: nothing to opt into.
    if (!isWebglSupported()) return

    setCanOptIn3d(true)
    const lowPower = isSmallViewport() || isLowEndDevice()
    if (!lowPower) {
      setViewMode('3d')
    }
    // Mobile / low-power devices stay on the fallback by default but can
    // opt in via the toggle button rendered below.
  }, [prefersReducedMotion])

  const handleToggleView = () => {
    setViewMode((mode) => (mode === '3d' ? 'fallback' : '3d'))
  }

  const handleContextLost = () => {
    setViewMode('fallback')
  }

  const isEmpty = model.summary.isEmpty
  const showToggle = mounted && canOptIn3d && !isEmpty

  return (
    <motion.section
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-4 rounded-[16px] border border-border bg-surface p-5"
      aria-label={`${childName}'s progress island`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-text-muted">
            {childName}&apos;s Progress Island
          </p>
          <p className="mt-1 font-display text-lg font-bold">
            <span className={isEmpty ? 'text-text-muted' : 'aurora-text'}>{model.summary.levelLabel}</span>
          </p>
        </div>
        {showToggle && (
          <button
            type="button"
            onClick={handleToggleView}
            className={cn(
              'rounded-[6px] border border-border bg-surface-elevated px-3 py-1.5 text-xs font-medium text-text-muted',
              'transition-colors duration-150 hover:border-line-strong hover:text-text-primary'
            )}
          >
            {viewMode === '3d' ? 'Switch to summary view' : 'View 3D island'}
          </button>
        )}
      </div>

      {isEmpty ? (
        <div className="rounded-[10px] border border-dashed border-line-strong bg-surface-elevated/40 p-6 text-center">
          <Sprout className="mx-auto mb-2 h-8 w-8 text-text-disabled" />
          <p className="text-sm text-text-primary">Bare island — for now</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-text-muted">
            {childName}&apos;s island grows as they complete homework, get graded, and attend sessions. Check back
            after their first assignment.
          </p>
        </div>
      ) : viewMode === '3d' ? (
        <VoxelIsland model={model} onContextLost={handleContextLost} />
      ) : (
        <IslandFallbackSummary model={model} />
      )}

      {!isEmpty && <IslandLegend />}
    </motion.section>
  )
}

export default ProgressIsland
