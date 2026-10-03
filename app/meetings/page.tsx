import { redirect } from "next/navigation"
import { MeetingsHub } from "@/components/meetings/MeetingsHub"
import { createClient } from "@/lib/supabase/server"

/** /meetings — the meetings hub, rendered inside the signed-in user's role dashboard (see layout.tsx). */
export default async function MeetingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login?redirect=/meetings")
  }

  return (
    <MeetingsHub />
  )
}
