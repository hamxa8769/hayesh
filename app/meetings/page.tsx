import { redirect } from "next/navigation"
import { Navbar } from "@/components/layout/Navbar"
import { MeetingsHub } from "@/components/meetings/MeetingsHub"
import { createClient } from "@/lib/supabase/server"

/**
 * /meetings — the signed-in meetings hub (mirrors /explore's public-shell
 * approach: Navbar + a centered container, no dashboard sidebar, since every
 * role from parent to admin lands here).
 */
export default async function MeetingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login?redirect=/meetings")
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-[1100px] px-4 pb-10 pt-24 sm:px-6 lg:px-8">
        <MeetingsHub />
      </main>
    </div>
  )
}
