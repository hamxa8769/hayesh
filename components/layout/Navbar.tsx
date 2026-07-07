"use client"

import { useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Menu, X, GraduationCap, ShoppingBag, Cpu } from "lucide-react"
import { JarvisButton } from "@/components/ui/jarvis-button"

const navLinks = [
  { href: "/teachers", label: "Find Teachers", icon: GraduationCap },
  { href: "/marketplace", label: "Marketplace", icon: ShoppingBag },
  { href: "/ai-services", label: "AI Services", icon: Cpu },
]

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-surface/60 backdrop-blur-xl"
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="font-display text-xl font-bold bg-gradient-to-r from-accent-primary to-accent-secondary bg-clip-text text-transparent">
            HAYESH
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors"
            >
              <link.icon className="h-4 w-4" />
              {link.label}
            </Link>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Link href="/auth/login">
            <JarvisButton variant="ghost" size="sm">
              Sign In
            </JarvisButton>
          </Link>
          <Link href="/auth/register">
            <JarvisButton variant="primary" size="sm">
              Get Started
            </JarvisButton>
          </Link>
        </div>

        <button
          className="md:hidden text-text-muted"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="md:hidden border-t border-border bg-surface/90 backdrop-blur-xl"
        >
          <div className="flex flex-col p-4 gap-3">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-2 text-sm text-text-muted hover:text-text-primary p-2"
                onClick={() => setMobileOpen(false)}
              >
                <link.icon className="h-4 w-4" />
                {link.label}
              </Link>
            ))}
            <div className="flex gap-2 mt-2">
              <Link href="/auth/login" className="flex-1">
                <JarvisButton variant="ghost" size="sm" className="w-full">
                  Sign In
                </JarvisButton>
              </Link>
              <Link href="/auth/register" className="flex-1">
                <JarvisButton variant="primary" size="sm" className="w-full">
                  Get Started
                </JarvisButton>
              </Link>
            </div>
          </div>
        </motion.div>
      )}
    </motion.header>
  )
}
