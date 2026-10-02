"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, TriangleAlert, Users } from "lucide-react"
import { TeacherCard, TeacherCardSkeleton } from "@/components/cards/TeacherCard"
import { Reveal } from "@/components/motion/Reveal"
import { Stagger } from "@/components/motion/Stagger"
import { createClient } from "@/lib/supabase/client"
import type { Teacher } from "@/types/database"

type ShowcaseTeacher = Pick<
  Teacher,
  | "id"
  | "display_name"
  | "tagline"
  | "profile_photo_url"
  | "subjects"
  | "average_rating"
  | "total_reviews"
  | "total_students"
  | "translation_enabled"
  | "featured"
  | "featured_until"
  | "group_price_pkr"
  | "standard_price_pkr"
  | "private_price_pkr"
>

function isFeatured(t: ShowcaseTeacher): boolean {
  return Boolean(t.featured) && (!t.featured_until || new Date(t.featured_until).getTime() > Date.now())
}

function lowestPrice(t: ShowcaseTeacher): number | null {
  const prices = [t.group_price_pkr, t.standard_price_pkr, t.private_price_pkr].filter(
    (p): p is number => typeof p === "number" && p > 0
  )
  return prices.length > 0 ? Math.min(...prices) : null
}

export function TeacherShowcase() {
  const [teachers, setTeachers] = useState<ShowcaseTeacher[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const supabase = createClient()
      const { data, error: queryError } = await supabase
        .from("teachers")
        .select(
          "id, display_name, tagline, profile_photo_url, subjects, average_rating, total_reviews, total_students, translation_enabled, featured, featured_until, group_price_pkr, standard_price_pkr, private_price_pkr"
        )
        .eq("status", "approved")
        .order("average_rating", { ascending: false })
        .limit(6)

      if (cancelled) return
      if (queryError) {
        setError(true)
        setLoading(false)
        return
      }

      setTeachers((data || []) as ShowcaseTeacher[])
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="py-24 sm:py-28">
      <div className="mx-auto w-full max-w-[1200px] px-6">
        <Reveal className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-xl">
            <span className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Layer One</span>
            <h2 className="mt-3 text-balance font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Top teachers &amp; their rates
            </h2>
            <p className="mt-3 text-text-muted">
              Structured profiles, free demo lessons, and monthly subscriptions across Group, Standard, and Private
              tiers.
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
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading teachers">
              {Array.from({ length: 3 }).map((_unused, i) => (
                <TeacherCardSkeleton key={i} />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-lg border border-border bg-surface p-16 text-center">
              <TriangleAlert className="mx-auto h-10 w-10 text-accent-warning" />
              <p className="mt-4 text-text-muted">Couldn&apos;t load teachers right now. Please try again shortly.</p>
            </div>
          ) : teachers.length === 0 ? (
            <div className="rounded-lg border border-border bg-surface p-16 text-center">
              <Users className="mx-auto h-10 w-10 text-text-disabled" />
              <p className="mt-4 text-text-muted">Teachers coming soon</p>
            </div>
          ) : (
            <Stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" staggerDelay={0.05}>
              {teachers.map((teacher) => (
                <Reveal key={teacher.id} className="h-full">
                  <TeacherCard
                    id={teacher.id}
                    displayName={teacher.display_name}
                    photoUrl={teacher.profile_photo_url}
                    tagline={teacher.tagline}
                    subjects={((teacher.subjects || []) as Array<{ subject: string }>).map((s) => s.subject)}
                    rating={teacher.average_rating}
                    totalReviews={teacher.total_reviews}
                    totalStudents={teacher.total_students}
                    lowestPrice={lowestPrice(teacher)}
                    translationEnabled={teacher.translation_enabled}
                    featured={isFeatured(teacher)}
                  />
                </Reveal>
              ))}
            </Stagger>
          )}
        </div>
      </div>
    </section>
  )
}
