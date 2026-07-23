"use client"

import { createContext, useContext, type ReactNode } from "react"
import type { BrandingConfig } from "@/lib/branding"

/**
 * Exposes branding VALUES (logo url, disclaimer copy, AI package copy,
 * brand name) to client components that need to render them. Colors,
 * font, and scrollbar are NOT read from here — they are applied purely
 * via the CSS variable overrides injected server-side in app/layout.tsx,
 * so every page (including SSR) is themed with no client JS and no flash.
 */

const BrandingContext = createContext<BrandingConfig | undefined>(undefined)

interface BrandingProviderProps {
  branding: BrandingConfig
  children: ReactNode
}

export function BrandingProvider({ branding, children }: BrandingProviderProps) {
  return <BrandingContext.Provider value={branding}>{children}</BrandingContext.Provider>
}

export function useBranding(): BrandingConfig {
  const context = useContext(BrandingContext)
  if (!context) {
    throw new Error("useBranding must be used within a BrandingProvider")
  }
  return context
}
