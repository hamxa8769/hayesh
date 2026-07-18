'use client'

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useScrollProgressRef } from '@/hooks/useScrollProgress'
import { cn } from '@/lib/utils/cn'

// ---------------------------------------------------------------------------
// ScrollWorld — the Hayesh landing page's signature scroll-driven backdrop.
//
// ONE persistent, fixed-position <Canvas> for the entire page (see the hard
// rule in the calling code: never mount a second canvas per section). A
// jade -> gold particle field reshapes itself as the reader scrolls:
//   hero            -> a dispersed, drifting cloud (Fibonacci-sphere scatter)
//   listings/pricing -> the cloud coalesces into a structured lattice grid
//   CTA / footer     -> the lattice settles into a calm horizon line
// All three target layouts are precomputed once; per-frame work only blends
// between them and writes into reused scratch objects, so nothing allocates
// or calls setState inside the render loop.
// ---------------------------------------------------------------------------

const COLOR_JADE = new THREE.Color('#27C4A0')
const COLOR_GOLD = new THREE.Color('#F5B84E')

const MAX_PARTICLES = 180
const DESKTOP_ACTIVE = 180
const REDUCED_BUDGET_ACTIVE = 70 // mobile viewport and/or low-end hardware

const LATTICE_COLS = 12
const LATTICE_ROWS = 8

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

/** Deterministic pseudo-random in [0, 1), seeded purely by index — no RNG
 * state, so results are identical across every mount (no hydration risk,
 * though this component is client-only anyway). */
function deterministicJitter(index: number): number {
  return ((index * 2654435761) % 9973) / 9973
}

function buildDispersedLayout(count: number): THREE.Vector3[] {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5))
  return Array.from({ length: count }, (_unused, i) => {
    const t = count > 1 ? i / (count - 1) : 0
    const y = 1 - t * 2
    const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = goldenAngle * i
    const jitter = 0.7 + deterministicJitter(i) * 0.9
    return new THREE.Vector3(
      Math.cos(theta) * radiusAtY * 4.6 * jitter,
      y * 2.7 * jitter,
      Math.sin(theta) * radiusAtY * 3.4 * jitter - 1.2
    )
  })
}

function buildLatticeLayout(count: number): THREE.Vector3[] {
  const spacingX = 0.82
  const spacingY = 0.68
  return Array.from({ length: count }, (_unused, i) => {
    const col = i % LATTICE_COLS
    const row = Math.floor(i / LATTICE_COLS) % LATTICE_ROWS
    const layer = Math.floor(i / (LATTICE_COLS * LATTICE_ROWS))
    return new THREE.Vector3(
      (col - (LATTICE_COLS - 1) / 2) * spacingX,
      (row - (LATTICE_ROWS - 1) / 2) * spacingY - 0.2,
      -2.6 - layer * 1.15
    )
  })
}

function buildHorizonLayout(count: number): THREE.Vector3[] {
  return Array.from({ length: count }, (_unused, i) => {
    const t = count > 1 ? i / (count - 1) : 0
    const x = (t - 0.5) * 17
    const arc = Math.sin(t * Math.PI)
    return new THREE.Vector3(x, -2.5 + arc * 0.55, -3 + ((i % 5) - 2) * 0.4)
  })
}

const DISPERSED_LAYOUT = buildDispersedLayout(MAX_PARTICLES)
const LATTICE_LAYOUT = buildLatticeLayout(MAX_PARTICLES)
const HORIZON_LAYOUT = buildHorizonLayout(MAX_PARTICLES)

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
    vec3 finalColor = vColor * (0.55 + core * 1.5);
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

interface NavigatorWithMemory extends Navigator {
  deviceMemory?: number
}

/** Mirrors the ECC motion-ui low-end heuristic: low memory (Chrome/Android),
 * or few cores with no memory API at all (covers Safari/Firefox). */
function isLowEndDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const nav = navigator as NavigatorWithMemory
  if (nav.deviceMemory !== undefined) return nav.deviceMemory <= 2
  return nav.hardwareConcurrency <= 4
}

function readParticleBudget(): number {
  if (typeof window === 'undefined') return DESKTOP_ACTIVE
  const isMobileViewport = window.matchMedia('(max-width: 768px)').matches
  return isMobileViewport || isLowEndDevice() ? REDUCED_BUDGET_ACTIVE : DESKTOP_ACTIVE
}

