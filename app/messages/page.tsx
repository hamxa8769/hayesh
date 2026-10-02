import { redirect } from "next/navigation"
import { Navbar } from "@/components/layout/Navbar"
import { MessagesHub } from "@/components/messages/MessagesHub"
import { createClient } from "@/lib/supabase/server"

/** /messages — signed-in inbox (Navbar shell, like /meetings). */
export default async function MessagesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login?redirect=/messages")
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-[1100px] px-4 pb-10 pt-24 sm:px-6 lg:px-8">
        <MessagesHub />
      </main>
    </div>
  )
}
