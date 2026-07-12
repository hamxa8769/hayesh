"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, Star } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Reveal } from "@/components/motion/Reveal"
import { Stagger } from "@/components/motion/Stagger"
import { createClient } from "@/lib/supabase/client"
import { formatPKR } from "@/lib/utils/format"
import type { Teacher } from "@/types/database"

type ShowcaseTeacher = Pick<
  Teacher,
  | "id"
  | "display_name"
  | "tagline"
  | "profile_photo_url"
  | "subjects"
  | "average_rating"
  | "translation_enabled"
  | "group_price_pkr"
  | "standard_price_pkr"
  | "private_price_pkr"
>

function getInitials(name: string | null): string {
  if (!name) return "?"
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

export function TeacherShowcase() {
  const [teachers, setTeachers] = useState<ShowcaseTeacher[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from("teachers")
        .select(
          "id, display_name, tagline, profile_photo_url, subjects, average_rating, translation_enabled, group_price_pkr, standard_price_pkr, private_price_pkr"
        )
        .eq("status", "approved")
        .order("average_rating", { ascending: false })
        .limit(8)

      setTeachers((data || []) as ShowcaseTeacher[])
      setLoading(false)
    }

    load()
  }, [])

  return (
    <section className="py-24 sm:py-28">
      <div className="mx-auto w-full max-w-[1200px] px-6">
        <Reveal className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-xl">
            <span className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Layer One</span>
            <h2 className="mt-3 text-balance font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Top teachers
            </h2>
            <p className="mt-3 text-text-muted">
              Structured profiles, free demo lessons, and monthly subscriptions with verified educators.
            </p>
          </div>
          <Link
            href="/teachers"
            className="group flex items-center gap-1.5 font-mono text-sm uppercase tracking-[0.08em] text-text-muted transition-colors duration-150 hover:text-accent-primary"
          >
            Explore all
            <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-1" />
          </Link>
        </Reveal>

        <div className="mt-12">
          {loading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-64 animate-pulse rounded-lg border border-border bg-surface" />
              ))}
            </div>
          ) : teachers.length === 0 ? (
            <div className="rounded-lg border border-border bg-surface p-16 text-center">
              <p className="text-text-muted">Teachers coming soon</p>
            </div>
          ) : (
            <Stagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4" staggerDelay={0.06}>
              {teachers.map((teacher) => {
                const subjects = (teacher.subjects || []) as Array<{ subject: string }>
                const visibleSubjects = subjects.slice(0, 2)
                const overflowCount = subjects.length - visibleSubjects.length
                const startingPrice = Math.min(
                  teacher.group_price_pkr ?? Infinity,
                  teacher.standard_price_pkr ?? Infinity,
                  teacher.private_price_pkr ?? Infinity
                )

                return (
                  <Reveal key={teacher.id}>
                    <Link href={`/teachers/${teacher.id}`} className="group block h-full">
                      <article className="relative flex h-full flex-col justify-between rounded-lg border border-border bg-surface p-6 transition-all duration-150 group-hover:-translate-y-0.5 group-hover:border-line-strong group-hover:bg-surface-elevated group-hover:shadow-[0_12px_30px_rgba(0,0,0,0.45),0_0_24px_rgba(39,196,160,0.12)]">
                        <div>
                          <div className="flex items-center gap-3">
                            {teacher.profile_photo_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={teacher.profile_photo_url}
                                alt={teacher.display_name}
                                className="h-11 w-11 rounded-full border border-border object-cover"
                              />
                            ) : (
                              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface-elevated font-mono text-sm font-semibold text-text-muted">
                                {getInitials(teacher.display_name)}
                              </div>
                            )}
                            <div className="min-w-0">
                              <h3 className="truncate font-display text-base font-semibold text-text-primary">
                                {teacher.display_name}
                              </h3>
                              <p className="truncate text-xs text-text-muted">{teacher.tagline || "Verified teacher"}</p>
                            </div>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-1.5">
                            {visibleSubjects.map((s) => (
                              <span key={s.subject} className="rounded-full border border-border px-2 py-0.5 text-[11px] text-text-muted">
                                {s.subject}
                              </span>
                            ))}
                            {overflowCount > 0 && (
                              <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-text-disabled">
                                +{overflowCount}
                              </span>
                            )}
                          </div>

                          {teacher.translation_enabled && (
                            <Badge variant="aurora" className="mt-3">
                              &#10022; Multilingual
                            </Badge>
                          )}
                        </div>

                        <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
                          <span className="flex items-center gap-1.5 font-mono text-sm tabular-nums text-text-primary">
                            <Star className="h-3.5 w-3.5 fill-accent-secondary text-accent-secondary" />
                            {teacher.average_rating ? teacher.average_rating.toFixed(1) : "New"}
                          </span>
                          {startingPrice < Infinity && (
                            <span className="font-mono text-sm font-semibold tabular-nums text-text-primary">
                              {formatPKR(startingPrice)}
                            </span>
                          )}
                        </div>
                      </article>
                    </Link>
                  </Reveal>
                )
              })}
            </Stagger>
          )}
        </div>
      </div>
    </section>
  )
}
