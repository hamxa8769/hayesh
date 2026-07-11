"use client"

import { useEffect, useState } from "react"
import { Loader2, UserCog } from "lucide-react"
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

  useEffect(() => {
    if (!user) return
    const load = async () => {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const { data } = await supabase.from("teachers").select("display_name, tagline").eq("user_id", user.id).single()
      if (data) {
        setDisplayName(data.display_name || "")
        setTagline(data.tagline || "")
      }
    }
    load()
  }, [user])

  const save = async () => {
    if (!user) return
    setSaving(true)
    const { createClient } = await import("@/lib/supabase/client")
    const supabase = createClient()
    await supabase.from("teachers").update({ display_name: displayName, tagline }).eq("user_id", user.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-6">
      <Reveal>
        <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] text-text-primary">Edit Profile</h2>
      </Reveal>

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
    </div>
  )
}
