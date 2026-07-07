"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { motion } from "framer-motion"
import { GraduationCap, BookOpen, Calendar, Star, Users, Globe, ArrowLeft, Clock } from "lucide-react"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { JarvisButton } from "@/components/ui/jarvis-button"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { formatPKR } from "@/lib/utils/format"
import Link from "next/link"
import type { Teacher } from "@/types/database"

export default function TeacherProfilePage() {
  const params = useParams()
  const [teacher, setTeacher] = useState<Teacher | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchTeacher = async () => {
      const supabase = createClient()
      const { data } = await supabase.from("teachers").select("*").eq("id", params.id).single()
      setTeacher(data as Teacher | null)
      setLoading(false)
    }
    if (params.id) fetchTeacher()
  }, [params.id])

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="h-2 w-2 rounded-full bg-accent-primary"
              animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </div>
      </div>
    )
  }

  if (!teacher) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
        <p className="text-text-muted">Teacher not found</p>
        <Link href="/teachers">
          <JarvisButton variant="secondary"><ArrowLeft className="h-4 w-4 mr-1" /> Back to Teachers</JarvisButton>
        </Link>
      </div>
    )
  }

  const education = (teacher.education || []) as Array<{ degree: string; institution: string; year: number; field: string }>
  const experience = (teacher.experience || []) as Array<{ title: string; institution: string; years: number; description: string }>
  const subjects = (teacher.subjects || []) as Array<{ subject: string; level: string }>
  const availability = (teacher.availability || {}) as Record<string, string[]>
  const languages = (teacher.translation_languages || []) as string[]

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Link href="/teachers" className="mb-6 inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-primary transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Teachers
        </Link>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header */}
          <JarvisCard glow="violet" className="p-6 mb-6">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-primary/20">
                <GraduationCap className="h-8 w-8 text-accent-primary" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h1 className="font-display text-2xl font-bold text-text-primary">{teacher.display_name}</h1>
                  {teacher.translation_enabled && <Badge variant="cyan">✦ Multilingual</Badge>}
                </div>
                {teacher.tagline && <p className="mt-1 text-text-muted">{teacher.tagline}</p>}
                <div className="mt-3 flex flex-wrap gap-4 text-sm text-text-muted">
                  <span className="flex items-center gap-1"><Star className="h-4 w-4 text-accent-warning" /> {teacher.average_rating || "New"}</span>
                  <span className="flex items-center gap-1"><Users className="h-4 w-4" /> {teacher.total_students || 0} students</span>
                  <span className="flex items-center gap-1"><BookOpen className="h-4 w-4" /> {subjects.length} subjects</span>
                </div>
              </div>
            </div>
          </JarvisCard>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              {/* Subjects */}
              {subjects.length > 0 && (
                <JarvisCard glow="none" className="p-6">
                  <h2 className="mb-4 font-display text-lg font-bold text-text-primary">Subjects</h2>
                  <div className="flex flex-wrap gap-2">
                    {subjects.map((s, i) => (
                      <Badge key={i} variant="default">{s.subject} — {s.level}</Badge>
                    ))}
                  </div>
                </JarvisCard>
              )}

              {/* Education */}
              {education.length > 0 && (
                <JarvisCard glow="none" className="p-6">
                  <h2 className="mb-4 font-display text-lg font-bold text-text-primary">Education</h2>
                  <div className="space-y-3">
                    {education.map((e, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <GraduationCap className="mt-0.5 h-5 w-5 text-accent-primary" />
                        <div>
                          <p className="font-medium text-text-primary">{e.degree}{e.field ? ` in ${e.field}` : ""}</p>
                          <p className="text-sm text-text-muted">{e.institution}{e.year ? ` (${e.year})` : ""}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </JarvisCard>
              )}

              {/* Experience */}
              {experience.length > 0 && (
                <JarvisCard glow="none" className="p-6">
                  <h2 className="mb-4 font-display text-lg font-bold text-text-primary">Experience</h2>
                  <div className="space-y-3">
                    {experience.map((e, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <Clock className="mt-0.5 h-5 w-5 text-accent-secondary" />
                        <div>
                          <p className="font-medium text-text-primary">{e.title}</p>
                          {e.institution && <p className="text-sm text-text-muted">{e.institution}</p>}
                          {e.years && <p className="text-xs text-text-muted">{e.years} years</p>}
                          {e.description && <p className="mt-1 text-sm text-text-muted">{e.description}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </JarvisCard>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Pricing */}
              <JarvisCard glow="green" className="p-6">
                <h2 className="mb-4 font-display text-lg font-bold text-text-primary">Monthly Pricing</h2>
                <div className="space-y-3">
                  {teacher.group_price_pkr && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-text-muted">Group (up to 5)</span>
                      <span className="font-mono font-bold text-accent-success">{formatPKR(teacher.group_price_pkr)}</span>
                    </div>
                  )}
                  {teacher.standard_price_pkr && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-text-muted">Standard (up to 3)</span>
                      <span className="font-mono font-bold text-accent-success">{formatPKR(teacher.standard_price_pkr)}</span>
                    </div>
                  )}
                  {teacher.private_price_pkr && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-text-muted">Private (1-on-1)</span>
                      <span className="font-mono font-bold text-accent-success">{formatPKR(teacher.private_price_pkr)}</span>
                    </div>
                  )}
                </div>
                <JarvisButton variant="primary" className="w-full mt-4">
                  Book Free Demo
                </JarvisButton>
              </JarvisCard>

              {/* Availability */}
              {Object.keys(availability).length > 0 && (
                <JarvisCard glow="none" className="p-6">
                  <h2 className="mb-4 font-display text-lg font-bold text-text-primary">Availability</h2>
                  <div className="space-y-2">
                    {Object.entries(availability).map(([day, slots]) => (
                      <div key={day} className="flex items-center justify-between">
                        <span className="text-sm font-mono text-text-muted uppercase">{day}</span>
                        <div className="flex gap-1">
                          {(slots as string[]).map((slot) => (
                            <Badge key={slot} variant="default" className="text-[10px]">{slot}</Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </JarvisCard>
              )}

              {/* Languages */}
              {languages.length > 0 && (
                <JarvisCard glow="none" className="p-6">
                  <h2 className="mb-3 font-display text-sm font-bold text-text-primary flex items-center gap-2">
                    <Globe className="h-4 w-4" /> Languages
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {languages.map((lang) => (
                      <Badge key={lang} variant="secondary">{lang}</Badge>
                    ))}
                  </div>
                </JarvisCard>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
