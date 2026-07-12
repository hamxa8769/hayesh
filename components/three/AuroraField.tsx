'use client'

import { useEffect, useRef, useState } from 'react'
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
  uniform float uIsLight;

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
    vec2 mouseInfluence = (uMouse - vec2(0.5)) * 0.12;

    // flowing ribbon curtains via layered fbm, drifting slowly over time.
    // Sampled across the full aspect-scaled width so the ribbon spans the
    // whole canvas instead of collapsing into one corner on wide viewports.
    vec2 flow = p * vec2(0.85, 1.6) + vec2(uTime * 0.045, -uTime * 0.03) + mouseInfluence;
    float n1 = fbm(flow);
    float n2 = fbm(flow * 1.7 + vec2(4.2, 1.1) - uTime * 0.02);
    float ribbon = fbm(vec2(n1, n2) * 2.0 + uTime * 0.015);

    // primary ribbon band: a gently curving horizontal curtain across the
    // upper hero, its center and width driven by noise so it never reads
    // as a static stripe
    float centerY1 = 0.64 + n1 * 0.16 + mouseInfluence.y * 0.4;
    float bandWidth1 = 0.30 + ribbon * 0.10;
    float vertical1 = smoothstep(bandWidth1, 0.0, abs(uv.y - centerY1));

    // secondary thinner band, layered lower for depth
    float centerY2 = 0.36 + n2 * 0.12;
    float vertical2 = smoothstep(0.20, 0.0, abs(uv.y - centerY2)) * 0.55;

    // horizontal modulation keeps the ribbon full-width but never fully
    // dims to zero, so it always reads across the whole viewport
    float bands = sin((p.x * 0.55 + n1 * 1.3) * 3.0 + uTime * 0.15) * 0.5 + 0.5;
    bands = mix(0.4, 1.0, bands);

    float envelope = clamp(vertical1 + vertical2, 0.0, 1.0);
    float intensity = clamp(bands * envelope, 0.0, 1.0);

    // theme-aware brightness: bold + luminous on obsidian, a soft low-
    // opacity tint on the light "Daylight" ground so it never overwhelms
    float baseIntensity = mix(0.85, 0.30, uIsLight);
    intensity *= baseIntensity;

    vec3 color = mix(cJade, cMid, smoothstep(0.0, 0.55, ribbon));
    color = mix(color, cGold, smoothstep(0.45, 1.0, ribbon));

    vec3 finalColor = color * intensity;
    float alpha = intensity * mix(1.0, 0.75, uIsLight);

    gl_FragColor = vec4(finalColor, alpha);
  }
`

interface AuroraUniforms {
  [key: string]: THREE.IUniform
  uTime: THREE.IUniform<number>
  uResolution: THREE.IUniform<THREE.Vector2>
  uMouse: THREE.IUniform<THREE.Vector2>
  uIsLight: THREE.IUniform<number>
}

function readIsLightTheme(): boolean {
  if (typeof document === 'undefined') return false
  return document.documentElement.dataset.theme === 'light'
}

function createUniforms(): AuroraUniforms {
  return {
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uMouse: { value: new THREE.Vector2(0.5, 0.5) },
    uIsLight: { value: readIsLightTheme() ? 1 : 0 },
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

  // Theme-aware: read data-theme on mount and whenever ThemeProvider flips
  // it, so the aurora relaxes into a soft tint on the light ground instead
  // of the luminous dark-mode treatment. AuroraField takes no props, so
  // this reads document state directly rather than threading a prop.
  useEffect(() => {
    const updateTheme = () => {
      uniformsRef.current.uIsLight.value = readIsLightTheme() ? 1 : 0
    }
    updateTheme()

    const observer = new MutationObserver(updateTheme)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })

    return () => observer.disconnect()
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
 * Theme-aware: luminous in dark mode, a soft low-opacity tint in light mode.
 */
export function AuroraField() {
  const containerRef = useRef<HTMLDivElement>(null)
  // Render the WebGL canvas client-only. During SSR (and the first client
  // render) we output just the empty container so the server and client
  // markup match — a react-three-fiber <Canvas> rendered on the server is a
  // classic source of a production hydration mismatch (React #418).
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const handleContextLost = (event: Event) => {
    event.preventDefault()
  }

  if (!mounted) {
    return <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden="true" />
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
