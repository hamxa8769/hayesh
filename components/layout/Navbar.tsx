"use client"

import { useState } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { Menu, X } from "lucide-react"
import { JarvisButton } from "@/components/ui/jarvis-button"

const links = [
  { href: "/teachers", label: "Teachers" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/ai-services", label: "AI Services" },
]

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <nav className="glass-strong fixed top-0 z-50 w-full">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="font-display text-xl font-bold bg-gradient-to-r from-accent-primary to-accent-secondary bg-clip-text text-transparent">
          HAYESH
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-sm text-text-muted transition-colors hover:text-text-primary">
              {l.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <Link href="/auth/login">
            <JarvisButton variant="secondary" size="sm">Sign In</JarvisButton>
          </Link>
          <Link href="/auth/register">
            <JarvisButton variant="primary" size="sm">Get Started</JarvisButton>
          </Link>
        </div>

        <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden text-text-muted">
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
            className="overflow-hidden border-t border-border md:hidden">
            <div className="space-y-2 px-6 py-4">
              {links.map((l) => (
                <Link key={l.href} href={l.href} onClick={() => setMobileOpen(false)}
                  className="block py-2 text-sm text-text-muted hover:text-text-primary">{l.label}</Link>
              ))}
              <div className="flex gap-3 pt-2">
                <Link href="/auth/login" onClick={() => setMobileOpen(false)}>
                  <JarvisButton variant="secondary" size="sm" className="w-full">Sign In</JarvisButton>
                </Link>
                <Link href="/auth/register" onClick={() => setMobileOpen(false)}>
                  <JarvisButton variant="primary" size="sm" className="w-full">Get Started</JarvisButton>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  )
}
