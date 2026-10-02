"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSupabase } from "@/hooks/useSupabase"
import { createClient } from "@/lib/supabase/client"
import { formatPKR } from "@/lib/utils/format"

export interface RegistrationFeeCardProps {
  role: "teacher" | "seller"
}

interface FeeState {
  fee: number | null
}

export function RegistrationFeeCard({ role }: RegistrationFeeCardProps) {
  const router = useRouter()
  const { user } = useSupabase()
  const [state, setState] = useState<FeeState | null>(null)
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false

    const load = async () => {
      try {
        const supabase = createClient()
        const table = role === "teacher" ? "teachers" : "sellers"
        const key = role === "teacher" ? "teacher_registration_fee_pkr" : "seller_registration_fee_pkr"
        const [rowRes, settingRes] = await Promise.all([
          supabase.from(table).select("registration_fee_paid").eq("user_id", user.id).maybeSingle(),
          supabase.from("platform_settings").select("value").eq("key", key).maybeSingle(),
        ])
        if (cancelled) return
        const row = rowRes.data as { registration_fee_paid: boolean | null } | null
        if (!row || row.registration_fee_paid) {
          setState(null)
          return
        }
        const raw = (settingRes.data as { value: string | number | boolean | null } | null)?.value
        const parsed = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN
        setState({ fee: Number.isFinite(parsed) ? parsed : null })
      } catch {
        if (!cancelled) setState(null)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [user, role])

  if (!state) return null

  const pay = async () => {
    if (paying) return
    setPaying(true)
    setError(null)
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "registration" }),
      })
      const json = (await res.json().catch(() => null)) as { transaction_id?: string; error?: string } | null
      if (!res.ok || !json?.transaction_id) {
        setError(json?.error || "We couldn't start the payment. Please try again.")
        setPaying(false)
        return
      }
      router.push(`/checkout/${json.transaction_id}`)
    } catch {
      setError("Network error. Please try again.")
      setPaying(false)
    }
  }

  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-surface p-5">
      <span aria-hidden="true" className="aurora-bg absolute inset-x-0 top-0 h-[2px]" />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent-primary" />
          <div>
            <p className="font-display font-semibold text-text-primary">Activate your profile</p>
            <p className="mt-1 text-sm text-text-muted">
              One-time registration fee{" "}
              {state.fee != null ? (
                <span className="font-mono tabular-nums text-text-primary">{formatPKR(state.fee)}</span>
              ) : null}
              {state.fee == null ? "set by Hayesh" : ""}. Your profile goes live after payment is confirmed.
            </p>
            {error && (
              <p role="alert" className="mt-2 text-sm text-accent-danger">
                {error}
              </p>
            )}
          </div>
        </div>
        <Button variant="aurora" size="sm" className="shrink-0" onClick={pay} disabled={paying}>
          {paying && <Loader2 className="h-4 w-4 animate-spin" />}
          Pay now
        </Button>
      </div>
    </div>
  )
}
