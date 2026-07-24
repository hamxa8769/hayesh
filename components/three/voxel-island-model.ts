// ---------------------------------------------------------------------------
// voxel-island-model.ts — pure data -> layout mapping for the parent-facing
// "Progress Island" voxel visualization. NO react / three.js imports here:
// this module is reused by both the 3D scene (VoxelIsland.tsx) and the
// non-3D fallback summary (ProgressIsland.tsx), and must stay unit-testable
// without pulling in WebGL machinery.
//
// Placement is fully deterministic: every feature's grid cell is derived
// from a hash of its source id, never from Math.random(), so the island
// layout is stable across re-renders, remounts, and server/client hydration.
// ---------------------------------------------------------------------------

export type AssignmentStatus = 'assigned' | 'submitted' | 'graded'

export interface IslandAssignmentInput {
  id: string
  status: AssignmentStatus
  subject: string | null
  grade: string | null
}

export interface IslandProgressInput {
  subject: string
  attendance_pct: number | null
  sessions_held: number | null
  sessions_total: number | null
}

export interface BuildIslandModelInput {
  childName: string
  assignments: IslandAssignmentInput[]
  progress: IslandProgressInput[]
}

export type TerrainLayer = 'grass' | 'sand'

export interface IslandTerrainCell {
  x: number
  z: number
  layer: TerrainLayer
  /** 0 (island center) .. 1 (outer edge) — lets the renderer taper height
   *  so the island reads as a floating landmass, thicker at its core. */
  distanceRatio: number
}

export type FeatureKind = 'tree' | 'sapling' | 'seed' | 'building' | 'flower' | 'lantern'

export interface IslandFeature {
  id: string
  kind: FeatureKind
  x: number
  z: number
  /** Deterministic 0..1, seeded off the source id. For rotation/scale
   *  micro-variance only — never for placement (placement already happened
   *  via pickCell below). */
  variance: number
  /** Small deterministic integer for picking a color/style variant from a
   *  fixed palette in the renderer. Not a literal color — keeps this file
   *  free of any three.js/rendering concerns. */
  variant: number
  /** Subject name for buildings; also carried on vegetation for a future
   *  tooltip/legend hookup. */
  label?: string
}

export interface IslandSummary {
  childName: string
  totalAssignments: number
  gradedCount: number
  submittedCount: number
  assignedCount: number
  subjectCount: number
  subjects: string[]
  avgAttendancePct: number | null
  decorationCount: number
  radius: number
  isEmpty: boolean
  levelLabel: string
}

export interface IslandModel {
  radius: number
  terrain: IslandTerrainCell[]
  features: IslandFeature[]
  summary: IslandSummary
}

// Growth + budget constants. Radius is capped so the renderer's instanced
// mesh buffers (see VoxelIsland.tsx) stay within the ~200-500 cube budget
// even in a pathological worst case (every cell at max layer depth, every
// feature slot filled).
const MIN_RADIUS = 3
const MAX_RADIUS = 5
const GROWTH_STEP = 3 // one extra ring of radius per this many "growth units"

const MAX_TREES = 28
const MAX_SAPLINGS = 14
const MAX_SEEDS = 10
const MAX_BUILDINGS = 6
const MAX_DECORATIONS = 16

/** FNV-1a-derived hash, normalized to [0, 1). Deterministic for a given
 * string across every render, process, and machine — never Math.random(). */
function hash01(input: string): number {
  let hash = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) / 4294967296
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

interface Cell {
  x: number
  z: number
}

/** Deterministically "shuffles out" one cell from `pool` using a hash of
 * `seed`, mutating pool in place (removes the picked cell) so no two
 * features can ever land on the same coordinates. Order of calls matters
 * (each pick shrinks the shared pool), which is why callers must issue
 * picks in a stable, fixed order — see buildIslandModel below. */
function pickCell(pool: Cell[], seed: string): Cell | null {
  if (pool.length === 0) return null
  const index = Math.min(pool.length - 1, Math.floor(hash01(seed) * pool.length))
  const [cell] = pool.splice(index, 1)
  return cell ?? null
}

function computeRadius(growthUnits: number): number {
  return clamp(MIN_RADIUS + Math.floor(growthUnits / GROWTH_STEP), MIN_RADIUS, MAX_RADIUS)
}

