"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Star, ArrowLeft } from "lucide-react"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { JarvisButton } from "@/components/ui/jarvis-button"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { formatPKR } from "@/lib/utils/format"
import type { Teacher } from "@/types/database"

export default function TeacherDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [teacher, setTeacher] = useState<Teacher | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data } = await supabase.from("teachers").select("*").eq("id", id).single()
      setTeacher(data as Teacher | null)
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return <div className="flex min-h-screen items-center justify-center"><p className="text-text-muted">Loading...</p></div>
  if (!teacher) return <div className="flex min-h-screen items-center justify-center"><p className="text-text-muted">Teacher not found</p></div>

  const subs = (teacher.subjects || []) as Array<{ subject: string; level: string }>

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-4xl px-4 py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <button onClick={() => router.back()} className="mb-6 flex items-center gap-2 text-sm text-text-muted hover:text-text-primary transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>

          <JarvisCard glow="violet" className="p-8">
            <h1 className="font-display text-3xl font-bold text-text-primary">{teacher.display_name}</h1>
            <p className="mt-2 text-text-muted">{teacher.tagline || "Verified teacher"}</p>

            <div className="flex flex-wrap gap-2 mt-4">
              {subs.map((s) => <Badge key={s.subject} variant="secondary">{s.subject} ({s.level})</Badge>)}
              <span className="flex items-center gap-1 text-sm"><Star className="h-4 w-4 text-accent-warning" /> {teacher.average_rating || "New"}</span>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {teacher.group_price_pkr && (
                <div className="rounded-lg border border-border p-4 text-center">
                  <p className="text-xs text-text-muted">Group Session</p>
                  <p className="font-mono text-lg font-bold text-accent-primary mt-1">{formatPKR(teacher.group_price_pkr)}</p>
                </div>
              )}
              {teacher.standard_price_pkr && (
                <div className="rounded-lg border border-accent-primary/50 p-4 text-center">
                  <p className="text-xs text-text-muted">Standard</p>
                  <p className="font-mono text-lg font-bold text-accent-primary mt-1">{formatPKR(teacher.standard_price_pkr)}</p>
                </div>
              )}
              {teacher.private_price_pkr && (
                <div className="rounded-lg border border-border p-4 text-center">
                  <p className="text-xs text-text-muted">Private Session</p>
                  <p className="font-mono text-lg font-bold text-accent-primary mt-1">{formatPKR(teacher.private_price_pkr)}</p>
                </div>
              )}
            </div>

            {teacher.translation_enabled && (
              <Badge variant="success" className="mt-4">✦ Multilingual</Badge>
            )}

            <div className="mt-8">
              <JarvisButton variant="primary" className="w-full">Book Free Demo Lesson</JarvisButton>
            </div>
          </JarvisCard>
        </motion.div>
      </div>
    </div>
  )
}
