import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="flex max-w-md flex-col items-center gap-5 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Error 404</p>
        <h1 className="text-balance font-display text-3xl font-bold tracking-tight">This page doesn&apos;t exist</h1>
        <p className="text-text-muted">The link may be broken, or the page may have moved.</p>
        <div className="flex gap-3">
          <Button asChild variant="aurora">
            <Link href="/">Go home</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/explore">Explore</Link>
          </Button>
        </div>
      </div>
    </main>
  )
}
