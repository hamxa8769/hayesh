"use client"

import { useEffect, useRef } from "react"
import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

const PROTECTED_PREFIXES = ["/admin", "/teacher", "/parent", "/seller", "/buyer", "/orders", "/messages", "/meetings", "/checkout", "/receipts"]

/**
 * Keeps every open page in step with the session:
 * - sign-in / sign-out / account switch (in this tab or another) re-renders
 *   server components immediately (router.refresh), so names, menus and
 *   role-aware content never show the previous user;
 * - signing out while on a private page sends you to the login page.
 */
export function AuthSync() {
  const router = useRouter()
  const pathname = usePathname()
  const lastUserId = useRef<string | null | undefined>(undefined)
  const pathRef = useRef(pathname)
  pathRef.current = pathname

  useEffect(() => {
    const supabase = createClient()

    const apply = (userId: string | null) => {
      const previous = lastUserId.current
      lastUserId.current = userId
      if (previous === undefined || previous === userId) return
      const onPrivatePage = PROTECTED_PREFIXES.some((p) => pathRef.current === p || pathRef.current.startsWith(p + "/"))
      if (!userId && onPrivatePage) {
        router.replace(`/auth/login?redirect=${encodeURIComponent(pathRef.current)}`)
        return
      }
      router.refresh()
    }

    supabase.auth.getSession().then(({ data }) => {
      if (lastUserId.current === undefined) lastUserId.current = data.session?.user.id ?? null
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        apply(session?.user.id ?? null)
      }
    })

    // Another tab may have signed in/out: re-check when this tab regains focus.
    const onFocus = () => {
      supabase.auth.getSession().then(({ data }) => apply(data.session?.user.id ?? null))
    }
    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", onFocus)

    return () => {
      sub.subscription.unsubscribe()
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onFocus)
    }
  }, [router])

  return null
}
