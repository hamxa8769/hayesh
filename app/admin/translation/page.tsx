"use client"

import { useEffect, useState } from "react"
import { Languages } from "lucide-react"
import { cn } from "@/lib/utils/cn"
import { PanelGroup } from "@/components/dashboard/PanelGroup"
import { Reveal } from "@/components/motion/Reveal"
import type { Teacher } from "@/types/database"

interface TranslationSwitchProps {
  enabled: boolean
  onToggle: () => void
}

function TranslationSwitch({ enabled, onToggle }: TranslationSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={onToggle}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full border transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/50",
        enabled ? "border-accent-primary/50 bg-accent-primary/25" : "border-border bg-surface-elevated"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-0.5 h-4 w-4 rounded-full transition-all duration-200",
          enabled ? "left-[22px] bg-accent-primary shadow-[0_0_10px_rgba(39,196,160,0.6)]" : "left-0.5 bg-text-disabled"
        )}
      />
    </button>
  )
}

export default function TranslationPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const { createClient } = await import("@/lib/supabase/client")
    const supabase = createClient()
    const { data } = await supabase.from("teachers").select("*").order("created_at", { ascending: false })
    setTeachers((data || []) as Teacher[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const toggle = async (id: string, current: boolean) => {
    const { createClient } = await import("@/lib/supabase/client")
    const supabase = createClient()
    await supabase.from("teachers").update({ translation_enabled: !current }).eq("id", id)
    load()
  }

  return (
    <div className="space-y-8">
      <Reveal>
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Admin / Translation</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-text-primary sm:text-3xl">Translation Privileges</h1>
      </Reveal>

      {loading ? (
        <p className="font-mono text-sm text-text-muted">Loading…</p>
      ) : teachers.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-12 text-center">
          <Languages className="mx-auto h-10 w-10 text-text-disabled" />
          <p className="mt-3 text-sm text-text-muted">No teachers yet</p>
        </div>
      ) : (
        <PanelGroup>
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            {teachers.map((t) => {
              const langs = (t.translation_languages || []) as string[]
              const enabled = !!t.translation_enabled
              return (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-4 border-b border-border px-4 py-4 transition-colors last:border-b-0 hover:bg-surface-elevated"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text-primary">{t.display_name || "Unnamed"}</p>
                    <p className="font-mono text-xs text-text-muted">{langs.length > 0 ? langs.join(", ") : "No languages set"}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className={cn("font-mono text-xs uppercase tracking-[0.1em]", enabled ? "text-accent-primary" : "text-text-muted")}>
                      {enabled ? "Enabled" : "Disabled"}
                    </span>
                    <TranslationSwitch enabled={enabled} onToggle={() => toggle(t.id, enabled)} />
                  </div>
                </div>
              )
            })}
          </div>
        </PanelGroup>
      )}
    </div>
  )
}
