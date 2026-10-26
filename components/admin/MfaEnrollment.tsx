"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, ShieldCheck, ShieldOff } from "lucide-react"
import type { Factor } from "@supabase/supabase-js"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"
import { formatDate } from "@/lib/utils/format"

interface Pending {
  factorId: string
  qrCode: string
  secret: string
}

/** Status, enrol and remove UI for the signed-in admin's TOTP factors. */
export function MfaEnrollment() {
  const [verified, setVerified] = useState<Factor[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const { data, error: listError } = await createClient().auth.mfa.listFactors()
    if (listError || !data) {
      setLoadError(listError?.message ?? "Could not load your two-factor status.")
      return
    }
    setLoadError(null)
    setVerified(data.totp)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const startEnrollment = async () => {
    setBusy(true)
    setError(null)
    setNotice(null)
    const supabase = createClient()
    // Abandoned enrolments leave unverified factors that block a fresh enrol.
    const { data: existing } = await supabase.auth.mfa.listFactors()
    for (const f of existing?.all ?? []) {
      if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id })
    }
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Hayesh admin" })
    setBusy(false)
    if (enrollError || !data) {
      setError(enrollError?.message ?? "Could not start enrolment.")
      return
    }
    setCode("")
    setPending({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret })
  }

  const activate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!pending) return
    setBusy(true)
    setError(null)
    const { error: verifyError } = await createClient().auth.mfa.challengeAndVerify({ factorId: pending.factorId, code })
    setBusy(false)
    if (verifyError) {
      setError(/invalid|incorrect|expired/i.test(verifyError.message) ? "That code is not correct. Check your authenticator app and try again." : verifyError.message)
      setCode("")
      return
    }
    setPending(null)
    setNotice("Two-factor authentication is now active on your account.")
    await refresh()
  }

  const cancel = async () => {
    if (pending) await createClient().auth.mfa.unenroll({ factorId: pending.factorId })
    setPending(null)
    setError(null)
  }

  const remove = async (factorId: string) => {
    if (!window.confirm("Remove this authenticator? Your account will be less protected.")) return
    setBusy(true)
    setError(null)
    setNotice(null)
    const { error: removeError } = await createClient().auth.mfa.unenroll({ factorId })
    setBusy(false)
    if (removeError) {
      setError(
        /aal2|assurance|verif/i.test(removeError.message)
          ? "Removing a factor needs a session verified with your authenticator code. Sign out, sign in again and enter your code, then retry."
          : removeError.message
      )
      return
    }
    setNotice("Authenticator removed.")
    await refresh()
  }

  if (verified === null && !loadError) {
    return (
      <p className="flex items-center gap-2 text-sm text-text-muted">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading...
      </p>
    )
  }
  if (loadError) {
    return <div role="alert" className="rounded border border-accent-danger/30 bg-accent-danger/10 p-3 text-sm text-accent-danger">{loadError}</div>
  }

  const active = (verified ?? []).length > 0

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {active ? <ShieldCheck className="h-5 w-5 text-accent-success" aria-hidden="true" /> : <ShieldOff className="h-5 w-5 text-accent-warning" aria-hidden="true" />}
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Status</p>
              <p className="text-sm font-medium text-text-primary">{active ? "Two-factor authentication is on" : "Two-factor authentication is off"}</p>
            </div>
          </div>
          <Badge variant={active ? "success" : "warning"}>{active ? "Protected" : "Not set up"}</Badge>
        </div>

        {notice && <p role="status" className="mt-4 text-sm text-accent-success">{notice}</p>}
        {error && <p role="alert" className="mt-4 rounded border border-accent-danger/30 bg-accent-danger/10 p-3 text-sm text-accent-danger">{error}</p>}

        {!active && !pending && (
          <Button type="button" variant="aurora" className="mt-5" disabled={busy} onClick={() => void startEnrollment()}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Set up authenticator app
          </Button>
        )}
      </section>

      {pending && (
        <section className="space-y-4 rounded-lg border border-border bg-surface p-5">
          <p className="text-sm text-text-muted">
            Scan this QR code with an authenticator app (Google Authenticator, 1Password, Authy), or enter the secret manually. Then type the 6-digit code to activate.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            {/* qr_code is an SVG data URL generated by Supabase Auth */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pending.qrCode} alt="Authenticator QR code" className="h-44 w-44 rounded bg-white p-2" />
            <div className="min-w-0">
              <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Secret key</p>
              <p data-testid="mfa-secret" className="mt-1 break-all font-mono text-sm tabular-nums text-text-primary">{pending.secret}</p>
            </div>
          </div>
          <form onSubmit={activate} className="space-y-3">
            <label htmlFor="mfa-enroll-code" className="block font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Authentication code</label>
            <Input
              id="mfa-enroll-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              className="max-w-[12rem] font-mono tabular-nums tracking-[0.3em]"
            />
            <div className="flex gap-2">
              <Button type="submit" variant="aurora" disabled={busy || code.length !== 6}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} Activate
              </Button>
              <Button type="button" variant="ghost" disabled={busy} onClick={() => void cancel()}>Cancel</Button>
            </div>
          </form>
        </section>
      )}

      {active && (
        <section className="rounded-lg border border-border bg-surface">
          <p className="border-b border-border px-5 py-3 font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Authenticators</p>
          <ul className="divide-y divide-border">
            {(verified ?? []).map((f) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text-primary">{f.friendly_name || "Authenticator app"}</p>
                  <p className="font-mono text-xs text-text-muted">Added {formatDate(f.created_at)}</p>
                </div>
                <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void remove(f.id)}>Remove</Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-lg border border-border bg-surface p-5 text-sm text-text-muted">
        <p className="font-mono text-xs uppercase tracking-[0.12em]">Lost your phone?</p>
        <p className="mt-2">
          Another admin or the project owner can remove your authenticator in the Supabase Dashboard under Authentication, Users, your user, MFA factors. You can then sign in with your password and set up a new one.
        </p>
      </section>
    </div>
  )
}
