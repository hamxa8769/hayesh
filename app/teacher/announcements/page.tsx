"use client"

import { useCallback, useEffect, useState } from "react"
import { Megaphone } from "lucide-react"
import { Reveal } from "@/components/motion/Reveal"
import { PanelGroup } from "@/components/dashboard/PanelGroup"
import { AnnouncementComposer } from "@/components/teacher/AnnouncementComposer"
import { createClient } from "@/lib/supabase/client"
import { useSupabase } from "@/hooks/useSupabase"
import { cn } from "@/lib/utils/cn"
import { formatDateTime } from "@/lib/utils/format"
import type { AnnouncementRow } from "@/components/teacher/teaching-schema"

export default function AnnouncementsPage() {
  const { user } = useSupabase()
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      // Explicit author_id filter: the "Author manages own announcements"
      // policy also lets an audience='all' row from ANY author through, so
      // without this filter the history list would include other teachers'
      // platform-wide broadcasts, not just this teacher's own.
      const { data, error: queryError } = await supabase
        .from("announcements")
        .select("*")
        .eq("author_id", user.id)
        .order("published_at", { ascending: false })

      if (queryError) throw queryError
      setAnnouncements((data ?? []) as AnnouncementRow[])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load announcements")
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="space-y-6">
      <Reveal>
        <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] text-text-primary">Announcements</h2>
        <p className="mt-1 font-mono text-sm tabular-nums text-text-muted">{announcements.length} published</p>
      </Reveal>

      {user && <AnnouncementComposer authorId={user.id} onCreated={(row) => setAnnouncements((prev) => [row, ...prev])} />}

      {loading ? (
        <p className="text-text-muted">Loading announcements...</p>
      ) : error ? (
        <div className="rounded-lg border border-accent-danger/30 bg-accent-danger/10 p-4 text-sm text-accent-danger">
          {error}
        </div>
      ) : announcements.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-8 text-center">
          <Megaphone className="mx-auto mb-3 h-12 w-12 text-text-disabled" />
          <p className="text-text-muted">No announcements yet. Publish your first one above.</p>
        </div>
      ) : (
        <PanelGroup className="space-y-3">
          {announcements.map((a) => (
            <div
              key={a.id}
              className="rounded-lg border border-border bg-surface p-4 transition-colors hover:border-line-strong sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="font-medium text-text-primary">{a.title}</p>
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 font-mono text-xs font-semibold uppercase tracking-wide",
                    a.audience === "all"
                      ? "border-[#56B6FF]/30 bg-[#56B6FF]/10 text-[#56B6FF]"
                      : "border-line-strong bg-surface-elevated text-text-muted"
                  )}
                >
                  {a.audience === "all" ? "Everyone" : "My students"}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm text-text-muted">{a.body}</p>
              <p className="mt-3 font-mono text-xs tabular-nums text-text-muted">{formatDateTime(a.published_at)}</p>
            </div>
          ))}
        </PanelGroup>
      )}
    </div>
  )
}
