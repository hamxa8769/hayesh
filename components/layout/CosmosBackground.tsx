"use client";

import { useMemo, useCallback } from "react";
import type { Engine, ISourceOptions } from "@tsparticles/engine";
import { loadSlim } from "@tsparticles/slim";
import { Particles, ParticlesProvider } from "@tsparticles/react";

const PARTICLE_COUNT = 70;

function CosmosParticles() {
  const options = useMemo<ISourceOptions>(
    () => ({
      fullScreen: { enable: false },
      background: { color: { value: "transparent" } },
      fpsLimit: 60,
      detectRetina: true,
      particles: {
        number: {
          value: PARTICLE_COUNT,
          density: { enable: true, width: 1920, height: 1080 },
        },
        color: {
          value: ["#27C4A0", "#F5B84E", "#E8EAF0"],
        },
        opacity: {
          value: { min: 0.1, max: 0.6 },
          animation: {
            enable: true,
            speed: 0.5,
            sync: false,
            startValue: "random",
          },
        },
        size: {
          value: { min: 0.5, max: 2 },
        },
        move: {
          enable: true,
          speed: 0.3,
          direction: "none",
          random: true,
          straight: false,
          outModes: { default: "out" },
        },
        links: { enable: false },
      },
      interactivity: {
        events: { onHover: { enable: false }, onClick: { enable: false } },
      },
    }),
    [],
  );

  return (
    <Particles
      id="cosmos-background"
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full"
      options={options}
    />
  );
}

export function CosmosBackground() {
  const initEngine = useCallback(async (engine: Engine) => {
    // decorative layer — degrade silently if the engine fails to load
    await loadSlim(engine).catch(() => {});
  }, []);

  return (
    <ParticlesProvider init={initEngine}>
      <CosmosParticles />
    </ParticlesProvider>
  );
}
