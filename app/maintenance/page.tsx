import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Back soon | Hayesh",
  description: "Hayesh is undergoing scheduled maintenance.",
  robots: { index: false, follow: false },
}

export default function MaintenancePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-md text-center">
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Scheduled maintenance</p>
        <h1 className="mt-4 text-balance font-display text-4xl font-bold tracking-tight">We&apos;ll be right back</h1>
        <p className="mt-4 leading-relaxed text-text-muted">
          Hayesh is being updated. Your lessons, orders and payments are safe. Please check back in a little while.
        </p>
      </div>
    </main>
  )
}
