"use client"

import { useRef, useMemo, useEffect, useState, Suspense } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { Float, Stars } from "@react-three/drei"
import * as THREE from "three"

function WireframeIcosahedron() {
  const meshRef = useRef<THREE.Mesh>(null!)

  useFrame((state) => {
    if (!meshRef.current) return
    try {
      const t = state.clock.getElapsedTime()
      meshRef.current.rotation.x = Math.sin(t * 0.15) * 0.3
      meshRef.current.rotation.y = t * 0.1
      meshRef.current.rotation.z = Math.cos(t * 0.1) * 0.15
    } catch { /* context lost */ }
  })

  const geometry = useMemo(() => new THREE.IcosahedronGeometry(1.8, 1), [])

  return (
    <Float speed={1.5} rotationIntensity={0.3} floatIntensity={0.5}>
      <mesh ref={meshRef} geometry={geometry}>
        <meshBasicMaterial wireframe color="#27C4A0" transparent opacity={0.25} />
      </mesh>
    </Float>
  )
}

function WireframeOctahedron() {
  const meshRef = useRef<THREE.Mesh>(null!)

  useFrame((state) => {
    if (!meshRef.current) return
    try {
      const t = state.clock.getElapsedTime()
      meshRef.current.rotation.x = t * 0.08
      meshRef.current.rotation.y = Math.cos(t * 0.12) * 0.4
    } catch { /* context lost */ }
  })

  const geometry = useMemo(() => new THREE.OctahedronGeometry(0.8, 0), [])

  return (
    <Float speed={2} rotationIntensity={0.5} floatIntensity={0.8}>
      <mesh ref={meshRef} geometry={geometry} position={[2.5, 0.5, -1]}>
        <meshBasicMaterial wireframe color="#F5B84E" transparent opacity={0.2} />
      </mesh>
    </Float>
  )
}

function GridPlane() {
  const gridRef = useRef<THREE.GridHelper>(null!)

  useFrame((state) => {
    if (!gridRef.current) return
    try {
      const t = state.clock.getElapsedTime()
      gridRef.current.position.z = (t * 0.3) % 2
    } catch { /* context lost */ }
  })

  return (
    <gridHelper
      ref={gridRef}
      args={[30, 30, "#27C4A0", "#1a1a3e"]}
      position={[0, -2.5, 0]}
    />
  )
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.5} />
      <WireframeIcosahedron />
      <WireframeOctahedron />
      <GridPlane />
      <Stars radius={20} depth={50} count={300} factor={2} saturation={0} fade speed={0.5} />
    </>
  )
}

function CanvasFallback() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 bg-background" />
  )
}

function SafeCanvas() {
  const [failed, setFailed] = useState(false)

  if (failed) return <CanvasFallback />

  return (
    <Canvas
      camera={{ position: [0, 0, 6], fov: 50 }}
      dpr={[1, 1.5]}
      style={{ background: "transparent" }}
      gl={{ antialias: false, alpha: true, powerPreference: "low-power" }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0)
        // Listen for context loss — hide canvas gracefully
        gl.domElement.addEventListener("webglcontextlost", (e) => {
          e.preventDefault()
          setFailed(true)
        }, { once: true })
      }}
    >
      <Scene />
    </Canvas>
  )
}

export function AuthScene() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Delay mount to avoid competing with page load for GPU resources
    const timer = setTimeout(() => setMounted(true), 100)
    return () => clearTimeout(timer)
  }, [])

  if (!mounted) return <CanvasFallback />

  return (
    <div className="pointer-events-none fixed inset-0 -z-10">
      <Suspense fallback={<CanvasFallback />}>
        <SafeCanvas />
      </Suspense>
    </div>
  )
}