interface ScrollWorldSceneProps {
  progressRef: RefObject<number>
}

function ScrollWorldScene({ progressRef }: ScrollWorldSceneProps) {
  const { camera } = useThree()

  const pointGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES * 3), 3))
    geometry.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES * 3), 3))
    geometry.setAttribute('aScale', new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES), 1))
    return geometry
  }, [])

  const pointUniformsRef = useRef<PointUniforms>({
    uPixelRatio: { value: typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio, 2) },
    uBaseSize: { value: 30 },
    uOpacity: { value: 0.4 },
  })

  useEffect(() => {
    return () => {
      pointGeometry.dispose()
    }
  }, [pointGeometry])

  // All animation state lives in refs — useFrame never triggers a re-render.
  const currentPositions = useRef<THREE.Vector3[]>(
    Array.from({ length: MAX_PARTICLES }, () => new THREE.Vector3(0, 0, 0))
  )
  const currentScales = useRef<Float32Array>(new Float32Array(MAX_PARTICLES))
  const currentColorTs = useRef<Float32Array>(new Float32Array(MAX_PARTICLES))
  const scratchTarget = useRef(new THREE.Vector3())
  const scratchColor = useRef(new THREE.Color())
  const groupRotationRef = useRef(0)

  const reducedMotionRef = useRef(false)
  const activeCountRef = useRef(DESKTOP_ACTIVE)
  const elapsedRef = useRef(0)
  const pointerTargetRef = useRef({ x: 0, y: 0 })
  const pointerCurrentRef = useRef({ x: 0, y: 0 })
  const groupRef = useRef<THREE.Group>(null)

  useEffect(() => {
    reducedMotionRef.current = readReducedMotion()
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handleReducedMotionChange = (event: MediaQueryListEvent) => {
      reducedMotionRef.current = event.matches
    }
    reducedMotionQuery.addEventListener('change', handleReducedMotionChange)

    activeCountRef.current = readParticleBudget()
    const mobileViewportQuery = window.matchMedia('(max-width: 768px)')
    const handleViewportChange = () => {
      activeCountRef.current = readParticleBudget()
    }
    mobileViewportQuery.addEventListener('change', handleViewportChange)

    const handlePointerMove = (event: PointerEvent) => {
      pointerTargetRef.current.x = event.clientX / window.innerWidth - 0.5
      pointerTargetRef.current.y = event.clientY / window.innerHeight - 0.5
    }
    window.addEventListener('pointermove', handlePointerMove, { passive: true })

    return () => {
      reducedMotionQuery.removeEventListener('change', handleReducedMotionChange)
      mobileViewportQuery.removeEventListener('change', handleViewportChange)
      window.removeEventListener('pointermove', handlePointerMove)
    }
  }, [])

  useFrame((_frameState, delta) => {
    try {
      const positionAttr = pointGeometry.getAttribute('position') as THREE.BufferAttribute
      const colorAttr = pointGeometry.getAttribute('aColor') as THREE.BufferAttribute
      const scaleAttr = pointGeometry.getAttribute('aScale') as THREE.BufferAttribute

      const reduced = reducedMotionRef.current
      if (!reduced) {
        elapsedRef.current += delta
      }
      const elapsed = elapsedRef.current

      // Frame-rate independent damped lerp: settles at the same real-world
      // rate regardless of refresh rate, since the factor derives from
      // elapsed delta rather than a fixed per-frame constant.
      const lerpFactor = reduced ? 1 : 1 - Math.exp(-2.6 * delta)

      const progress = Math.min(1, Math.max(0, progressRef.current))
      const toLattice = smoothstep(0.05, 0.42, progress)
      const toHorizon = smoothstep(0.78, 0.98, progress)
      // Journey color: jade at the hero, gold by the closing CTA.
      const journeyColorT = smoothstep(0.1, 0.95, progress)

      const activeCount = activeCountRef.current

      for (let i = 0; i < MAX_PARTICLES; i += 1) {
        const dispersed = DISPERSED_LAYOUT[i]
        const lattice = LATTICE_LAYOUT[i]
        const horizon = HORIZON_LAYOUT[i]
        const current = currentPositions.current[i]
        if (!dispersed || !lattice || !horizon || !current) continue

        scratchTarget.current.copy(dispersed).lerp(lattice, toLattice).lerp(horizon, toHorizon)
        current.lerp(scratchTarget.current, lerpFactor)

        const isActive = i < activeCount ? 1 : 0
        currentScales.current[i] += (isActive - currentScales.current[i]) * lerpFactor

        const perParticlePhase = deterministicJitter(i) * 0.1 - 0.05
        const targetColorT = Math.min(1, Math.max(0, journeyColorT + perParticlePhase))
        currentColorTs.current[i] += (targetColorT - currentColorTs.current[i]) * lerpFactor

        // Gentle organic bob layered on top of the lerped position, computed
        // fresh each frame so it never fights the position lerp itself.
        let renderY = current.y
        if (!reduced) {
          const bobPhase = i * 12.9898
          renderY += Math.sin(elapsed * 0.6 + bobPhase) * 0.045
        }

        scratchColor.current.lerpColors(COLOR_JADE, COLOR_GOLD, currentColorTs.current[i])

        positionAttr.setXYZ(i, current.x, renderY, current.z)
        colorAttr.setXYZ(i, scratchColor.current.r, scratchColor.current.g, scratchColor.current.b)
        scaleAttr.setX(i, currentScales.current[i])
      }

      positionAttr.needsUpdate = true
      colorAttr.needsUpdate = true
      scaleAttr.needsUpdate = true

      // Subtle whole-field rotation tied to scroll progress (a sense of
      // continuously moving through one world) plus a barely-there pointer
      // parallax lean — both frozen under reduced motion.
      if (groupRef.current) {
        const targetRotation = reduced ? 0 : progress * 0.5
        groupRotationRef.current += (targetRotation - groupRotationRef.current) * lerpFactor
        groupRef.current.rotation.y = groupRotationRef.current

        if (!reduced) {
          pointerCurrentRef.current.x += (pointerTargetRef.current.x - pointerCurrentRef.current.x) * 0.04
          pointerCurrentRef.current.y += (pointerTargetRef.current.y - pointerCurrentRef.current.y) * 0.04
          groupRef.current.rotation.x = -pointerCurrentRef.current.y * 0.08
          groupRef.current.position.x = pointerCurrentRef.current.x * 0.25
        }

        // Slow camera dolly through the field as the reader scrolls, from a
        // wider establishing view at the hero to a closer, calmer view by
        // the footer horizon.
        const targetCameraZ = 9.2 - progress * 2.6
        camera.position.z += (targetCameraZ - camera.position.z) * lerpFactor
      }
    } catch {
      /* WebGL context lost mid-frame; skip this frame gracefully */
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
    </group>
  )
}

function ScrollWorldFallback({ className }: { className?: string }) {
  return <div className={cn('pointer-events-none fixed inset-0 -z-10', className)} aria-hidden="true" />
}

export interface ScrollWorldProps {
  className?: string
}

/**
 * ScrollWorld — one persistent, fixed-position WebGL canvas behind the
 * entire landing page. Client-only, SSR-safe (renders nothing GPU-backed
 * until mounted — an r3f `<Canvas>` rendered server-side previously caused
 * a production React #418 hydration crash in this repo), degrades silently
 * on context loss, respects `prefers-reduced-motion`, and thins its particle
 * budget on mobile viewports / low-end hardware.
 */
export function ScrollWorld({ className }: ScrollWorldProps) {
  const [mounted, setMounted] = useState(false)
  const [failed, setFailed] = useState(false)
  const progressRef = useScrollProgressRef()

  useEffect(() => setMounted(true), [])

  if (!mounted || failed) {
    return <ScrollWorldFallback className={className} />
  }

  const handleContextLost = (event: Event) => {
    event.preventDefault()
    setFailed(true)
  }

  const handleContextRestored = () => {
    setFailed(false)
  }

  return (
    <div className={cn('pointer-events-none fixed inset-0 -z-10', className)} aria-hidden="true">
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 9.2], fov: 45 }}
        gl={{ antialias: false, alpha: true, powerPreference: 'low-power' }}
        style={{ background: 'transparent' }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0)
          gl.domElement.addEventListener('webglcontextlost', handleContextLost, false)
          gl.domElement.addEventListener('webglcontextrestored', handleContextRestored, false)
        }}
      >
        <ScrollWorldScene progressRef={progressRef} />
      </Canvas>
    </div>
  )
}

export default ScrollWorld
