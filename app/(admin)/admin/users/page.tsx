"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Users } from "lucide-react"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import type { Profile } from "@/types/database"

export default function AdminUsersPage() {
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchUsers = async () => {
      const supabase = createClient()
      const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false })
      setUsers((data || []) as Profile[])
      setLoading(false)
    }
    fetchUsers()
  }, [])

  const roleColors: Record<string, "default" | "success" | "cyan" | "warning" | "destructive"> = {
    admin: "destructive",
    teacher: "default",
    parent: "cyan",
    seller: "success",
    buyer: "warning",
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-2xl font-display font-bold text-text-primary">User Management</h2>
        <p className="text-text-muted">{users.length} total users</p>
      </motion.div>

      {loading ? (
        <p className="text-text-muted">Loading...</p>
      ) : (
        <JarvisCard glow="none" className="p-6">
          <div className="space-y-2">
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="flex items-center gap-3">
                  <Users className="h-4 w-4 text-text-muted" />
                  <div>
                    <p className="text-sm font-medium text-text-primary">{u.full_name}</p>
                    <p className="text-xs text-text-muted">{u.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={roleColors[u.role] || "default"}>{u.role}</Badge>
                  {u.is_verified && <Badge variant="success">✓</Badge>}
                </div>
              </div>
            ))}
          </div>
        </JarvisCard>
      )}
    </div>
  )
}
