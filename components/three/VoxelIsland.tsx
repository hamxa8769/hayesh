'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { cn } from '@/lib/utils/cn'
import type { IslandFeature, IslandModel } from './voxel-island-model'

// ---------------------------------------------------------------------------
// VoxelIsland — the reusable r3f voxel scene for a child's progress island.
// Mirrors the hard-won safety patterns in ScrollWorld.tsx / ConstellationField.tsx:
//   - client-only mount gate (an SSR-rendered <Canvas> caused a production
//     React #418 crash in this repo)
//   - webglcontextlost handling that degrades to a silent placeholder
//   - prefers-reduced-motion freezes auto-rotate + idle bob to a static frame
//   - all per-frame work mutates refs; never setState inside useFrame
//   - exactly ONE InstancedMesh per repeated element type (terrain, vegetation,
//     buildings, decorations) — never per-voxel meshes
// The caller (ProgressIsland.tsx) decides whether to mount this component at
// all (reduced motion / mobile / low-power / no-webgl all route to a non-3D
// fallback there); this file adds its own defensive gate on top, exactly like
// ConstellationField does for its callers.
// ---------------------------------------------------------------------------

// Buffer capacities — generous upper bounds for the model's worst case
// (MAX_RADIUS=5, MAX_TREES=28, MAX_SAPLINGS=14, MAX_SEEDS=10, MAX_BUILDINGS=6,
// MAX_DECORATIONS=16 in voxel-island-model.ts), not the typical actual count.
// `mesh.count` is set per-model to the real, usually much smaller, number.
const TERRAIN_BUFFER = 300
const VEGETATION_BUFFER = 90
const BUILDING_BUFFER = 20
const DECORATION_BUFFER = 16

// Natural voxel palette — literal colors are acceptable here (3D scene
// materials), per the design-system carve-out. Aurora jade/gold is reserved
// for lighting, not painted onto every voxel.
const GRASS_COLORS = ['#4CAF6D', '#57B876', '#3F9C5F']
const DIRT_COLOR = '#8B5E3C'
const ROCK_COLOR = '#6B6F76'
const SAND_COLOR = '#E4C687'
const TRUNK_COLOR = '#6B4423'
const FOLIAGE_COLORS = ['#3FA35B', '#4CB86A', '#2E8B4F']
const SAPLING_COLOR = '#5FCB7A'
const SEED_COLOR = '#8B5E3C'
const BUILDING_BODY_COLOR = '#D8CBB0'
const BUILDING_ROOF_COLORS = ['#C4674B', '#5B7A9C', '#8C9C5B', '#B08C4C', '#7A5B9C', '#4C8C9C']
const FLOWER_COLORS = ['#E86C9A', '#E8A13C', '#C3E86C']
const LANTERN_COLOR = '#F5C154'
const WATER_COLOR = '#2E6F9E'

// Aurora-tinted lighting — jade/gold reserved for light, not voxel paint.
const HEMI_SKY_COLOR = '#F5D9A8'
const HEMI_GROUND_COLOR = '#144F42'
const AMBIENT_COLOR = '#8892A6'
const SUN_COLOR = '#FFF3DD'

/** Small deterministic hash for cosmetic color-variance only (never for
 * placement — that already happened in voxel-island-model.ts). Not exported;
 * this file has no need for the model's placement hash. */
function colorHash01(input: string): number {
  let hash = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) / 4294967296
}

function pickFrom(colors: readonly string[], t: number): string {
  const index = Math.min(colors.length - 1, Math.floor(t * colors.length))
  return colors[index] ?? colors[0] ?? '#FFFFFF'
}

interface InstanceTransform {
  x: number
  y: number
  z: number
  sx: number
  sy: number
  sz: number
  rotY?: number
  color: string
}

function terrainLayerCount(distanceRatio: number): number {
  return Math.min(3, Math.max(1, Math.round(3 - 2 * distanceRatio)))
}

function buildTerrainTransforms(model: IslandModel): InstanceTransform[] {
  const transforms: InstanceTransform[] = []
  for (const cell of model.terrain) {
    const layers = cell.layer === 'sand' ? 1 : terrainLayerCount(cell.distanceRatio)
    for (let layer = 0; layer < layers; layer += 1) {
      let color: string
      if (layer === 0) {
        color =
          cell.layer === 'sand' ? SAND_COLOR : pickFrom(GRASS_COLORS, colorHash01(`grass:${cell.x}:${cell.z}`))
      } else if (layer === 1) {
        color = DIRT_COLOR
      } else {
        color = ROCK_COLOR
      }
      transforms.push({ x: cell.x, y: -layer, z: cell.z, sx: 0.96, sy: 1, sz: 0.96, color })
    }
  }
  return transforms
}

