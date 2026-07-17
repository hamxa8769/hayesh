"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Package, ShoppingBag, Wallet, Plus, UserCog, ArrowRight, Store } from "lucide-react"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { JarvisButton } from "@/components/ui/jarvis-button"
import { Button } from "@/components/ui/button"
import { useSupabase } from "@/hooks/useSupabase"
import { formatPKR } from "@/lib/utils/format"
import type { Seller } from "@/types/database"

const PROFILE_FIELDS = ["display_name", "tagline", "avatar_url", "skills", "languages", "portfolio_urls"] as const

export default function SellerDashboard() {
  const { user } = useSupabase()
  const [stats, setStats] = useState({ gigs: 0, orders: 0, balance: 0 })
  const [profileComplete, setProfileComplete] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [needsSetup, setNeedsSetup] = useState(false)

  useEffect(() => {
    if (!user) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setNeedsSetup(false)

      try {
        const { createClient } = await import("@/lib/supabase/client")
        const supabase = createClient()

        // `.maybeSingle()` (not `.single()`) because a signed-in seller who
        // hasn't saved their seller profile yet legitimately has zero rows
        // here — `.single()` makes PostgREST return a 406 for that case
        // instead of null data.
        const { data: sellerRow, error: sellerError } = await supabase
          .from("sellers")
          .select("display_name, tagline, avatar_url, skills, languages, portfolio_urls")
          .eq("user_id", user.id)
          .maybeSingle()

        if (cancelled) return

        if (sellerError) {
          setLoading(false)
          return
        }

        if (!sellerRow) {
          setNeedsSetup(true)
          setLoading(false)
          return
        }

        const [gigs, orders, tx] = await Promise.all([
          supabase.from("gigs").select("id", { count: "exact", head: true }).eq("seller_id", user.id),
          supabase.from("gig_orders").select("id", { count: "exact", head: true }).eq("seller_id", user.id),
          supabase.from("transactions").select("net_amount").eq("payee_id", user.id).eq("status", "completed"),
        ])

        if (cancelled) return

        setStats({ gigs: gigs.count || 0, orders: orders.count || 0, balance: (tx.data || []).reduce((s, t) => s + (t.net_amount || 0), 0) })

        const row = sellerRow as Partial<Seller>
        const filled = PROFILE_FIELDS.filter((field) => {
          const value = row[field]
          return Array.isArray(value) ? value.length > 0 : Boolean(value && String(value).trim())
        }).length
        setProfileComplete(Math.round((filled / PROFILE_FIELDS.length) * 100))
        setLoading(false)
      } catch {
        if (cancelled) return
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [user])

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="font-display text-2xl font-bold">Seller Dashboard</h2>
      </motion.div>

      {!loading && needsSetup ? (
        <div className="relative overflow-hidden rounded-lg border border-border bg-surface p-8">
          <span aria-hidden="true" className="aurora-bg absolute inset-x-0 top-0 h-[2px]" />
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-line-strong bg-surface-2">
                <Store className="h-6 w-6 text-accent-primary" />
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold tracking-[-0.02em] text-text-primary">
                  Set up your seller profile
                </h3>
                <p className="mt-1 max-w-md text-sm text-text-muted">
                  You haven&apos;t created a seller profile yet. Add your display name, skills, and portfolio to
                  start publishing gigs.
                </p>
              </div>
            </div>
            <Link href="/seller/profile" className="shrink-0">
              <Button variant="aurora">
                Set Up Profile <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: "Gigs", value: stats.gigs, icon: Package, color: "text-accent-success", href: "/seller/gigs" },
              { label: "Orders", value: stats.orders, icon: ShoppingBag, color: "text-accent-primary", href: "/seller/orders" },
              { label: "Balance", value: formatPKR(stats.balance), icon: Wallet, color: "text-accent-success", href: "/seller/earnings" },
            ].map((c, i) => (
              <motion.div key={c.label} custom={i} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                <Link href={c.href}>
                  <JarvisCard glow="green" className="p-5 cursor-pointer hover:glow-green transition-all">
                    <div className="flex items-center justify-between">
                      <div><p className="text-sm text-text-muted">{c.label}</p><p className="mt-1 font-mono text-2xl font-bold text-text-primary">{c.value}</p></div>
                      <c.icon className={`h-8 w-8 ${c.color} opacity-50`} />
                    </div>
                  </JarvisCard>
                </Link>
              </motion.div>
            ))}
          </div>

          <JarvisCard glow="none" className="p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold">Quick Actions</h3>
              <Link href="/seller/gigs/new"><JarvisButton variant="primary" size="sm"><Plus className="h-3.5 w-3.5 mr-1" /> New Gig</JarvisButton></Link>
            </div>
          </JarvisCard>

          {profileComplete !== null && profileComplete < 100 && (
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="relative overflow-hidden rounded-lg border border-border bg-surface p-5">
              <span aria-hidden="true" className="aurora-bg absolute inset-x-0 top-0 h-[2px]" />
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <UserCog className="mt-0.5 h-5 w-5 shrink-0 text-accent-primary" />
                  <div>
                    <p className="font-display font-semibold text-text-primary">Complete your seller profile</p>
                    <p className="mt-1 text-sm text-text-muted">
                      Your profile is <span className="font-mono tabular-nums text-text-primary">{profileComplete}%</span> complete.
                      Buyers trust sellers with a full profile more.
                    </p>
                  </div>
                </div>
                <Link href="/seller/profile" className="shrink-0">
                  <Button variant="aurora" size="sm">
                    Finish Profile <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            </motion.div>
          )}
        </>
      )}
    </div>
  )
}
