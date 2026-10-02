import { redirect } from "next/navigation"
import { MessagesHub } from "@/components/messages/MessagesHub"
import { createClient } from "@/lib/supabase/server"

/** /messages — signed-in inbox, rendered inside the role dashboard (see layout.tsx). */
export default async function MessagesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login?redirect=/messages")
  }

  return (
    <MessagesHub />
  )
}
