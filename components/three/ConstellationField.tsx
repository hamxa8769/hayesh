'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'
import { cn } from '@/lib/utils/cn'

export interface ConstellationFieldProps {
  stage: number
  totalStages: number
  variant?: 'wizard' | 'ambient' | 'accent'
  className?: string
}

// ---------------------------------------------------------------------------
// Aurora palette (jade -> gold), matching --color-jade / --color-gold from
// the Obsidian Aurora design system. No other hues are used anywhere below.
// ---------------------------------------------------------------------------
const COLOR_JADE = new THREE.Color('#27C4A0')
const COLOR_GOLD = new THREE.Color('#F5B84E')
const COLOR_GOLD_BRIGHT = new THREE.Color('#FFDFA0')

// Fixed buffer sizes: every variant/character writes into the same
// pre-allocated slots so buffers never need to be reallocated at runtime.
const MAX_NODES = 24
const MAX_LINKS = 32
const CHARACTER_COUNT = 8

// Node index ranges — roles are fixed across every character so a given
// slot always represents "the same" conceptual point in space, which is
// what makes cross-character lerping look coherent rather than shuffled.
const CORE_RANGE: readonly [number, number] = [0, 4] // chain of 4
const RING_RANGE: readonly [number, number] = [4, 12] // 8 satellites/ring
const TIER_RANGE: readonly [number, number] = [12, 21] // 3 tiers x 3
const GLYPH_RANGE: readonly [number, number] = [21, 24] // 3 locking accents

type NodeRole = 'core' | 'ring' | 'tier' | 'glyph'

interface NodeSlot {
  position: THREE.Vector3
  active: boolean
  colorT: number // 0 = jade, 1 = gold
}

function roleForIndex(index: number): NodeRole {
  if (index >= RING_RANGE[0] && index < RING_RANGE[1]) return 'ring'
  if (index >= TIER_RANGE[0] && index < TIER_RANGE[1]) return 'tier'
  if (index >= GLYPH_RANGE[0] && index < GLYPH_RANGE[1]) return 'glyph'
  return 'core'
}

function emptySlots(): NodeSlot[] {
  return Array.from({ length: MAX_NODES }, () => ({
    position: new THREE.Vector3(0, 0, 0),
    active: false,
    colorT: 0,
  }))
}

/** Core chain positions, scaled by `spread` (used to contract the chain into
 * a tighter nucleus once ring/tier/glyph structures take over the read). */
function coreChainPositions(spread: number): THREE.Vector3[] {
  return [
    new THREE.Vector3(-1.0 * spread, -0.3 * spread, 0),
    new THREE.Vector3(-0.32 * spread, 0.08 * spread, 0.16 * spread),
    new THREE.Vector3(0.35 * spread, 0.38 * spread, -0.1 * spread),
    new THREE.Vector3(0.95 * spread, 0.55 * spread, 0.05 * spread),
  ]
}

function ringPositions(count: number, radius: number, y: number): THREE.Vector3[] {
  return Array.from({ length: count }, (_unused, i) => {
    const angle = (i / count) * Math.PI * 2
    return new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius * 0.55)
  })
}

function tierPositions(): THREE.Vector3[] {
  const heights = [-0.85, 0.05, 0.95]
  const spans = [-0.75, 0, 0.75]
  const positions: THREE.Vector3[] = []
  heights.forEach((y, tierIndex) => {
    spans.forEach((x) => {
      positions.push(new THREE.Vector3(x, y, (tierIndex - 1) * 0.15))
    })
  })
  return positions
}

function glyphPositions(radius: number): THREE.Vector3[] {
  // Offset from the ring's 8 angles so glyph accents fill the gaps,
  // completing a symmetric locked polygon in character 7/8.
  return Array.from({ length: 3 }, (_unused, i) => {
    const angle = ((i + 0.5) / 3) * Math.PI * 2 + Math.PI / 8
    return new THREE.Vector3(Math.cos(angle) * radius, 0.1, Math.sin(angle) * radius * 0.55)
  })
}

