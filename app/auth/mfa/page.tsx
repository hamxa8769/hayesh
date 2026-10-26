"use client"

import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Reveal } from "@/components/motion/Reveal"
import { AuthScene } from "@/components/layout/AuthScene"
import { createClient } from "@/lib/supabase/client"
import { signOutAndReload } from "@/lib/auth/sign-out"
import { safeRedirectPath } from "@/lib/utils/safe-redirect"

function MfaForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const destination = safeRedirectPath(searchParams.get("redirect")) ?? "/admin"
  const [factorId, setFactorId] = useState<string | null>(null)
  const [checking, setChecking] = useState(true)
  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const supabase = createClient()
      const { data, error: listError } = await supabase.auth.mfa.listFactors()
      if (cancelled) return
      if (listError) {
        setError(listError.message)
      } else {
        const factor = data?.totp[0]
        if (factor) {
          setFactorId(factor.id)
        } else {
          // Nothing to verify (signed out, or no factor) — go where they were headed.
          router.replace(destination)
          return
        }
      }
      setChecking(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [router, destination])

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!factorId || code.length !== 6) return
    setLoading(true)
    setError(null)
    const { error: verifyError } = await createClient().auth.mfa.challengeAndVerify({ factorId, code })
    if (verifyError) {
      setError(/invalid|incorrect|expired/i.test(verifyError.message) ? "That code is not correct. Check your authenticator app and try again." : verifyError.message)
      setCode("")
      setLoading(false)
      return
    }
    router.replace(destination)
    router.refresh()
  }

  return (
    <Reveal className="w-full max-w-md">
      <div className="relative overflow-hidden rounded-lg border border-border bg-surface shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_8px_30px_rgba(0,0,0,0.5)]">
        <div className="aurora-bg absolute inset-x-0 top-0 h-[3px]" aria-hidden="true" />
        <div className="p-8 sm:p-10">
          <div className="mb-8 text-center">
            <Link href="/" className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-text-muted transition-colors hover:text-text-primary">
              Hayesh
            </Link>
            <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight text-text-primary">Two-factor verification</h1>
            <p className="mt-2 text-sm text-text-muted">Enter the 6-digit code from your authenticator app</p>
          </div>

          {checking ? (
            <p className="text-center text-sm text-text-muted">Loading...</p>
          ) : (
            <form method="post" onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="mfa-code" className="block font-mono text-xs uppercase tracking-[0.12em] text-text-muted">
                  Authentication code
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
                    <ShieldCheck className="h-4 w-4" />
                  </span>
                  <Input
                    id="mfa-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    placeholder="123456"
                    autoFocus
                    className="pl-10 font-mono tabular-nums tracking-[0.3em]"
                  />
                </div>
              </div>

              {error && (
                <div role="alert" className="rounded border border-accent-danger/30 bg-accent-danger/10 p-3 text-sm text-accent-danger">
                  {error}
                </div>
              )}

              <Button type="submit" variant="aurora" size="lg" disabled={loading || !factorId || code.length !== 6} className="w-full">
                {loading ? "Verifying..." : "Verify"}
              </Button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-text-muted">
            <button type="button" onClick={() => void signOutAndReload()} className="font-medium text-accent-primary hover:text-accent-primary/80">
              Sign out
            </button>
          </p>
        </div>
      </div>
    </Reveal>
  )
}

export default function MfaPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <AuthScene />
      <Suspense fallback={<div className="text-text-muted">Loading...</div>}>
        <MfaForm />
      </Suspense>
    </div>
  )
}
