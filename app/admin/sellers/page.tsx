"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { ShoppingBag } from "lucide-react"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { JarvisButton } from "@/components/ui/jarvis-button"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/utils/format"
import type { Seller } from "@/types/database"

export default function AdminSellersPage() {
  const [sellers, setSellers] = useState<Seller[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const { createClient } = await import("@/lib/supabase/client")
    const supabase = createClient()
    const { data } = await supabase.from("sellers").select("*").order("created_at", { ascending: false })
    setSellers((data || []) as Seller[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const approve = async (id: string) => {
    const { createClient } = await import("@/lib/supabase/client")
    const supabase = createClient()
    await supabase.from("sellers").update({ status: "approved" }).eq("id", id)
    load()
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="font-display text-2xl font-bold">Seller Management</h2>
      </motion.div>

      {loading ? <p className="text-text-muted">Loading...</p> : sellers.length === 0 ? (
        <JarvisCard glow="none" className="p-8 text-center">
          <ShoppingBag className="mx-auto h-12 w-12 text-text-disabled mb-3" />
          <p className="text-text-muted">No sellers yet</p>
        </JarvisCard>
      ) : (
        <div className="space-y-3">
          {sellers.map((s, i) => (
            <motion.div key={s.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <JarvisCard glow="none" className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-text-primary">{s.display_name || "Unnamed"}</p>
                    <p className="text-xs text-text-muted">{s.created_at ? formatDate(s.created_at) : ""}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={s.status === "approved" ? "success" : s.status === "pending" ? "warning" : "destructive"}>{s.status}</Badge>
                    {s.status === "pending" && <JarvisButton variant="primary" size="sm" onClick={() => approve(s.id)}>Approve</JarvisButton>}
                  </div>
                </div>
              </JarvisCard>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
