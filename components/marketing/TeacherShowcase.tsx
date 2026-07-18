"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, Star, TriangleAlert, Users } from "lucide-react"
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

interface RateTier {
  label: string
  price: number | null
}

function getInitials(name: string | null): string {
  if (!name) return "?"
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

function tiersFor(teacher: ShowcaseTeacher): RateTier[] {
  return [
    { label: "Group", price: teacher.group_price_pkr },
    { label: "Standard", price: teacher.standard_price_pkr },
    { label: "Private", price: teacher.private_price_pkr },
  ]
}

function RateTierList({ tiers, dense = false }: { tiers: RateTier[]; dense?: boolean }) {
  return (
    <dl className={dense ? "mt-4 space-y-1.5" : "mt-5 space-y-2"}>
      {tiers.map((tier) => (
        <div key={tier.label} className="flex items-center justify-between gap-3">
          <dt className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-muted">{tier.label}</dt>
          <dd className="font-mono text-sm font-semibold tabular-nums text-text-primary">
            {tier.price != null ? `${formatPKR(tier.price)}/mo` : "—"}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function TeacherAvatar({ teacher, size }: { teacher: ShowcaseTeacher; size: "lg" | "sm" }) {
  const dimension = size === "lg" ? "h-16 w-16" : "h-11 w-11"
  if (teacher.profile_photo_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={teacher.profile_photo_url}
        alt={teacher.display_name}
        className={`${dimension} rounded-full border border-border object-cover`}
      />
    )
  }
  return (
    <div
      className={`flex ${dimension} items-center justify-center rounded-full border border-border bg-surface-elevated font-mono ${size === "lg" ? "text-lg" : "text-sm"} font-semibold text-text-muted`}
    >
      {getInitials(teacher.display_name)}
    </div>
  )
}

function FeaturedTeacherCard({ teacher }: { teacher: ShowcaseTeacher }) {
  const subjects = (teacher.subjects || []) as Array<{ subject: string }>

  return (
    <Link href={`/teachers/${teacher.id}`} className="group block h-full">
      <article className="relative flex h-full flex-col justify-between overflow-hidden rounded-lg border border-line-strong bg-surface-elevated p-8 transition-all duration-150 group-hover:border-accent-primary/40 group-hover:shadow-[0_20px_50px_rgba(0,0,0,0.5),0_0_30px_rgba(39,196,160,0.14)]">
        <div className="aurora-bg absolute inset-x-0 top-0 h-[2px]" />

        <div>
          <div className="flex items-center gap-4">
            <TeacherAvatar teacher={teacher} size="lg" />
            <div className="min-w-0">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">
                Top-rated teacher
              </span>
              <h3 className="mt-0.5 truncate font-display text-xl font-semibold text-text-primary">
                {teacher.display_name}
              </h3>
              <p className="truncate text-sm text-text-muted">{teacher.tagline || "Verified teacher"}</p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-1.5">
            {subjects.slice(0, 4).map((s) => (
              <span key={s.subject} className="rounded-full border border-border px-2.5 py-1 text-xs text-text-muted">
                {s.subject}
              </span>
            ))}
          </div>

          {teacher.translation_enabled && (
            <Badge variant="aurora" className="mt-4">
              &#10022; Multilingual
            </Badge>
          )}
        </div>

        <div className="mt-8 grid gap-8 border-t border-border pt-6 sm:grid-cols-2">
          <div>
            <span className="flex items-center gap-1.5 font-mono text-sm tabular-nums text-text-primary">
              <Star className="h-3.5 w-3.5 fill-accent-secondary text-accent-secondary" />
              {teacher.average_rating ? teacher.average_rating.toFixed(1) : "New teacher"}
            </span>
            <p className="mt-2 max-w-[26ch] text-xs leading-relaxed text-text-muted">
              Free demo lesson first, then subscribe monthly to the tier that fits.
            </p>
          </div>
          <RateTierList tiers={tiersFor(teacher)} />
        </div>
      </article>
    </Link>
  )
}

function CompactTeacherCard({ teacher }: { teacher: ShowcaseTeacher }) {
  const subjects = (teacher.subjects || []) as Array<{ subject: string }>
  const visibleSubjects = subjects.slice(0, 2)
  const overflowCount = subjects.length - visibleSubjects.length

  return (
    <Link href={`/teachers/${teacher.id}`} className="group block h-full">
      <article className="relative flex h-full flex-col justify-between rounded-lg border border-border bg-surface p-6 transition-all duration-150 group-hover:-translate-y-0.5 group-hover:border-line-strong group-hover:bg-surface-elevated group-hover:shadow-[0_12px_30px_rgba(0,0,0,0.45),0_0_24px_rgba(39,196,160,0.12)]">
        <div>
          <div className="flex items-center gap-3">
            <TeacherAvatar teacher={teacher} size="sm" />
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

        <div className="mt-5 border-t border-border pt-4">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-mono text-sm tabular-nums text-text-primary">
              <Star className="h-3.5 w-3.5 fill-accent-secondary text-accent-secondary" />
              {teacher.average_rating ? teacher.average_rating.toFixed(1) : "New"}
            </span>
          </div>
          <RateTierList tiers={tiersFor(teacher)} dense />
        </div>
      </article>
    </Link>
  )
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
          "id, display_name, tagline, profile_photo_url, subjects, average_rating, translation_enabled, group_price_pkr, standard_price_pkr, private_price_pkr"
        )
        .eq("status", "approved")
        .order("average_rating", { ascending: false })
        .limit(7)

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

  const [featured, ...rest] = teachers

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
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <div className="h-80 animate-pulse rounded-lg border border-border bg-surface sm:col-span-2 lg:row-span-2" />
              {Array.from({ length: 3 }).map((_unused, i) => (
                <div key={i} className="h-64 animate-pulse rounded-lg border border-border bg-surface" />
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
            <Stagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4" staggerDelay={0.06}>
              {featured && (
                <Reveal className="sm:col-span-2 lg:col-span-2 lg:row-span-2">
                  <FeaturedTeacherCard teacher={featured} />
                </Reveal>
              )}
              {rest.map((teacher) => (
                <Reveal key={teacher.id}>
                  <CompactTeacherCard teacher={teacher} />
                </Reveal>
              ))}
            </Stagger>
          )}
        </div>
      </div>
    </section>
  )
}
