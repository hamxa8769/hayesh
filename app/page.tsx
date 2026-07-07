"use client"

import { useEffect, useRef } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { GraduationCap, ShoppingBag, Cpu, ArrowRight, Star, Users, Globe, Zap } from "lucide-react"
import { JarvisButton } from "@/components/ui/jarvis-button"
import { Navbar } from "@/components/layout/Navbar"

function HeroScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let animId: number
    let w = (canvas.width = window.innerWidth)
    let h = (canvas.height = window.innerHeight)

    const particles: { x: number; y: number; vx: number; vy: number; r: number }[] = []
    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        r: Math.random() * 2 + 0.5,
      })
    }

    function draw() {
      if (!ctx) return
      ctx.clearRect(0, 0, w, h)
      particles.forEach((p) => {
        p.x += p.vx
        p.y += p.vy
        if (p.x < 0 || p.x > w) p.vx *= -1
        if (p.y < 0 || p.y > h) p.vy *= -1
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = "rgba(108, 99, 255, 0.4)"
        ctx.fill()
      })
      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 150) {
            ctx.beginPath()
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.strokeStyle = `rgba(108, 99, 255, ${0.15 * (1 - dist / 150)})`
            ctx.stroke()
          }
        }
      }
      animId = requestAnimationFrame(draw)
    }

    draw()
    const onResize = () => { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight }
    window.addEventListener("resize", onResize)
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", onResize) }
  }, [])

  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 -z-10" />
}

const fadeUp = { hidden: { opacity: 0, y: 30 }, visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.6 } }) }

const layers = [
  { icon: GraduationCap, title: "Teacher Profiles", desc: "Structured profiles with monthly subscriptions. Parents book free demos, then subscribe.", color: "text-accent-primary", glow: "glow-violet" },
  { icon: ShoppingBag, title: "Seller Marketplace", desc: "Fiverr-style gigs with Basic/Standard/Premium packages. One-time payments.", color: "text-accent-success", glow: "glow-green" },
  { icon: Cpu, title: "HayeshAI Studio", desc: "AI services powered by Claude. Admin-configured, 100% margin, instant delivery.", color: "text-accent-secondary", glow: "glow-cyan" },
]

const stats = [
  { value: "500+", label: "Teachers" },
  { value: "10K+", label: "Students" },
  { value: "50+", label: "AI Services" },
  { value: "99%", label: "Satisfaction" },
]

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <HeroScene />
      <Navbar />

      {/* Hero */}
      <section className="relative flex min-h-screen items-center justify-center px-6 pt-20">
        <div className="mx-auto max-w-4xl text-center">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8 }}>
            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-accent-primary/30 bg-accent-primary/10 px-4 py-1.5 text-sm text-accent-primary">
              <Zap className="h-4 w-4" /> JARVIS-Powered Platform
            </span>
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.8 }}
            className="mt-6 font-display text-5xl font-bold leading-tight sm:text-7xl">
            <span className="bg-gradient-to-r from-accent-primary via-accent-secondary to-accent-success bg-clip-text text-transparent">
              Learn.
            </span>{" "}
            <span className="text-text-primary">Teach.</span>{" "}
            <span className="bg-gradient-to-r from-accent-secondary to-accent-primary bg-clip-text text-transparent">
              Earn.
            </span>
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.6 }}
            className="mx-auto mt-6 max-w-2xl text-lg text-text-muted">
            The three-layer marketplace where teachers build profiles, sellers offer services,
            and AI delivers instant results — all powered by JARVIS.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.6 }}
            className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link href="/auth/register">
              <JarvisButton variant="primary" size="lg">
                Get Started <ArrowRight className="h-4 w-4" />
              </JarvisButton>
            </Link>
            <Link href="/teachers">
              <JarvisButton variant="secondary" size="lg">
                Browse Teachers
              </JarvisButton>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-border bg-surface/50 py-12">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-8 px-6 sm:gap-16">
          {stats.map((s, i) => (
            <motion.div key={s.label} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
              className="text-center">
              <p className="font-mono text-3xl font-bold text-accent-primary">{s.value}</p>
              <p className="mt-1 text-sm text-text-muted">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Three Layers */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="mb-16 text-center">
            <h2 className="font-display text-3xl font-bold sm:text-4xl">Three Layers. One Platform.</h2>
            <p className="mt-3 text-text-muted">Everything you need to teach, sell, or buy — in one place.</p>
          </motion.div>

          <div className="grid gap-8 md:grid-cols-3">
            {layers.map((layer, i) => (
              <motion.div key={layer.title} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
                className={`glass rounded-2xl p-8 transition-all duration-300 hover:${layer.glow}`}>
                <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-surface-elevated ${layer.color}`}>
                  <layer.icon className="h-7 w-7" />
                </div>
                <h3 className="font-display text-xl font-bold">{layer.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-text-muted">{layer.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust bar */}
      <section className="border-y border-border bg-surface/30 px-6 py-12">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-8 text-text-muted">
          <span className="flex items-center gap-2"><Globe className="h-5 w-5" /> Multilingual Support</span>
          <span className="flex items-center gap-2"><Star className="h-5 w-5 text-accent-warning" /> Verified Teachers</span>
          <span className="flex items-center gap-2"><Users className="h-5 w-5" /> 10K+ Students</span>
          <span className="flex items-center gap-2"><Zap className="h-5 w-5 text-accent-success" /> AI-Powered</span>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-24">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="glass mx-auto max-w-3xl rounded-3xl p-12 text-center glow-violet">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">Ready to Start?</h2>
          <p className="mt-4 text-text-muted">Join thousands of teachers and students on Hayesh.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link href="/auth/register?role=teacher">
              <JarvisButton variant="primary" size="lg">Become a Teacher</JarvisButton>
            </Link>
            <Link href="/auth/register?role=parent">
              <JarvisButton variant="secondary" size="lg">Find a Teacher</JarvisButton>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-surface/50 px-6 py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
          <span className="font-display text-lg font-bold bg-gradient-to-r from-accent-primary to-accent-secondary bg-clip-text text-transparent">
            HAYESH
          </span>
          <p className="text-sm text-text-muted">&copy; 2026 Hayesh. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
