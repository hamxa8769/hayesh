"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, GraduationCap, Loader2, UserCog } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Reveal } from "@/components/motion/Reveal"
import { PanelGroup } from "@/components/dashboard/PanelGroup"
import { useSupabase } from "@/hooks/useSupabase"

export default function ProfilePage() {
  const { user } = useSupabase()
  const [displayName, setDisplayName] = useState("")
  const [tagline, setTagline] = useState("")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)

  useEffect(() => {
    if (!user) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      try {
        const { createClient } = await import("@/lib/supabase/client")
        const supabase = createClient()
        // `.maybeSingle()` (not `.single()`) because a teacher who hasn't
        // finished onboarding legitimately has zero rows here — `.single()`
        // makes PostgREST return a 406 for that case instead of null data.
        const { data } = await supabase
          .from("teachers")
          .select("display_name, tagline")
          .eq("user_id", user.id)
          .maybeSingle()

        if (cancelled) return

        if (!data) {
          setNeedsOnboarding(true)
        } else {
          setDisplayName(data.display_name || "")
          setTagline(data.tagline || "")
        }
      } catch {
        if (!cancelled) setNeedsOnboarding(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [user])

  const save = async () => {
    if (!user) return
    setSaving(true)
    try {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      await supabase.from("teachers").update({ display_name: displayName, tagline }).eq("user_id", user.id)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <Reveal>
        <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] text-text-primary">Edit Profile</h2>
      </Reveal>

      {loading ? (
        <div className="flex min-h-[20vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-accent-primary" />
        </div>
      ) : needsOnboarding ? (
        <div className="relative overflow-hidden rounded-lg border border-border bg-surface p-8">
          <span aria-hidden="true" className="aurora-bg absolute inset-x-0 top-0 h-[2px]" />
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-line-strong bg-surface-2">
                <GraduationCap className="h-6 w-6 text-accent-primary" />
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold tracking-[-0.02em] text-text-primary">
                  Complete your teacher profile
                </h3>
                <p className="mt-1 max-w-md text-sm text-text-muted">
                  You haven&apos;t finished onboarding yet, so there&apos;s no profile to edit. Finish onboarding to
                  add your education, subjects, and pricing first.
                </p>
              </div>
            </div>
            <Link href="/teacher/onboarding" className="shrink-0">
              <Button variant="aurora">
                Start Onboarding <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <PanelGroup title="Public Details" className="max-w-lg">
          <div className="space-y-4 rounded-lg border border-border bg-surface p-6">
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm font-medium text-text-primary">
                <UserCog className="h-4 w-4 text-accent-primary" /> Display Name
              </label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">Tagline</label>
              <Input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="e.g. Physics PhD | 10+ years" />
            </div>

            <Button variant="aurora" onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saved ? "Saved!" : "Save Changes"}
            </Button>
          </div>
        </PanelGroup>
      )}
    </div>
  )
}
