import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 })

  const ext = file.name.split(".").pop()
  const path = `${user.id}/${Date.now()}.${ext}`

  const { error } = await supabase.storage.from("avatars").upload(path, file)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: url } = supabase.storage.from("avatars").getPublicUrl(path)
  return NextResponse.json({ url: url.publicUrl })
}
