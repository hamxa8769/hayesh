"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Route error:", error.digest ?? error.message)
  }, [error])

  return (
    <main className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="flex max-w-md flex-col items-center gap-5 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Something went wrong</p>
        <h1 className="text-balance font-display text-2xl font-bold tracking-tight">We couldn&apos;t load this page</h1>
        <p className="text-text-muted">Please try again. If the problem continues, contact support.</p>
        {error.digest && <p className="font-mono text-xs text-text-disabled">Ref: {error.digest}</p>}
        <div className="flex gap-3">
          <Button variant="aurora" onClick={reset}>Try again</Button>
          <Button asChild variant="outline">
            <Link href="/">Go home</Link>
          </Button>
        </div>
      </div>
    </main>
  )
}
