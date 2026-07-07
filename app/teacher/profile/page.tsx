"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { UserCog } from "lucide-react"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { JarvisInput } from "@/components/ui/jarvis-input"
import { JarvisButton } from "@/components/ui/jarvis-button"
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
      if (data) { setDisplayName(data.display_name || ""); setTagline(data.tagline || "") }
    }
    load()
  }, [user])

  const save = async () => {
    if (!user) return
    setSaving(true)
    const { createClient } = await import("@/lib/supabase/client")
    const supabase = createClient()
    await supabase.from("teachers").update({ display_name: displayName, tagline }).eq("user_id", user.id)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="font-display text-2xl font-bold">Edit Profile</h2>
      </motion.div>

      <JarvisCard glow="none" className="p-6 max-w-lg">
        <div className="space-y-4">
          <JarvisInput label="Display Name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} icon={<UserCog className="h-4 w-4" />} />
          <JarvisInput label="Tagline" value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="e.g. Physics PhD | 10+ years" />
          <JarvisButton variant="primary" onClick={save} loading={saving}>
            {saved ? "Saved!" : "Save Changes"}
          </JarvisButton>
        </div>
      </JarvisCard>
    </div>
  )
}
