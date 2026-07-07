"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { UserCog, Save } from "lucide-react"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { JarvisInput } from "@/components/ui/jarvis-input"
import { JarvisButton } from "@/components/ui/jarvis-button"
import { useSupabase } from "@/hooks/useSupabase"
import type { Teacher } from "@/types/database"

export default function ProfilePage() {
  const { user } = useSupabase()
  const [teacher, setTeacher] = useState<Teacher | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    const fetchTeacher = async () => {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const { data } = await supabase.from("teachers").select("*").eq("user_id", user.id).single()
      if (data) setTeacher(data as Teacher)
    }
    fetchTeacher()
  }, [user])

  const handleSave = async () => {
    if (!user || !teacher) return
    setSaving(true)
    setMessage(null)
    const { createClient } = await import("@/lib/supabase/client")
    const supabase = createClient()

    const { error } = await supabase
      .from("teachers")
      .update({
        display_name: teacher.display_name,
        tagline: teacher.tagline,
      })
      .eq("user_id", user.id)

    setMessage(error ? error.message : "Profile updated!")
    setSaving(false)
  }

  if (!teacher) return <p className="text-text-muted">Loading profile...</p>

  return (
    <div className="space-y-6 max-w-2xl">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-2xl font-display font-bold text-text-primary">Edit Profile</h2>
        <p className="text-text-muted">Manage your public teacher profile.</p>
      </motion.div>

      <JarvisCard glow="violet" className="p-6 space-y-4">
        <JarvisInput
          label="Display Name"
          value={teacher.display_name}
          onChange={(e) => setTeacher({ ...teacher, display_name: e.target.value })}
          icon={<UserCog className="h-4 w-4" />}
        />
        <JarvisInput
          label="Tagline"
          value={teacher.tagline || ""}
          onChange={(e) => setTeacher({ ...teacher, tagline: e.target.value })}
          placeholder="e.g. PhD in Mathematics | 10+ years teaching"
        />

        <div className="flex items-center gap-3">
          <JarvisButton variant="primary" onClick={handleSave} loading={saving}>
            <Save className="h-4 w-4" />
            Save Changes
          </JarvisButton>
          {message && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`text-sm ${message.includes("updated") ? "text-accent-success" : "text-accent-danger"}`}
            >
              {message}
            </motion.p>
          )}
        </div>
      </JarvisCard>

      <JarvisCard glow="none" className="p-6">
        <h3 className="font-display text-lg font-semibold text-text-primary mb-3">Account Info</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-text-muted">Email</span>
            <span className="text-text-primary">{user?.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Status</span>
            <span className="text-text-primary capitalize">{teacher.status}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Translation</span>
            <span className="text-text-primary">{teacher.translation_enabled ? "Enabled" : "Disabled"}</span>
          </div>
        </div>
      </JarvisCard>
    </div>
  )
}