function buildVegetationTransforms(features: IslandFeature[]): InstanceTransform[] {
  const transforms: InstanceTransform[] = []
  for (const f of features) {
    if (f.kind === 'tree') {
      const foliageColor = FOLIAGE_COLORS[f.variant % FOLIAGE_COLORS.length] ?? FOLIAGE_COLORS[0] ?? '#3FA35B'
      transforms.push({ x: f.x, y: 1.0, z: f.z, sx: 0.4, sy: 1, sz: 0.4, color: TRUNK_COLOR })
      transforms.push({
        x: f.x,
        y: 1.75,
        z: f.z,
        sx: 1.1,
        sy: 0.9,
        sz: 1.1,
        rotY: f.variance * Math.PI,
        color: foliageColor,
      })
    } else if (f.kind === 'sapling') {
      transforms.push({ x: f.x, y: 0.75, z: f.z, sx: 0.5, sy: 0.5, sz: 0.5, color: SAPLING_COLOR })
    } else if (f.kind === 'seed') {
      transforms.push({ x: f.x, y: 0.62, z: f.z, sx: 0.28, sy: 0.24, sz: 0.28, color: SEED_COLOR })
    }
  }
  return transforms
}

function buildBuildingTransforms(features: IslandFeature[]): InstanceTransform[] {
  const transforms: InstanceTransform[] = []
  for (const f of features) {
    if (f.kind !== 'building') continue
    const roofColor =
      BUILDING_ROOF_COLORS[f.variant % BUILDING_ROOF_COLORS.length] ?? BUILDING_ROOF_COLORS[0] ?? '#C4674B'
    transforms.push({ x: f.x, y: 0.95, z: f.z, sx: 0.85, sy: 0.9, sz: 0.85, color: BUILDING_BODY_COLOR })
    transforms.push({ x: f.x, y: 1.75, z: f.z, sx: 0.68, sy: 0.7, sz: 0.68, color: BUILDING_BODY_COLOR })
    transforms.push({
      x: f.x,
      y: 2.45,
      z: f.z,
      sx: 0.55,
      sy: 0.55,
      sz: 0.55,
      rotY: Math.PI / 4,
      color: roofColor,
    })
  }
  return transforms
}

function buildDecorationTransforms(features: IslandFeature[]): InstanceTransform[] {
  const transforms: InstanceTransform[] = []
  for (const f of features) {
    if (f.kind === 'flower') {
      const color = FLOWER_COLORS[f.variant % FLOWER_COLORS.length] ?? FLOWER_COLORS[0] ?? '#E86C9A'
      transforms.push({ x: f.x, y: 0.62, z: f.z, sx: 0.22, sy: 0.22, sz: 0.22, color })
    } else if (f.kind === 'lantern') {
      transforms.push({ x: f.x, y: 0.68, z: f.z, sx: 0.24, sy: 0.32, sz: 0.24, color: LANTERN_COLOR })
    }
  }
  return transforms
}

/** Writes `transforms` (capped at `capacity`) into an InstancedMesh's matrix
 * + instanceColor buffers. Called only when the model changes (an effect),
 * never per-frame — this is the standard InstancedMesh update pattern, not a
 * violation of the "never setState per frame" rule. */
function writeInstances(mesh: THREE.InstancedMesh, transforms: InstanceTransform[], capacity: number): void {
  const dummy = new THREE.Object3D()
  const color = new THREE.Color()
  const count = Math.min(transforms.length, capacity)
  for (let i = 0; i < count; i += 1) {
    const t = transforms[i]
    if (!t) continue
    dummy.position.set(t.x, t.y, t.z)
    dummy.scale.set(t.sx, t.sy, t.sz)
    dummy.rotation.set(0, t.rotY ?? 0, 0)
    dummy.updateMatrix()
    mesh.setMatrixAt(i, dummy.matrix)
    color.set(t.color)
    mesh.setColorAt(i, color)
  }
  mesh.count = count
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
}

function readReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

interface VoxelIslandSceneProps {
  model: IslandModel
}

