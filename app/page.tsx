"use client"

import Link from "next/link"
import { GraduationCap, ShoppingBag, Cpu, Shield, Globe, Zap } from "lucide-react"
import { motion } from "framer-motion"
import { JarvisButton } from "@/components/ui/jarvis-button"
import { JarvisCard } from "@/components/ui/jarvis-card"

const features = [
  {
    icon: GraduationCap,
    title: "Expert Teachers",
    description: "Connect with vetted tutors for personalized learning. Monthly subscriptions with live video sessions.",
    color: "violet" as const,
  },
  {
    icon: ShoppingBag,
    title: "Seller Marketplace",
    description: "Hire talented freelancers for design, video, writing, and more. Basic, Standard, and Premium packages.",
    color: "cyan" as const,
  },
  {
    icon: Cpu,
    title: "AI Services",
    description: "Instant AI-powered delivery — content, code, documents. Powered by HayeshAI Studio.",
    color: "green" as const,
  },
]

const stats = [
  { value: "500+", label: "Teachers" },
  { value: "10K+", label: "Students" },
  { value: "2K+", label: "Freelancers" },
  { value: "50+", label: "AI Tools" },
]

export default function Home() {
  return (
    <div className="relative min-h-screen">
      {/* Hero */}
      <section className="relative flex min-h-screen flex-col items-center justify-center px-6 pt-24 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-4xl"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-accent-primary/30 bg-accent-primary/10 px-4 py-1.5 text-sm text-accent-primary"
          >
            <Zap className="h-3.5 w-3.5" />
            Learn. Hire. Create. — All in one platform.
          </motion.div>

          <h1 className="font-display text-5xl font-bold leading-tight tracking-tight sm:text-7xl lg:text-8xl">
            <span className="bg-gradient-to-r from-accent-primary via-accent-secondary to-accent-success bg-clip-text text-transparent drop-shadow-[0_0_40px_rgba(108,99,255,0.3)]">
              The Future of
            </span>
            <br />
            <span className="text-text-primary">Learning & Hiring</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-text-muted sm:text-xl">
            Hayesh connects parents with expert teachers, buyers with talented freelancers, 
            and everyone with AI-powered services — one platform, three layers of value.
          </p>

          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/auth/register">
              <JarvisButton variant="primary" size="xl" glow>
                Get Started Free
              </JarvisButton>
            </Link>
            <Link href="/teachers">
              <JarvisButton variant="secondary" size="xl">
                Browse Teachers
              </JarvisButton>
            </Link>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="mt-20 grid grid-cols-2 gap-6 sm:grid-cols-4"
        >
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="font-mono text-3xl font-bold text-accent-primary">{stat.value}</div>
              <div className="mt-1 text-sm text-text-muted">{stat.label}</div>
            </div>
          ))}
        </motion.div>
      </section>

      {/* Features */}
      <section className="relative px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="font-display text-3xl font-bold text-text-primary sm:text-4xl">
              Three Layers. One Platform.
            </h2>
            <p className="mt-4 text-text-muted max-w-2xl mx-auto">
              Whether you&apos;re a parent seeking tutors, a freelancer finding clients, or looking for instant AI services — Hayesh has you covered.
            </p>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-3">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.5 }}
              >
                <JarvisCard glow={feature.color} className="p-6 h-full">
                  <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-accent-${feature.color === "violet" ? "primary" : feature.color === "cyan" ? "secondary" : "success"}/10`}>
                    <feature.icon className={`h-6 w-6 text-accent-${feature.color === "violet" ? "primary" : feature.color === "cyan" ? "secondary" : "success"}`} />
                  </div>
                  <h3 className="font-display text-xl font-semibold text-text-primary">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm text-text-muted">
                    {feature.description}
                  </p>
                </JarvisCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Bar */}
      <section className="border-y border-border bg-surface/40 px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            {[
              { icon: Shield, title: "Secure Payments", desc: "Stripe + Simpaisa with buyer protection" },
              { icon: Globe, title: "Multilingual", desc: "AI-powered real-time translation" },
              { icon: Zap, title: "Instant AI Delivery", desc: "HayeshAI Studio fulfills orders in seconds" },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-3">
                <item.icon className="mt-0.5 h-5 w-5 text-accent-primary shrink-0" />
                <div>
                  <p className="font-medium text-text-primary">{item.title}</p>
                  <p className="text-sm text-text-muted">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mx-auto max-w-3xl text-center"
        >
          <h2 className="font-display text-3xl font-bold text-text-primary sm:text-4xl">
            Ready to Get Started?
          </h2>
          <p className="mt-4 text-text-muted">
            Join thousands of parents, teachers, and freelancers on Hayesh.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/auth/register">
              <JarvisButton variant="primary" size="xl" glow>
                Create Free Account
              </JarvisButton>
            </Link>
            <Link href="/auth/login">
              <JarvisButton variant="ghost" size="xl">
                Sign In
              </JarvisButton>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-surface/40 px-6 py-12">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <span className="font-display text-lg font-bold bg-gradient-to-r from-accent-primary to-accent-secondary bg-clip-text text-transparent">
              HAYESH
            </span>
            <div className="flex gap-6 text-sm text-text-muted">
              <Link href="/teachers" className="hover:text-text-primary transition-colors">Teachers</Link>
              <Link href="/marketplace" className="hover:text-text-primary transition-colors">Marketplace</Link>
              <Link href="/ai-services" className="hover:text-text-primary transition-colors">AI Services</Link>
            </div>
            <p className="text-xs text-text-disabled">© 2026 Hayesh. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
