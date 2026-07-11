'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ScreenQuad } from '@react-three/drei'

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = position.xy * 0.5 + 0.5;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform vec2 uResolution;
  uniform vec2 uMouse;

  varying vec2 vUv;

  // jade -> mid jade -> gold, matching the Hayesh aurora gradient
  const vec3 cJade = vec3(0.153, 0.769, 0.627);
  const vec3 cMid  = vec3(0.353, 0.820, 0.690);
  const vec3 cGold = vec3(0.961, 0.722, 0.306);

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 4; i++) {
      value += amplitude * noise(p);
      p *= 2.02;
      amplitude *= 0.5;
    }
    return value;
  }

  void main() {
    vec2 uv = vUv;
    float aspect = uResolution.x / uResolution.y;
    vec2 p = vec2(uv.x * aspect, uv.y);

    // lean the field gently toward the cursor
    vec2 mouseInfluence = (uMouse - vec2(0.5)) * 0.15;

    // concentrate the aurora toward the upper-right, quiet elsewhere
    vec2 origin = vec2(aspect * 0.72, 0.78) + mouseInfluence;
    float distToOrigin = distance(p, origin);
    float falloff = smoothstep(1.05, 0.0, distToOrigin);

    // flowing ribbon curtains via layered fbm, drifting slowly over time
    vec2 flow = p * 1.6 + vec2(uTime * 0.035, -uTime * 0.02);
    float n1 = fbm(flow + mouseInfluence);
    float n2 = fbm(flow * 1.8 + vec2(4.2, 1.1) - uTime * 0.015);
    float ribbon = fbm(vec2(n1, n2) * 2.0 + uTime * 0.01);

    float bands = sin((p.y + n1 * 0.6) * 6.0 + uTime * 0.12) * 0.5 + 0.5;
    bands *= smoothstep(0.15, 0.85, ribbon);

    float intensity = bands * falloff;
    intensity = clamp(intensity, 0.0, 1.0);

    // low overall brightness so body text stays legible
    intensity *= 0.42;

    vec3 color = mix(cJade, cMid, smoothstep(0.0, 0.55, ribbon));
    color = mix(color, cGold, smoothstep(0.45, 1.0, ribbon));

    vec3 finalColor = color * intensity;
    float alpha = intensity;

    gl_FragColor = vec4(finalColor, alpha);
  }
`

interface AuroraUniforms {
  [key: string]: THREE.IUniform
  uTime: THREE.IUniform<number>
  uResolution: THREE.IUniform<THREE.Vector2>
  uMouse: THREE.IUniform<THREE.Vector2>
}

function createUniforms(): AuroraUniforms {
  return {
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uMouse: { value: new THREE.Vector2(0.5, 0.5) },
  }
}

function AuroraMesh() {
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const uniformsRef = useRef<AuroraUniforms>(createUniforms())
  const mouseTargetRef = useRef(new THREE.Vector2(0.5, 0.5))
  const reducedMotionRef = useRef(false)
  const { size, viewport } = useThree()

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    reducedMotionRef.current = mediaQuery.matches
    const handleChange = (event: MediaQueryListEvent) => {
      reducedMotionRef.current = event.matches
    }
    mediaQuery.addEventListener('change', handleChange)

    const handlePointerMove = (event: PointerEvent) => {
      mouseTargetRef.current.set(
        event.clientX / window.innerWidth,
        1 - event.clientY / window.innerHeight
      )
    }
    window.addEventListener('pointermove', handlePointerMove, { passive: true })

    return () => {
      mediaQuery.removeEventListener('change', handleChange)
      window.removeEventListener('pointermove', handlePointerMove)
    }
  }, [])

  useEffect(() => {
    uniformsRef.current.uResolution.value.set(
      size.width * viewport.dpr,
      size.height * viewport.dpr
    )
  }, [size, viewport.dpr])

  useFrame((_state, delta) => {
    const uniforms = uniformsRef.current
    if (!reducedMotionRef.current) {
      uniforms.uTime.value += delta
    }
    uniforms.uMouse.value.lerp(mouseTargetRef.current, 0.03)
  })

  return (
    <ScreenQuad>
      <shaderMaterial
        ref={materialRef}
        args={[
          {
            uniforms: uniformsRef.current,
            vertexShader: VERTEX_SHADER,
            fragmentShader: FRAGMENT_SHADER,
            transparent: true,
            depthTest: false,
            depthWrite: false,
          } satisfies THREE.ShaderMaterialParameters,
        ]}
      />
    </ScreenQuad>
  )
}

/**
 * Bespoke WebGL aurora background — jade -> gold shader ribbons drifting
 * behind the marketing hero. Fixed full-bleed, pointer-events disabled,
 * respects prefers-reduced-motion, and degrades silently on context loss.
 */
export function AuroraField() {
  const containerRef = useRef<HTMLDivElement>(null)

  const handleContextLost = (event: Event) => {
    event.preventDefault()
  }

  const handleContextRestored = () => {
    // no-op: shader state is recreated by r3f on remount, nothing to restore manually
  }

  return (
    <div
      ref={containerRef}
      className="pointer-events-none fixed inset-0 -z-10"
      aria-hidden="true"
    >
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        camera={{ position: [0, 0, 1] }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener('webglcontextlost', handleContextLost, false)
          gl.domElement.addEventListener('webglcontextrestored', handleContextRestored, false)
        }}
      >
        <AuroraMesh />
      </Canvas>
    </div>
  )
}
