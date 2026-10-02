import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { Navbar } from "@/components/layout/Navbar"
import { MyOrders } from "@/components/orders/MyOrders"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "My Orders", robots: { index: false } }

/**
 * /orders — purchases for every role. Parents, teachers and sellers can buy
 * gigs and AI services too, but /buyer/* is gated to the buyer role, so
 * order notifications and checkout links point here instead.
 */
export default async function OrdersPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login?redirect=/orders")

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-[1100px] px-4 pb-10 pt-24 sm:px-6 lg:px-8">
        <MyOrders />
      </main>
    </div>
  )
}
