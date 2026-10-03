import Link from "next/link"
import { PackageSearch } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function GigNotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <PackageSearch className="h-10 w-10 text-text-disabled" strokeWidth={1.5} aria-hidden="true" />
      <h1 className="font-display text-2xl font-semibold text-text-primary">This service isn&apos;t available</h1>
      <p className="text-sm text-text-muted">It may have been removed, or it is still waiting for approval.</p>
      <Button asChild variant="outline">
        <Link href="/marketplace">Browse the marketplace</Link>
      </Button>
    </div>
  )
}