/**
 * Builds the 8 "character" layouts described in the design brief. `stage`
 * (1..totalStages) is mapped generically onto these 8 canonical states by
 * the caller — this function itself never reads `totalStages`.
 */
function buildCharacterLayout(character: number): NodeSlot[] {
  const slots = emptySlots()
  const setCore = (positions: THREE.Vector3[], colorTFor: (i: number) => number) => {
    positions.forEach((position, i) => {
      const slot = slots[CORE_RANGE[0] + i]
      if (!slot) return
      slot.position.copy(position)
      slot.active = true
      slot.colorT = colorTFor(i)
    })
  }
  const setRange = (
    range: readonly [number, number],
    positions: THREE.Vector3[],
    colorTFor: (i: number) => number
  ) => {
    positions.forEach((position, i) => {
      const slot = slots[range[0] + i]
      if (!slot) return
      slot.position.copy(position)
      slot.active = true
      slot.colorT = colorTFor(i)
    })
  }

  switch (character) {
    case 1: {
      // A single glowing node. Jade (colorT 0), not gold: the aurora reads as a
      // jade -> gold journey across the wizard, so the first step must start at
      // the jade end. Gold is earned as the constellation assembles.
      setCore([new THREE.Vector3(0, 0, 0)], () => 0)
      break
    }
    case 2: {
      // A branch: node + one linked child (the child is the newest -> gold).
      setCore(coreChainPositions(0.55).slice(0, 2), (i) => (i === 0 ? 0.25 : 1))
      break
    }
    case 3: {
      // An extended branch: a short chain, gradient toward the newest tip.
      setCore(coreChainPositions(1.0), (i) => i / 3)
      break
    }
    case 4: {
      // Orbiting tokens: contracted core cluster + satellites circling it.
      setCore(coreChainPositions(0.7), (i) => i / 3)
      setRange(RING_RANGE, ringPositions(6, 1.3, 0), () => 0.55)
      break
    }
    case 5: {
      // A slow-rotating ring forms around the cluster.
      setCore(coreChainPositions(0.55), (i) => i / 3)
      setRange(RING_RANGE, ringPositions(8, 1.7, 0), () => 0.4)
      break
    }
    case 6: {
      // Three rising tiers (core dims into the background).
      setCore(coreChainPositions(0.45), () => 0.15)
      setRange(TIER_RANGE, tierPositions(), (i) => Math.floor(i / 3) / 2)
      break
    }
    case 7: {
      // Locking glyph moment: ring + glyph accents snap into a symmetric,
      // evenly spaced closed shape (still reached via lerp, never a hard cut).
      setCore(coreChainPositions(0.5), () => 0.7)
      setRange(RING_RANGE, ringPositions(8, 1.9, 0), () => 0.6)
      setRange(GLYPH_RANGE, glyphPositions(1.9), () => 0.75)
      break
    }
    case 8:
    default: {
      // Full assembly: everything present at once, gold pulse layered on
      // the newest core node at render time (see PULSE_NODE_INDEX).
      setCore(coreChainPositions(0.6), (i) => 0.5 + (i / 3) * 0.5)
      setRange(RING_RANGE, ringPositions(8, 1.8, 0), () => 0.65)
      setRange(TIER_RANGE, tierPositions(), (i) => 0.4 + Math.floor(i / 3) / 6)
      setRange(GLYPH_RANGE, glyphPositions(1.9), () => 0.85)
      break
    }
  }

  return slots
}

const PULSE_NODE_INDEX = CORE_RANGE[1] - 1 // last core node = "newest"

// Master edge list: every edge ever drawn, across every character, gets a
// single fixed slot so a link's opacity can lerp in/out the same way node
// positions do (rather than popping when a character changes).
const EDGES: readonly [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3], // core chain
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [8, 9],
  [9, 10],
  [10, 11],
  [11, 4], // closed ring
  [12, 13],
  [13, 14], // tier 1
  [15, 16],
  [16, 17], // tier 2
  [18, 19],
  [19, 20], // tier 3
  [13, 16],
  [16, 19], // ascension
  [21, 0],
  [22, 0],
  [23, 0], // glyph locking pins
]