function buildTerrain(radius: number): IslandTerrainCell[] {
  const cells: IslandTerrainCell[] = []
  const outer = radius + 0.5
  for (let x = -radius; x <= radius; x += 1) {
    for (let z = -radius; z <= radius; z += 1) {
      const distance = Math.sqrt(x * x + z * z)
      if (distance > outer) continue
      const layer: TerrainLayer = distance > radius - 0.6 ? 'sand' : 'grass'
      cells.push({ x, z, layer, distanceRatio: clamp(distance / outer, 0, 1) })
    }
  }
  return cells
}

function computeLevelLabel(gradedCount: number, subjectCount: number): string {
  const score = gradedCount + subjectCount * 2
  if (score === 0) return 'Bare Island'
  if (score < 5) return 'Sprouting'
  if (score < 12) return 'Growing Grove'
  if (score < 24) return 'Thriving Village'
  return 'Flourishing Isle'
}

/**
 * Maps a child's raw assignment/progress rows onto a deterministic voxel
 * island layout:
 *   - one tree per graded assignment (capped at MAX_TREES, most recent first)
 *   - one sapling per submitted assignment (capped at MAX_SAPLINGS)
 *   - one seed/plot per assigned-but-not-submitted assignment (capped at MAX_SEEDS)
 *   - one building per distinct subject (capped at MAX_BUILDINGS)
 *   - decorations (flowers/lanterns) scaled by graded work + attendance
 * Island radius grows with total assignments + subject count, within
 * [MIN_RADIUS, MAX_RADIUS]. Everything is placed via pickCell so no two
 * features ever collide.
 */
export function buildIslandModel({ childName, assignments, progress }: BuildIslandModelInput): IslandModel {
  const gradedCount = assignments.filter((a) => a.status === 'graded').length
  const submittedCount = assignments.filter((a) => a.status === 'submitted').length
  const assignedCount = assignments.filter((a) => a.status === 'assigned').length
  const totalAssignments = assignments.length

  const graded = assignments.filter((a) => a.status === 'graded').slice(0, MAX_TREES)
  const submitted = assignments.filter((a) => a.status === 'submitted').slice(0, MAX_SAPLINGS)
  const assigned = assignments.filter((a) => a.status === 'assigned').slice(0, MAX_SEEDS)

  const subjectSet = new Set<string>()
  for (const a of assignments) if (a.subject) subjectSet.add(a.subject)
  for (const p of progress) if (p.subject) subjectSet.add(p.subject)
  const allSubjects = Array.from(subjectSet).sort((a, b) => a.localeCompare(b))
  const subjectsForBuildings = allSubjects.slice(0, MAX_BUILDINGS)
  const subjectCount = subjectSet.size

  const attendanceValues = progress
    .map((p) => p.attendance_pct)
    .filter((value): value is number => value !== null)
  const avgAttendancePct =
    attendanceValues.length > 0
      ? Math.round(attendanceValues.reduce((sum, value) => sum + value, 0) / attendanceValues.length)
      : null

  const decorationCount = clamp(
    Math.round(gradedCount * 0.4 + ((avgAttendancePct ?? 0) / 100) * 8),
    0,
    MAX_DECORATIONS
  )

  const growthUnits = totalAssignments + subjectCount * 2
  const radius = computeRadius(growthUnits)
  const terrain = buildTerrain(radius)

  const grassPool: Cell[] = terrain.filter((c) => c.layer === 'grass').map((c) => ({ x: c.x, z: c.z }))

  const features: IslandFeature[] = []

  // Buildings first — one per subject — so they claim central real estate
  // before vegetation and decorations fill in around them.
  subjectsForBuildings.forEach((subject) => {
    const cell = pickCell(grassPool, `building:${subject}`)
    if (!cell) return
    features.push({
      id: `building-${subject}`,
      kind: 'building',
      x: cell.x,
      z: cell.z,
      variance: hash01(`building-variance:${subject}`),
      variant: Math.floor(hash01(`building-variant:${subject}`) * 6),
      label: subject,
    })
  })

  graded.forEach((a) => {
    const cell = pickCell(grassPool, `tree:${a.id}`)
    if (!cell) return
    features.push({
      id: `tree-${a.id}`,
      kind: 'tree',
      x: cell.x,
      z: cell.z,
      variance: hash01(`tree-variance:${a.id}`),
      variant: Math.floor(hash01(`tree-variant:${a.id}`) * 3),
      label: a.subject ?? undefined,
    })
  })

  submitted.forEach((a) => {
    const cell = pickCell(grassPool, `sapling:${a.id}`)
    if (!cell) return
    features.push({
      id: `sapling-${a.id}`,
      kind: 'sapling',
      x: cell.x,
      z: cell.z,
      variance: hash01(`sapling-variance:${a.id}`),
      variant: Math.floor(hash01(`sapling-variant:${a.id}`) * 3),
      label: a.subject ?? undefined,
    })
  })

  assigned.forEach((a) => {
    const cell = pickCell(grassPool, `seed:${a.id}`)
    if (!cell) return
    features.push({
      id: `seed-${a.id}`,
      kind: 'seed',
      x: cell.x,
      z: cell.z,
      variance: hash01(`seed-variance:${a.id}`),
      variant: 0,
      label: a.subject ?? undefined,
    })
  })

  for (let i = 0; i < decorationCount; i += 1) {
    const seed = `deco:${childName}:${i}`
    const cell = pickCell(grassPool, seed)
    if (!cell) break
    const kind: FeatureKind = hash01(`deco-kind:${seed}`) > 0.5 ? 'lantern' : 'flower'
    features.push({
      id: `deco-${i}`,
      kind,
      x: cell.x,
      z: cell.z,
      variance: hash01(`deco-variance:${seed}`),
      variant: Math.floor(hash01(`deco-variant:${seed}`) * 4),
    })
  }

  const isEmpty = totalAssignments === 0 && subjectCount === 0

  return {
    radius,
    terrain,
    features,
    summary: {
      childName,
      totalAssignments,
      gradedCount,
      submittedCount,
      assignedCount,
      subjectCount,
      subjects: allSubjects,
      avgAttendancePct,
      decorationCount,
      radius,
      isEmpty,
      levelLabel: computeLevelLabel(gradedCount, subjectCount),
    },
  }
}

