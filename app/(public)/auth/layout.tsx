"use client"

import { type ReactNode } from "react"
import Link from "next/link"
import { AuthScene } from "@/components/layout/AuthScene"
import { JarvisText } from "@/components/ui/jarvis-text"

interface AuthLayoutProps {
  children: ReactNode
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-4 py-10">
      <AuthScene />

      <div className="relative z-10 flex w-full max-w-md flex-col items-center">
        <Link href="/" className="mb-8 flex flex-col items-center gap-2 group">
          <h1 className="font-display text-4xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-accent-primary to-accent-secondary bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(108,99,255,0.5)] group-hover:drop-shadow-[0_0_30px_rgba(108,99,255,0.7)] transition-all duration-500">
              HAYESH
            </span>
          </h1>
          <JarvisText
            text="Learn. Hire. Create."
            className="text-sm text-text-muted"
            speed={50}
            delay={800}
            cursor={false}
          />
        </Link>

        {children}
      </div>
    </div>
  )
}
