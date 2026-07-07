"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { ShoppingBag, CheckCircle, XCircle } from "lucide-react"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { JarvisButton } from "@/components/ui/jarvis-button"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import type { Seller } from "@/types/database"

export default function AdminSellersPage() {
  const [sellers, setSellers] = useState<Seller[]>([])
  const [loading, setLoading] = useState(true)

  const fetchSellers = async () => {
    const supabase = createClient()
    const { data } = await supabase.from("sellers").select("*").order("created_at", { ascending: false })
    setSellers((data || []) as Seller[])
    setLoading(false)
  }

  useEffect(() => { fetchSellers() }, [])

  const handleApprove = async (id: string) => {
    const supabase = createClient()
    await supabase.from("sellers").update({ status: "approved" }).eq("id", id)
    fetchSellers()
  }

  const handleReject = async (id: string) => {
    const supabase = createClient()
    await supabase.from("sellers").update({ status: "rejected" }).eq("id", id)
    fetchSellers()
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-2xl font-display font-bold text-text-primary">Seller Management</h2>
      </motion.div>

      {loading ? (
        <p className="text-text-muted">Loading...</p>
      ) : (
        <div className="space-y-3">
          {sellers.map((seller, i) => (
            <motion.div key={seller.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <JarvisCard glow="none" className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ShoppingBag className="h-5 w-5 text-accent-success" />
                    <div>
                      <p className="font-medium text-text-primary">{seller.display_name}</p>
                      <p className="text-xs text-text-muted">{seller.tagline || "No tagline"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={seller.status === "approved" ? "success" : seller.status === "pending" ? "warning" : "destructive"}>
                      {seller.status}
                    </Badge>
                    {seller.status === "pending" && (
                      <div className="flex gap-1">
                        <JarvisButton variant="primary" size="sm" onClick={() => handleApprove(seller.id)}>
                          <CheckCircle className="h-3.5 w-3.5" />
                        </JarvisButton>
                        <JarvisButton variant="danger" size="sm" onClick={() => handleReject(seller.id)}>
                          <XCircle className="h-3.5 w-3.5" />
                        </JarvisButton>
                      </div>
                    )}
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
