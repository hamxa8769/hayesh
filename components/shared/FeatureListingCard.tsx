"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSupabase } from "@/hooks/useSupabase"
import { createClient } from "@/lib/supabase/client"
import { formatDate, formatPKR } from "@/lib/utils/format"

export interface FeatureListingCardProps {
  role: "teacher" | "seller"
}

type FeatureDays = 7 | 30

interface FeatureState {
  approved: boolean
  featuredUntil: string | null
  prices: Record<FeatureDays, number | null>
}

function toPrice(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN
  return Number.isFinite(n) && n >= 0 ? n : null
}

export function FeatureListingCard({ role }: FeatureListingCardProps) {
  const router = useRouter()
  const { user } = useSupabase()
  const [state, setState] = useState<FeatureState | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [busy, setBusy] = useState<FeatureDays | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setLoadError(false)
      try {
        const supabase = createClient()
        const table = role === "teacher" ? "teachers" : "sellers"
        const [rowRes, settingsRes] = await Promise.all([
          supabase.from(table).select("status, featured, featured_until").eq("user_id", user.id).maybeSingle(),
          supabase.from("platform_settings").select("key, value").in("key", ["featured_7d_price_pkr", "featured_30d_price_pkr"]),
        ])
        if (cancelled) return
        if (rowRes.error || settingsRes.error) {
          setLoadError(true)
          return
        }
        const row = rowRes.data as { status: string | null; featured: boolean | null; featured_until: string | null } | null
        const byKey = new Map(((settingsRes.data ?? []) as Array<{ key: string; value: unknown }>).map((s) => [s.key, s.value]))
        const until = row?.featured && row.featured_until && new Date(row.featured_until).getTime() > Date.now() ? row.featured_until : null
        setState({
          approved: row?.status === "approved",
          featuredUntil: until,
          prices: { 7: toPrice(byKey.get("featured_7d_price_pkr")), 30: toPrice(byKey.get("featured_30d_price_pkr")) },
        })
      } catch {
        if (!cancelled) setLoadError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [user, role])

  if (loading) return <div className="h-24 animate-pulse rounded-lg border border-border bg-surface" aria-busy="true" />
  if (loadError) return null
  if (!state || !state.approved) return null

  const buy = async (days: FeatureDays) => {
    if (busy) return
    setBusy(days)
    setError(null)
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "featured", days }),
      })
      const json = (await res.json().catch(() => null)) as { transaction_id?: string; error?: string } | null
      if (!res.ok || !json?.transaction_id) {
        setError(json?.error || "We couldn't start the payment. Please try again.")
        setBusy(null)
        return
      }
      router.push(`/checkout/${json.transaction_id}`)
    } catch {
      setError("Network error. Please try again.")
      setBusy(null)
    }
  }

  const options: FeatureDays[] = [7, 30]

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-accent-primary" aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-display font-semibold text-text-primary">Get featured</p>
          <p className="mt-1 text-sm text-text-muted">
            {state.featuredUntil ? (
              <>
                You&apos;re featured until{" "}
                <span className="font-mono tabular-nums text-text-primary">{formatDate(state.featuredUntil)}</span>. Buy more time to extend.
              </>
            ) : (
              "Featured listings appear first in search results and carry a Featured badge."
            )}
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {options.map((days) => {
          const price = state.prices[days]
          return (
            <div key={days} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-elevated p-3">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">{days} days</p>
                <p className="font-mono text-lg font-semibold tabular-nums text-text-primary">{price != null ? formatPKR(price) : "—"}</p>
              </div>
              <Button variant="aurora" size="sm" onClick={() => buy(days)} disabled={busy !== null || price == null}>
                {busy === days && <Loader2 className="h-4 w-4 animate-spin" />}
                Get featured
              </Button>
            </div>
          )
        })}
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-accent-danger">
          {error}
        </p>
      )}
    </div>
  )
}
