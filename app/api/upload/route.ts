import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { rateLimit } from "@/lib/security/rate-limit"

// Public avatar/image bucket: only raster images, capped size. Anything else
// (HTML, SVG, scripts) is rejected so the public bucket can't host active content.
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
}
const MAX_BYTES = 5 * 1024 * 1024

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const limited = rateLimit(`upload:${user.id}`, 20, 60_000)
  if (!limited.ok) return NextResponse.json({ error: "Too many uploads. Try again shortly." }, { status: 429 })

  const formData = await req.formData()
  const file = formData.get("file")
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 })

  const ext = ALLOWED_TYPES[file.type]
  if (!ext) return NextResponse.json({ error: "Only JPG, PNG, WEBP or GIF images are allowed" }, { status: 415 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Image must be 5 MB or smaller" }, { status: 413 })

  const path = `${user.id}/${Date.now()}.${ext}`

  const { error } = await supabase.storage.from("avatars").upload(path, file, { contentType: file.type })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: url } = supabase.storage.from("avatars").getPublicUrl(path)
  return NextResponse.json({ url: url.publicUrl })
}