const EDGE_MEMBERSHIP: Readonly<Record<number, ReadonlySet<number>>> = {
  1: new Set(),
  2: new Set([0]),
  3: new Set([0, 1, 2]),
  4: new Set([0, 1, 2]),
  5: new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
  6: new Set([0, 1, 2, 11, 12, 13, 14, 15, 16, 17, 18]),
  7: new Set([3, 4, 5, 6, 7, 8, 9, 10, 19, 20, 21]),
  8: new Set(Array.from({ length: EDGES.length }, (_unused, i) => i)),
}

function buildCharacterLinkWeights(character: number): number[] {
  const active = EDGE_MEMBERSHIP[character] ?? new Set<number>()
  return EDGES.map((_edge, i) => (active.has(i) ? 1 : 0))
}

// Ambient / accent variants ignore stage entirely: a fixed, low-key cloud.
function buildAmbientLayout(): NodeSlot[] {
  const slots = emptySlots()
  const count = 9
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2
    const radius = 1.6 + (i % 3) * 0.5
    const slot = slots[i]
    if (!slot) continue
    slot.position.set(
      Math.cos(angle) * radius,
      Math.sin(angle * 1.7) * 0.9,
      Math.sin(angle) * radius * 0.6
    )
    slot.active = true
    slot.colorT = 0.15 + (i % 4) * 0.08
  }
  return slots
}

function buildAccentLayout(): NodeSlot[] {
  const slots = emptySlots()
  const positions = [
    new THREE.Vector3(-0.6, -0.2, 0),
    new THREE.Vector3(0.5, 0.3, -0.1),
    new THREE.Vector3(0.1, 0.6, 0.2),
    new THREE.Vector3(-0.2, -0.6, -0.15),
  ]
  positions.forEach((position, i) => {
    const slot = slots[i]
    if (!slot) return
    slot.position.copy(position)
    slot.active = true
    slot.colorT = 0.2 + i * 0.1
  })
  return slots
}

const AMBIENT_LAYOUT = buildAmbientLayout()
const AMBIENT_LINK_WEIGHTS = EDGES.map(() => 0)
const ACCENT_LAYOUT = buildAccentLayout()
const ACCENT_LINK_WEIGHTS = EDGES.map(() => 0)

interface VariantConfig {
  idleRotationSpeed: number
  ringSpinSpeed: number
  pointSizeBase: number
  pointOpacity: number
  linkOpacity: number
  lerpRate: number // exponential smoothing rate; higher = snappier
}

const VARIANT_CONFIG: Record<NonNullable<ConstellationFieldProps['variant']>, VariantConfig> = {
  wizard: {
    idleRotationSpeed: 0.12,
    ringSpinSpeed: 0.3,
    pointSizeBase: 44,
    pointOpacity: 0.95,
    linkOpacity: 0.5,
    lerpRate: 3.2,
  },
  ambient: {
    idleRotationSpeed: 0.05,
    ringSpinSpeed: 0.08,
    pointSizeBase: 24,
    pointOpacity: 0.32,
    linkOpacity: 0.14,
    lerpRate: 2.0,
  },
  accent: {
    idleRotationSpeed: 0.03,
    ringSpinSpeed: 0.05,
    pointSizeBase: 15,
    pointOpacity: 0.16,
    linkOpacity: 0.06,
    lerpRate: 2.0,
  },
}

const POINT_VERTEX_SHADER = /* glsl */ `
  attribute float aScale;
  attribute vec3 aColor;
  uniform float uPixelRatio;
  uniform float uBaseSize;
  varying vec3 vColor;
  varying float vScale;

  void main() {
    vColor = aColor;
    vScale = aScale;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uBaseSize * aScale * uPixelRatio * (280.0 / max(-mvPosition.z, 0.001));
    gl_Position = projectionMatrix * mvPosition;
  }
`

