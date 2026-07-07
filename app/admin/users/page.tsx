"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Users } from "lucide-react"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/utils/format"
import type { Profile } from "@/types/database"

export default function AdminUsersPage() {
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false })
      setUsers((data || []) as Profile[])
      setLoading(false)
    }
    load()
  }, [])

  const roleColors: Record<string, "default" | "success" | "warning" | "cyan" | "destructive"> = {
    admin: "destructive", teacher: "cyan", parent: "success", seller: "warning", buyer: "default",
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="font-display text-2xl font-bold">All Users</h2>
      </motion.div>

      {loading ? <p className="text-text-muted">Loading...</p> : users.length === 0 ? (
        <JarvisCard glow="none" className="p-8 text-center">
          <Users className="mx-auto h-12 w-12 text-text-disabled mb-3" />
          <p className="text-text-muted">No users yet</p>
        </JarvisCard>
      ) : (
        <JarvisCard glow="none" className="p-6">
          <div className="space-y-2">
            {users.map((u, i) => (
              <motion.div key={u.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
                className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium text-text-primary">{u.full_name || u.email || "Unknown"}</p>
                  <p className="text-xs text-text-muted">{u.created_at ? formatDate(u.created_at) : ""}</p>
                </div>
                <Badge variant={roleColors[u.role] || "default"}>{u.role}</Badge>
              </motion.div>
            ))}
          </div>
        </JarvisCard>
      )}
    </div>
  )
}