function VoxelIslandScene({ model }: VoxelIslandSceneProps) {
  const cubeGeometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])
  const cubeMaterial = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0.05 }), [])
  const waterGeometry = useMemo(() => new THREE.CircleGeometry(1, 32), [])
  const waterMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: WATER_COLOR,
        transparent: true,
        opacity: 0.55,
        roughness: 0.3,
        metalness: 0.1,
      }),
    []
  )

  useEffect(() => {
    return () => {
      cubeGeometry.dispose()
      cubeMaterial.dispose()
      waterGeometry.dispose()
      waterMaterial.dispose()
    }
  }, [cubeGeometry, cubeMaterial, waterGeometry, waterMaterial])

  const terrainRef = useRef<THREE.InstancedMesh>(null)
  const vegetationRef = useRef<THREE.InstancedMesh>(null)
  const buildingRef = useRef<THREE.InstancedMesh>(null)
  const decorationRef = useRef<THREE.InstancedMesh>(null)
  const groupRef = useRef<THREE.Group>(null)

  const [reducedMotion, setReducedMotion] = useState(readReducedMotion)
  const elapsedRef = useRef(0)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mediaQuery.matches)
    const handleChange = (event: MediaQueryListEvent) => setReducedMotion(event.matches)
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  // Rebuild instance buffers whenever the model changes (data-driven growth
  // as homework gets graded / submitted). Never per-frame.
  useEffect(() => {
    if (terrainRef.current) writeInstances(terrainRef.current, buildTerrainTransforms(model), TERRAIN_BUFFER)
    if (vegetationRef.current) {
      writeInstances(vegetationRef.current, buildVegetationTransforms(model.features), VEGETATION_BUFFER)
    }
    if (buildingRef.current) {
      writeInstances(buildingRef.current, buildBuildingTransforms(model.features), BUILDING_BUFFER)
    }
    if (decorationRef.current) {
      writeInstances(decorationRef.current, buildDecorationTransforms(model.features), DECORATION_BUFFER)
    }
  }, [model])

  useFrame((_state, delta) => {
    const group = groupRef.current
    if (!group) return
    if (reducedMotion) {
      group.position.y = 0
      return
    }
    elapsedRef.current += delta
    group.position.y = Math.sin(elapsedRef.current * 0.5) * 0.08
  })

  const waterRadius = model.radius + 2.2

  return (
    <>
      <hemisphereLight args={[HEMI_SKY_COLOR, HEMI_GROUND_COLOR, 0.9]} />
      <ambientLight intensity={0.35} color={AMBIENT_COLOR} />
      <directionalLight position={[4, 6, 3]} intensity={0.8} color={SUN_COLOR} />

      <mesh
        geometry={waterGeometry}
        material={waterMaterial}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -3.1, 0]}
        scale={[waterRadius, waterRadius, 1]}
      />

      <group ref={groupRef}>
        <instancedMesh ref={terrainRef} args={[cubeGeometry, cubeMaterial, TERRAIN_BUFFER]} frustumCulled={false} />
        <instancedMesh
          ref={vegetationRef}
          args={[cubeGeometry, cubeMaterial, VEGETATION_BUFFER]}
          frustumCulled={false}
        />
        <instancedMesh ref={buildingRef} args={[cubeGeometry, cubeMaterial, BUILDING_BUFFER]} frustumCulled={false} />
        <instancedMesh
          ref={decorationRef}
          args={[cubeGeometry, cubeMaterial, DECORATION_BUFFER]}
          frustumCulled={false}
        />
      </group>

      <OrbitControls
        enablePan={false}
        enableDamping={!reducedMotion}
        autoRotate={!reducedMotion}
        autoRotateSpeed={0.6}
        target={[0, 0.8, 0]}
        minDistance={model.radius + 3}
        maxDistance={model.radius + 9}
        minPolarAngle={0.35}
        maxPolarAngle={Math.PI / 2 - 0.05}
      />
    </>
  )
}

function VoxelIslandPlaceholder({ className }: { className?: string }) {
  return <div className={cn('relative h-64 w-full sm:h-80', className)} aria-hidden="true" />
}

export interface VoxelIslandProps {
  model: IslandModel
  className?: string
  /** Called when the WebGL context is lost — the caller (ProgressIsland)
   *  uses this to fall back to the non-3D summary view. */
  onContextLost?: () => void
}

/**
 * VoxelIsland — one persistent WebGL canvas rendering a child's progress as
 * a small floating voxel island. Client-only, SSR-safe (an r3f <Canvas>
 * rendered server-side previously caused a production React #418 hydration
 * crash in this repo), degrades silently to a placeholder on context loss,
 * respects prefers-reduced-motion, and uses exactly four InstancedMeshes
 * (terrain, vegetation, buildings, decorations) for the entire scene.
 */
export function VoxelIsland({ model, className, onContextLost }: VoxelIslandProps) {
  const [mounted, setMounted] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted || failed) {
    return <VoxelIslandPlaceholder className={className} />
  }

  const handleContextLost = (event: Event) => {
    event.preventDefault()
    setFailed(true)
    onContextLost?.()
  }

  const handleContextRestored = () => {
    setFailed(false)
  }

  return (
    <div className={cn('relative h-64 w-full overflow-hidden rounded-[10px] sm:h-80', className)}>
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: [model.radius * 1.1, model.radius * 1.6, model.radius + 7], fov: 42 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
        style={{ background: 'transparent' }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0)
          gl.domElement.addEventListener('webglcontextlost', handleContextLost, false)
          gl.domElement.addEventListener('webglcontextrestored', handleContextRestored, false)
        }}
      >
        <VoxelIslandScene model={model} />
      </Canvas>
    </div>
  )
}

export default VoxelIsland