const POINT_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;
  varying vec3 vColor;
  varying float vScale;
  uniform float uOpacity;

  void main() {
    if (vScale <= 0.002) discard;
    vec2 centered = gl_PointCoord.xy - vec2(0.5);
    float dist = length(centered);
    float halo = smoothstep(0.5, 0.0, dist);
    float core = smoothstep(0.16, 0.0, dist);
    vec3 finalColor = vColor * (0.6 + core * 1.6);
    float alpha = halo * uOpacity;
    if (alpha <= 0.003) discard;
    gl_FragColor = vec4(finalColor, alpha);
  }
`

interface PointUniforms {
  [key: string]: THREE.IUniform
  uPixelRatio: THREE.IUniform<number>
  uBaseSize: THREE.IUniform<number>
  uOpacity: THREE.IUniform<number>
}

function readReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

interface ConstellationSceneProps {
  stage: number
  totalStages: number
  variant: NonNullable<ConstellationFieldProps['variant']>
}

function ConstellationScene({ stage, totalStages, variant }: ConstellationSceneProps) {
  const config = VARIANT_CONFIG[variant]

  const pointGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_NODES * 3), 3))
    geometry.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(MAX_NODES * 3), 3))
    geometry.setAttribute('aScale', new THREE.BufferAttribute(new Float32Array(MAX_NODES), 1))
    return geometry
  }, [])

  const lineGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(MAX_LINKS * 2 * 3), 3)
    )
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX_LINKS * 2 * 3), 3))
    return geometry
  }, [])

  const pointUniformsRef = useRef<PointUniforms>({
    uPixelRatio: { value: typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio, 2) },
    uBaseSize: { value: config.pointSizeBase },
    uOpacity: { value: config.pointOpacity },
  })

  const lineMaterial = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: config.linkOpacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [config.linkOpacity]
  )

  // Dispose geometries/material on unmount.
  useEffect(() => {
    return () => {
      pointGeometry.dispose()
      lineGeometry.dispose()
      lineMaterial.dispose()
    }
  }, [pointGeometry, lineGeometry, lineMaterial])

  // Animation state lives entirely in refs — never in React state — so
  // useFrame never triggers a re-render.
  const currentPositions = useRef<THREE.Vector3[]>(
    Array.from({ length: MAX_NODES }, () => new THREE.Vector3(0, 0, 0))
  )
  const currentScales = useRef<Float32Array>(new Float32Array(MAX_NODES))
  const currentColorTs = useRef<Float32Array>(new Float32Array(MAX_NODES))
  const currentLinkWeights = useRef<Float32Array>(new Float32Array(MAX_LINKS))
  const currentPulseWeight = useRef(0)

  // Scratch color objects reused every frame to avoid per-frame allocation.
  const scratchColor = useRef(new THREE.Color())
  const scratchColorA = useRef(new THREE.Color())
  const scratchColorB = useRef(new THREE.Color())

  const targetLayoutRef = useRef<NodeSlot[]>(emptySlots())
  const targetLinkWeightsRef = useRef<number[]>(EDGES.map(() => 0))
  const targetPulseWeightRef = useRef(0)

  const reducedMotionRef = useRef(false)
  const elapsedRef = useRef(0)
  const groupRef = useRef<THREE.Group>(null)

  useEffect(() => {
    reducedMotionRef.current = readReducedMotion()
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handleChange = (event: MediaQueryListEvent) => {
      reducedMotionRef.current = event.matches
    }
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  // Prop-driven targets: only touches refs, never triggers per-frame renders.
  useEffect(() => {
    if (variant === 'wizard') {
      const clampedStage = Math.min(Math.max(stage, 1), totalStages)
      const ratio = totalStages > 1 ? (clampedStage - 1) / (totalStages - 1) : 1
      const character = Math.round(ratio * (CHARACTER_COUNT - 1)) + 1
      targetLayoutRef.current = buildCharacterLayout(character)
      targetLinkWeightsRef.current = buildCharacterLinkWeights(character)
      targetPulseWeightRef.current = character === CHARACTER_COUNT ? 1 : 0
    } else if (variant === 'ambient') {
      targetLayoutRef.current = AMBIENT_LAYOUT
      targetLinkWeightsRef.current = AMBIENT_LINK_WEIGHTS
      targetPulseWeightRef.current = 0
    } else {
      targetLayoutRef.current = ACCENT_LAYOUT
      targetLinkWeightsRef.current = ACCENT_LINK_WEIGHTS
      targetPulseWeightRef.current = 0
    }
  }, [stage, totalStages, variant])

  useFrame((_frameState, delta) => {
    try {
      const positionAttr = pointGeometry.getAttribute('position') as THREE.BufferAttribute
      const colorAttr = pointGeometry.getAttribute('aColor') as THREE.BufferAttribute
      const scaleAttr = pointGeometry.getAttribute('aScale') as THREE.BufferAttribute
      const linePositionAttr = lineGeometry.getAttribute('position') as THREE.BufferAttribute
      const lineColorAttr = lineGeometry.getAttribute('color') as THREE.BufferAttribute

      const reduced = reducedMotionRef.current
      if (!reduced) {
        elapsedRef.current += delta
      }
      const elapsed = elapsedRef.current

      // Frame-rate independent damped lerp: settles over ~1s regardless of
      // delta, since the factor is derived from elapsed time, not a fixed
      // per-frame constant.
      const lerpFactor = reduced ? 1 : 1 - Math.exp(-config.lerpRate * delta)

      const targetLayout = targetLayoutRef.current
      const targetLinkWeights = targetLinkWeightsRef.current

      for (let i = 0; i < MAX_NODES; i += 1) {
        const target = targetLayout[i]
        const current = currentPositions.current[i]
        if (!target || !current) continue

        current.lerp(target.position, lerpFactor)
        currentScales.current[i] += (Number(target.active) - currentScales.current[i]) * lerpFactor
        currentColorTs.current[i] += (target.colorT - currentColorTs.current[i]) * lerpFactor

        // Continuous overlay motion for ring nodes (orbiting tokens / slow
        // rotating ring), computed fresh each frame from the lerped slot
        // position so it never fights the lerp itself.
        const role = roleForIndex(i)
        let renderX = current.x
        const renderY = current.y
        let renderZ = current.z
        if (role === 'ring' && !reduced) {
          const spinAngle = elapsed * config.ringSpinSpeed
          const cos = Math.cos(spinAngle)
          const sin = Math.sin(spinAngle)
          renderX = current.x * cos - current.z * sin
          renderZ = current.x * sin + current.z * cos
        }

        const colorT = currentColorTs.current[i]
        scratchColor.current.lerpColors(COLOR_JADE, COLOR_GOLD, colorT)

        if (i === PULSE_NODE_INDEX) {
          currentPulseWeight.current +=
            (targetPulseWeightRef.current - currentPulseWeight.current) * lerpFactor
          const pulse = reduced
            ? 0
            : (Math.sin(elapsed * 2.4) * 0.5 + 0.5) * currentPulseWeight.current
          scratchColor.current.lerp(COLOR_GOLD_BRIGHT, pulse * 0.6)
        }

        positionAttr.setXYZ(i, renderX, renderY, renderZ)
        colorAttr.setXYZ(i, scratchColor.current.r, scratchColor.current.g, scratchColor.current.b)
        scaleAttr.setX(i, currentScales.current[i])
      }

      for (let linkIndex = 0; linkIndex < MAX_LINKS; linkIndex += 1) {
        const edge = EDGES[linkIndex]
        const targetWeight = targetLinkWeights[linkIndex] ?? 0
        currentLinkWeights.current[linkIndex] +=
          (targetWeight - currentLinkWeights.current[linkIndex]) * lerpFactor
        const weight = currentLinkWeights.current[linkIndex]

        if (!edge) {
          linePositionAttr.setXYZ(linkIndex * 2, 0, 0, 0)
          linePositionAttr.setXYZ(linkIndex * 2 + 1, 0, 0, 0)
          lineColorAttr.setXYZ(linkIndex * 2, 0, 0, 0)
          lineColorAttr.setXYZ(linkIndex * 2 + 1, 0, 0, 0)
          continue
        }

        const [a, b] = edge
        const ax = positionAttr.getX(a)
        const ay = positionAttr.getY(a)
        const az = positionAttr.getZ(a)
        const bx = positionAttr.getX(b)
        const by = positionAttr.getY(b)
        const bz = positionAttr.getZ(b)

        linePositionAttr.setXYZ(linkIndex * 2, ax, ay, az)
        linePositionAttr.setXYZ(linkIndex * 2 + 1, bx, by, bz)

        scratchColorA.current.lerpColors(COLOR_JADE, COLOR_GOLD, currentColorTs.current[a] ?? 0)
        scratchColorB.current.lerpColors(COLOR_JADE, COLOR_GOLD, currentColorTs.current[b] ?? 0)
        lineColorAttr.setXYZ(
          linkIndex * 2,
          scratchColorA.current.r * weight,
          scratchColorA.current.g * weight,
          scratchColorA.current.b * weight
        )
        lineColorAttr.setXYZ(
          linkIndex * 2 + 1,
          scratchColorB.current.r * weight,
          scratchColorB.current.g * weight,
          scratchColorB.current.b * weight
        )
      }

      positionAttr.needsUpdate = true
      colorAttr.needsUpdate = true
      scaleAttr.needsUpdate = true
      linePositionAttr.needsUpdate = true
      lineColorAttr.needsUpdate = true

      // Gentle continuous idle drift for the whole cluster, independent of
      // stage transitions, so it never looks static.
      if (groupRef.current && !reduced) {
        groupRef.current.rotation.y += delta * config.idleRotationSpeed
        groupRef.current.position.y = Math.sin(elapsed * 0.15) * 0.05
      }
    } catch {
      /* context lost mid-frame; skip this frame gracefully */
    }
  })

  return (
    <group ref={groupRef}>
      <points geometry={pointGeometry}>
        <shaderMaterial
          args={[
            {
              uniforms: pointUniformsRef.current,
              vertexShader: POINT_VERTEX_SHADER,
              fragmentShader: POINT_FRAGMENT_SHADER,
              transparent: true,
              depthWrite: false,
              depthTest: false,
              blending: THREE.AdditiveBlending,
            } satisfies THREE.ShaderMaterialParameters,
          ]}
        />
      </points>
      <lineSegments geometry={lineGeometry} material={lineMaterial} />
    </group>
  )
}

function ConstellationFallback({ className }: { className?: string }) {
  return <div className={cn('pointer-events-none relative h-full w-full', className)} aria-hidden="true" />
}

/**
 * ConstellationField — the Hayesh "Obsidian Aurora" signature constellation.
 * In `wizard` mode it progressively assembles (8 characters) as `stage`
 * advances toward `totalStages`; `ambient`/`accent` render static, dimmer,
 * slower variants for background/decorative use. Client-only, SSR-safe,
 * degrades silently on WebGL context loss, and respects reduced-motion.
 */
export function ConstellationField({
  stage,
  totalStages,
  variant = 'wizard',
  className,
}: ConstellationFieldProps) {
  const [mounted, setMounted] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => setMounted(true), [])

  // Render nothing GPU-backed during SSR / the very first client render —
  // an r3f <Canvas> rendered server-side previously caused a production
  // React #418 hydration crash in this repo.
  if (!mounted || failed) {
    return <ConstellationFallback className={className} />
  }

  const handleContextLost = (event: Event) => {
    event.preventDefault()
    setFailed(true)
  }

  const handleContextRestored = () => {
    setFailed(false)
  }

  return (
    <div className={cn('pointer-events-none relative h-full w-full', className)} aria-hidden="true">
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 6], fov: 45 }}
        gl={{ antialias: false, alpha: true, powerPreference: 'low-power' }}
        style={{ background: 'transparent' }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0)
          gl.domElement.addEventListener('webglcontextlost', handleContextLost, false)
          gl.domElement.addEventListener('webglcontextrestored', handleContextRestored, false)
        }}
      >
        <ConstellationScene stage={stage} totalStages={totalStages} variant={variant} />
      </Canvas>
    </div>
  )
}

export default ConstellationField
