"use client"

import { useRef, useMemo } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { Float, Stars } from "@react-three/drei"
import * as THREE from "three"

function WireframeIcosahedron() {
  const meshRef = useRef<THREE.Mesh>(null!)

  useFrame((state) => {
    const t = state.clock.getElapsedTime()
    meshRef.current.rotation.x = Math.sin(t * 0.15) * 0.3
    meshRef.current.rotation.y = t * 0.1
    meshRef.current.rotation.z = Math.cos(t * 0.1) * 0.15
  })

  const geometry = useMemo(() => new THREE.IcosahedronGeometry(1.8, 1), [])

  return (
    <Float speed={1.5} rotationIntensity={0.3} floatIntensity={0.5}>
      <mesh ref={meshRef} geometry={geometry}>
        <meshBasicMaterial
          wireframe
          color="#6C63FF"
          transparent
          opacity={0.25}
        />
      </mesh>
    </Float>
  )
}

function WireframeOctahedron() {
  const meshRef = useRef<THREE.Mesh>(null!)

  useFrame((state) => {
    const t = state.clock.getElapsedTime()
    meshRef.current.rotation.x = t * 0.08
    meshRef.current.rotation.y = Math.cos(t * 0.12) * 0.4
  })

  const geometry = useMemo(() => new THREE.OctahedronGeometry(0.8, 0), [])

  return (
    <Float speed={2} rotationIntensity={0.5} floatIntensity={0.8}>
      <mesh ref={meshRef} geometry={geometry} position={[2.5, 0.5, -1]}>
        <meshBasicMaterial
          wireframe
          color="#00D4FF"
          transparent
          opacity={0.2}
        />
      </mesh>
    </Float>
  )
}

function GridPlane() {
  const gridRef = useRef<THREE.GridHelper>(null!)

  useFrame((state) => {
    const t = state.clock.getElapsedTime()
    gridRef.current.position.z = (t * 0.3) % 2
  })

  return (
    <gridHelper
      ref={gridRef}
      args={[30, 30, "#6C63FF", "#1a1a3e"]}
      position={[0, -2.5, 0]}
      rotation={[0, 0, 0]}
    />
  )
}

function FloatingParticles() {
  const count = 50
  const mesh = useRef<THREE.InstancedMesh>(null!)

  const particles = useMemo(() => {
    const temp = []
    for (let i = 0; i < count; i++) {
      temp.push({
        x: (Math.random() - 0.5) * 12,
        y: (Math.random() - 0.5) * 8,
        z: (Math.random() - 0.5) * 8,
        scale: Math.random() * 0.02 + 0.005,
        speed: Math.random() * 0.3 + 0.1,
      })
    }
    return temp
  }, [])

  const dummy = useMemo(() => new THREE.Object3D(), [])

  useFrame((state) => {
    const t = state.clock.getElapsedTime()
    particles.forEach((p, i) => {
      dummy.position.set(
        p.x + Math.sin(t * p.speed + i) * 0.5,
        p.y + Math.cos(t * p.speed * 0.7 + i) * 0.3,
        p.z
      )
      dummy.scale.setScalar(p.scale)
      dummy.updateMatrix()
      mesh.current.setMatrixAt(i, dummy.matrix)
    })
    mesh.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color="#6C63FF" transparent opacity={0.6} />
    </instancedMesh>
  )
}

export function AuthScene() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10">
      <Canvas
        camera={{ position: [0, 0, 6], fov: 50 }}
        dpr={[1, 1.5]}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.5} />
        <WireframeIcosahedron />
        <WireframeOctahedron />
        <GridPlane />
        <FloatingParticles />
        <Stars
          radius={20}
          depth={50}
          count={1000}
          factor={2}
          saturation={0}
          fade
          speed={0.5}
        />
      </Canvas>
    </div>
  )
}
