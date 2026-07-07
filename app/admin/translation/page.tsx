"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Languages } from "lucide-react"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { JarvisButton } from "@/components/ui/jarvis-button"
import { Badge } from "@/components/ui/badge"
import type { Teacher } from "@/types/database"

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
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="font-display text-2xl font-bold">Translation Privileges</h2>
      </motion.div>

      {loading ? <p className="text-text-muted">Loading...</p> : teachers.length === 0 ? (
        <JarvisCard glow="none" className="p-8 text-center">
          <Languages className="mx-auto h-12 w-12 text-text-disabled mb-3" />
          <p className="text-text-muted">No teachers yet</p>
        </JarvisCard>
      ) : (
        <div className="space-y-3">
          {teachers.map((t, i) => {
            const langs = (t.translation_languages || []) as string[]
            return (
              <motion.div key={t.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <JarvisCard glow="none" className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-text-primary">{t.display_name || "Unnamed"}</p>
                      <p className="text-xs text-text-muted">{langs.length > 0 ? langs.join(", ") : "No languages set"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={t.translation_enabled ? "success" : "default"}>{t.translation_enabled ? "Enabled" : "Disabled"}</Badge>
                      <JarvisButton variant={t.translation_enabled ? "danger" : "primary"} size="sm" onClick={() => toggle(t.id, !!t.translation_enabled)}>
                        {t.translation_enabled ? "Revoke" : "Enable"}
                      </JarvisButton>
                    </div>
                  </div>
                </JarvisCard>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
