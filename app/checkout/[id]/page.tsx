import type { Metadata } from "next"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { getCommerceSettings } from "@/lib/payments/settings"
import { isStripeEnabled } from "@/lib/payments/stripe"
import { CheckoutClient } from "@/components/checkout/CheckoutClient"
import type { Transaction } from "@/types/database"

export const metadata: Metadata = { title: "Checkout", robots: { index: false } }

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login?redirect=" + encodeURIComponent("/checkout/" + id))

  const { data } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", id)
    .maybeSingle()
  const transaction = data as Transaction | null
  if (!transaction || transaction.payer_id !== user.id) notFound()

  const settings = await getCommerceSettings()

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Link
        href="/orders"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-text-primary"
      >
        <ArrowLeft className="size-4" />
        My orders
      </Link>
      <CheckoutClient
        transaction={transaction}
        accounts={settings.accounts}
        stripeEnabled={isStripeEnabled()}
        userId={user.id}
      />
    </div>
  )
}
