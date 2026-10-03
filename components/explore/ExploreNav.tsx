"use client"

import { createContext, useCallback, useContext, useMemo, type AnchorHTMLAttributes, type ReactNode } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { parseParams, serializeParams, type ExploreParams } from "./explore-data"

interface ExploreNavValue {
  params: ExploreParams
  /** Merge a patch into the URL state without a server round-trip. */
  update: (patch: Partial<ExploreParams>, mode?: "push" | "replace") => void
  hrefFor: (patch: Partial<ExploreParams>) => string
}

const ExploreNavContext = createContext<ExploreNavValue | null>(null)

/**
 * All filter state lives in the URL. We write it with the native History API
 * (which Next syncs into useSearchParams) so changing a filter never refetches
 * the server component or flashes the route's loading skeleton.
 */
export function ExploreNavProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const params = useMemo(() => parseParams(searchParams), [searchParams])

  const hrefFor = useCallback(
    (patch: Partial<ExploreParams>) => `${pathname}${serializeParams({ ...params, ...patch })}`,
    [params, pathname],
  )

  const update = useCallback(
    (patch: Partial<ExploreParams>, mode: "push" | "replace" = "push") => {
      const next = hrefFor(patch)
      if (next === `${pathname}${serializeParams(params)}`) return
      if (mode === "replace") window.history.replaceState(null, "", next)
      else window.history.pushState(null, "", next)
    },
    [hrefFor, params, pathname],
  )

  const value = useMemo(() => ({ params, update, hrefFor }), [params, update, hrefFor])
  return <ExploreNavContext.Provider value={value}>{children}</ExploreNavContext.Provider>
}

export function useExploreNav(): ExploreNavValue {
  const ctx = useContext(ExploreNavContext)
  if (!ctx) throw new Error("useExploreNav must be used inside ExploreNavProvider")
  return ctx
}

interface SoftLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "onClick"> {
  patch: Partial<ExploreParams>
  /** Reset every filter before applying the patch. */
  fresh?: boolean
  children: ReactNode
}

/** An anchor that updates explore state in place; modified clicks open normally. */
export function SoftLink({ patch, fresh = false, children, ...rest }: SoftLinkProps) {
  const { update, hrefFor } = useExploreNav()
  const resolved: Partial<ExploreParams> = fresh
    ? { q: "", type: "all", category: "", min: null, max: null, rating: 0, sort: "recommended", ...patch }
    : patch
  return (
    <a
      {...rest}
      href={hrefFor(resolved)}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
        e.preventDefault()
        update(resolved)
        window.scrollTo({ top: 0, behavior: "smooth" })
      }}
    >
      {children}
    </a>
  )
}