// The three platform layers, used as building "subjects" so the showcase
// island grows one landmark per layer. Alphabetical order here matches the
// sort inside buildIslandModel, so the buildings resolve in this same order.
export const SHOWCASE_LANDMARKS = ['HayeshAI Studio', 'Marketplace', 'Teachers'] as const

/**
 * Builds the curated landing-page hero island. Rather than a second placement
 * code path, it synthesizes a fixed, deterministic dataset and feeds it through
 * buildIslandModel — so the showcase inherits the exact same collision-free
 * layout, radius growth and decoration logic as a real child's island. The
 * result is a full-size (MAX_RADIUS) island bearing one building per platform
 * layer, a small grove of graded "trees", a few saplings/seeds and decorations.
 *
 * Fully deterministic: identical every render/hydration, no Math.random().
 */
export function buildShowcaseModel(): IslandModel {
  const subjects = SHOWCASE_LANDMARKS
  const assignments: IslandAssignmentInput[] = []

  // A grove of graded work (trees), spread evenly across the three layers.
  for (let i = 0; i < 18; i += 1) {
    assignments.push({
      id: `showcase-graded-${i}`,
      status: 'graded',
      subject: subjects[i % subjects.length],
      grade: 'A',
    })
  }
  // A handful of in-progress saplings and freshly-planted seeds for variety.
  for (let i = 0; i < 5; i += 1) {
    assignments.push({
      id: `showcase-submitted-${i}`,
      status: 'submitted',
      subject: subjects[i % subjects.length],
      grade: null,
    })
  }
  for (let i = 0; i < 3; i += 1) {
    assignments.push({
      id: `showcase-assigned-${i}`,
      status: 'assigned',
      subject: subjects[i % subjects.length],
      grade: null,
    })
  }

  const progress: IslandProgressInput[] = subjects.map((subject) => ({
    subject,
    attendance_pct: 96,
    sessions_held: 24,
    sessions_total: 25,
  }))

  return buildIslandModel({ childName: 'Hayesh', assignments, progress })
}
