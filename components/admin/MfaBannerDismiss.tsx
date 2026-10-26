"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ShieldAlert, X } from "lucide-react"

const STORAGE_KEY = "hayesh.mfa-banner-dismissed"

/** Client half of MfaBanner: the dismiss button and the (remembered) hidden state. */
export function MfaBannerDismiss() {
  const pathname = usePathname()
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(STORAGE_KEY) === "1")
    } catch {
      setDismissed(false)
    }
  }, [])

  if (dismissed || pathname.startsWith("/admin/security")) return null

  const dismiss = () => {
    setDismissed(true)
    try {
      sessionStorage.setItem(STORAGE_KEY, "1")
    } catch {
      // storage unavailable — dismissal lasts until reload
    }
  }

  return (
    <div role="status" className="flex items-center gap-3 border-b border-accent-warning/30 bg-accent-warning/10 px-4 py-2.5 text-sm">
      <ShieldAlert className="h-4 w-4 shrink-0 text-accent-warning" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-text-primary">
        Protect your admin account — set up two-factor authentication.{" "}
        <Link href="/admin/security" className="font-medium text-accent-warning underline underline-offset-2">
          Set up now
        </Link>
      </p>
      <button type="button" onClick={dismiss} aria-label="Dismiss" className="shrink-0 text-text-muted transition-colors hover:text-text-primary">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
