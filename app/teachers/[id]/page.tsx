"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { CalendarClock, ArrowLeft, Award, Briefcase, GraduationCap, Video } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Reveal } from "@/components/motion/Reveal"
import { createClient } from "@/lib/supabase/client"
import { formatPKR } from "@/lib/utils/format"
import { DemoBookingModal } from "@/components/teacher-public/DemoBookingModal"
import { RatingStars } from "@/components/teacher-public/RatingStars"
import { ReviewList, type ReviewListSummary } from "@/components/teacher-public/ReviewList"
import { ReviewForm } from "@/components/teacher-public/ReviewForm"
import { TestimonialList } from "@/components/teacher-public/TestimonialList"
import type { Teacher } from "@/types/database"

/**
 * public.teachers.endorsed (migration 015 — the "Hayesh Verified" badge) is
 * not yet in the shared Teacher type in types/database.ts. Extend locally
 * rather than editing that shared file, which is out of this task's scope.
 */
type TeacherWithEndorsement = Teacher & { endorsed: boolean | null }

const WEEKDAYS: Array<{ key: "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"; label: string }> = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
]

function getInitials(name: string | null): string {
  if (!name) return "?"
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

interface StatTile {
  label: string
  value: string
}

function buildStatTiles(teacher: TeacherWithEndorsement): StatTile[] {
  const tiles: StatTile[] = []
  if (teacher.total_students) tiles.push({ label: "Students Taught", value: teacher.total_students.toLocaleString() })
  if (teacher.total_sessions) tiles.push({ label: "Sessions", value: teacher.total_sessions.toLocaleString() })
  if (teacher.average_rating) tiles.push({ label: "Rating", value: teacher.average_rating.toFixed(1) })
  if (teacher.total_reviews) tiles.push({ label: "Reviews", value: teacher.total_reviews.toLocaleString() })
  return tiles
}

/** Allowlisted video hosts — never build an iframe src from an unvalidated URL. */
function getYouTubeEmbedUrl(url: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  const host = parsed.hostname.replace(/^www\.|^m\./, "")

  if (host === "youtu.be") {
    const id = parsed.pathname.slice(1)
    return id ? `https://www.youtube.com/embed/${id}` : null
  }
  if (host === "youtube.com") {
    if (parsed.pathname === "/watch") {
      const id = parsed.searchParams.get("v")
      return id ? `https://www.youtube.com/embed/${id}` : null
    }
    if (parsed.pathname.startsWith("/embed/")) return url
    if (parsed.pathname.startsWith("/shorts/")) {
      const id = parsed.pathname.split("/")[2]
      return id ? `https://www.youtube.com/embed/${id}` : null
    }
  }
  return null
}

function getVimeoEmbedUrl(url: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  const host = parsed.hostname.replace(/^www\./, "")
  if (host !== "vimeo.com" && host !== "player.vimeo.com") return null

  const match = parsed.pathname.match(/(\d+)/)
  return match ? `https://player.vimeo.com/video/${match[1]}` : null
}

function isDirectVideoFile(url: string): boolean {
  return /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url)
}

export default function TeacherDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const teacherId = String(id)
  const [teacher, setTeacher] = useState<TeacherWithEndorsement | null>(null)
  const [loading, setLoading] = useState(true)
  const [demoModalOpen, setDemoModalOpen] = useState(false)
  const [reviewSummary, setReviewSummary] = useState<ReviewListSummary | null>(null)
  const [reviewRefreshKey, setReviewRefreshKey] = useState(0)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data } = await supabase.from("teachers").select("*").eq("id", teacherId).maybeSingle()
      setTeacher(data as TeacherWithEndorsement | null)
      setLoading(false)
    }
    load()
  }, [teacherId])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="font-mono text-sm text-text-muted">Loading...</p>
      </div>
    )
  }

  if (!teacher) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-text-muted">Teacher not found</p>
      </div>
    )
  }

  const subs = (teacher.subjects || []) as Array<{ subject: string; level: string }>
  const education = teacher.education || []
  const experience = teacher.experience || []
  const availability = teacher.availability || {}
  const hasAvailability = WEEKDAYS.some((d) => (availability[d.key]?.length ?? 0) > 0)
  const statTiles = buildStatTiles(teacher)
  const translationLanguages = teacher.translation_languages || []

  const introVideoUrl = teacher.intro_video_url
  const introIsDirectFile = introVideoUrl ? isDirectVideoFile(introVideoUrl) : false
  const introEmbedUrl = introVideoUrl && !introIsDirectFile
    ? getYouTubeEmbedUrl(introVideoUrl) || getVimeoEmbedUrl(introVideoUrl)
    : null

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-6 py-16 sm:px-10">
        <button
          onClick={() => router.back()}
          className="mb-8 flex items-center gap-2 text-sm text-text-muted transition-colors duration-150 hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        {/* Identity header */}
        <Reveal>
          <div className="relative overflow-hidden rounded-lg border border-border bg-surface p-8">
            <div className="absolute inset-x-0 top-0 h-[2px] aurora-bg" />
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              {teacher.profile_photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={teacher.profile_photo_url}
                  alt={teacher.display_name}
                  className="h-24 w-24 shrink-0 rounded-full border border-border object-cover"
                />
              ) : (
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border border-border bg-surface-elevated font-mono text-xl font-semibold text-text-muted">
                  {getInitials(teacher.display_name)}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-balance font-display text-3xl font-semibold tracking-tight text-text-primary">
                    {teacher.display_name}
                  </h1>
                  {teacher.endorsed && (
                    <Badge variant="aurora" className="gap-1">
                      <Award className="h-3 w-3" aria-hidden="true" />
                      Hayesh Verified
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-text-muted">{teacher.tagline || "Verified teacher"}</p>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <RatingStars rating={reviewSummary?.average ?? teacher.average_rating} size="sm" />
                  {(reviewSummary?.count ?? teacher.total_reviews ?? 0) > 0 && (
                    <span className="font-mono text-xs tabular-nums text-text-muted">
                      ({reviewSummary?.count ?? teacher.total_reviews})
                    </span>
                  )}
                  {teacher.translation_enabled && <Badge variant="aurora">✦ Multilingual</Badge>}
                </div>

                {teacher.translation_enabled && translationLanguages.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {translationLanguages.map((lang) => (
                      <span
                        key={lang}
                        className="rounded-full border border-accent-primary/30 bg-accent-primary/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-accent-primary"
                      >
                        {lang}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Primary CTA — above the fold, always visible in the header. */}
            <Button
              variant="aurora"
              size="lg"
              className="mt-6 w-full sm:w-auto"
              onClick={() => setDemoModalOpen(true)}
            >
              Book a Free Demo
            </Button>
          </div>
        </Reveal>

        {/* Stats strip */}
        {statTiles.length > 0 && (
          <Reveal delay={0.03} className="mt-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {statTiles.map((tile) => (
                <div key={tile.label} className="rounded-lg border border-border bg-surface p-4 text-center">
                  <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">{tile.label}</p>
                  <p className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-text-primary">{tile.value}</p>
                </div>
              ))}
            </div>
          </Reveal>
        )}

        {/* Intro video */}
        {introVideoUrl && (
          <Reveal delay={0.05} className="mt-8">
            <span className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.12em] text-text-muted">
              <Video className="h-3.5 w-3.5" /> Intro Video
            </span>
            <div className="mt-3 aspect-video overflow-hidden rounded-lg border border-border bg-surface">
              {introIsDirectFile ? (
                <video controls className="h-full w-full bg-black object-contain" src={introVideoUrl}>
                  Your browser does not support the video tag.
                </video>
              ) : introEmbedUrl ? (
                <iframe
                  src={introEmbedUrl}
                  title={`${teacher.display_name} intro video`}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <a
                  href={introVideoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-full w-full items-center justify-center text-sm text-accent-secondary hover:underline"
                >
                  Watch intro video
                </a>
              )}
            </div>
          </Reveal>
        )}

        {/* Subjects */}
        {subs.length > 0 && (
          <Reveal delay={0.05} className="mt-8">
            <span className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Subjects</span>
            <div className="mt-3 flex flex-wrap gap-2">
              {subs.map((s) => (
                <span
                  key={s.subject}
                  className="rounded-full border border-border px-3 py-1 text-sm text-text-muted"
                >
                  {s.subject} <span className="text-text-disabled">· {s.level}</span>
                </span>
              ))}
            </div>
          </Reveal>
        )}

        {/* Education */}
        {education.length > 0 && (
          <Reveal delay={0.1} className="mt-8">
            <span className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.12em] text-text-muted">
              <GraduationCap className="h-3.5 w-3.5" /> Education
            </span>
            <div className="mt-3 divide-y divide-border rounded-lg border border-border bg-surface">
              {education.map((e, i) => (
                <div key={`${e.institution}-${i}`} className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text-primary">{e.degree}{e.field ? ` in ${e.field}` : ""}</p>
                    <p className="truncate text-sm text-text-muted">{e.institution}</p>
                  </div>
                  <span className="font-mono text-xs tabular-nums text-text-disabled">{e.year}</span>
                </div>
              ))}
            </div>
          </Reveal>
        )}

        {/* Experience */}
        {experience.length > 0 && (
          <Reveal delay={0.15} className="mt-8">
            <span className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.12em] text-text-muted">
              <Briefcase className="h-3.5 w-3.5" /> Experience
            </span>
            <div className="mt-3 divide-y divide-border rounded-lg border border-border bg-surface">
              {experience.map((e, i) => (
                <div key={`${e.institution}-${i}`} className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-medium text-text-primary">{e.title} · {e.institution}</p>
                    <span className="font-mono text-xs tabular-nums text-text-disabled">{e.years} yrs</span>
                  </div>
                  {e.description && <p className="mt-1 text-sm leading-relaxed text-text-muted">{e.description}</p>}
                </div>
              ))}
            </div>
          </Reveal>
        )}

        {/* Session Plans */}
        <Reveal delay={0.2} className="mt-8">
          <span className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Session Plans</span>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            {teacher.group_price_pkr && (
              <div className="rounded-lg border border-border bg-surface p-5 text-center">
                <p className="text-xs text-text-muted">Group Session</p>
                <p className="mt-2 font-mono text-lg font-semibold tabular-nums text-text-primary">{formatPKR(teacher.group_price_pkr)}</p>
              </div>
            )}
            {teacher.standard_price_pkr && (
              <div className="relative rounded-lg border border-accent-primary/50 bg-surface p-5 text-center">
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full border border-accent-primary/40 bg-background px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-accent-primary">
                  Recommended
                </span>
                <p className="text-xs text-text-muted">Standard</p>
                <p className="mt-2 font-mono text-lg font-semibold tabular-nums text-text-primary">{formatPKR(teacher.standard_price_pkr)}</p>
              </div>
            )}
            {teacher.private_price_pkr && (
              <div className="rounded-lg border border-border bg-surface p-5 text-center">
                <p className="text-xs text-text-muted">Private Session</p>
                <p className="mt-2 font-mono text-lg font-semibold tabular-nums text-text-primary">{formatPKR(teacher.private_price_pkr)}</p>
              </div>
            )}
          </div>
        </Reveal>

        {/* Reviews */}
        <Reveal delay={0.25} className="mt-8">
          <span className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Reviews</span>
          <div className="mt-3 flex flex-wrap items-center gap-4 rounded-lg border border-border bg-surface p-5 sm:gap-6">
            <p className="font-mono text-3xl font-semibold tabular-nums text-text-primary">
              {reviewSummary?.average ?? teacher.average_rating
                ? (reviewSummary?.average ?? teacher.average_rating)!.toFixed(1)
                : "—"}
            </p>
            <div>
              <p className="text-sm text-text-primary">Average rating</p>
              <RatingStars rating={reviewSummary?.average ?? teacher.average_rating} size="sm" className="mt-1" />
              <p className="mt-1 text-sm text-text-muted">
                {reviewSummary?.count ?? teacher.total_reviews ?? 0}{" "}
                {(reviewSummary?.count ?? teacher.total_reviews ?? 0) === 1 ? "review" : "reviews"}
              </p>
            </div>
          </div>

          <div className="mt-4">
            <ReviewList teacherId={teacherId} refreshKey={reviewRefreshKey} onSummaryChange={setReviewSummary} />
          </div>

          <div className="mt-4">
            <ReviewForm teacherId={teacherId} onSubmitted={() => setReviewRefreshKey((k) => k + 1)} />
          </div>
        </Reveal>

        {/* Testimonials — editorial, admin-curated quotes. Deliberately a
            separate section from Reviews above so the two are never
            confused: the component (including its own heading) renders
            nothing if there are no published testimonials for this teacher. */}
        <Reveal delay={0.27} className="mt-8">
          <TestimonialList subjectId={teacherId} subjectType="teacher" />
        </Reveal>

        {/* Availability */}
        {hasAvailability && (
          <Reveal delay={0.3} className="mt-8">
            <span className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.12em] text-text-muted">
              <CalendarClock className="h-3.5 w-3.5" /> Availability
            </span>
            <div className="mt-3 grid grid-cols-7 gap-2">
              {WEEKDAYS.map((day) => {
                const slots = availability[day.key] || []
                return (
                  <div key={day.key} className="rounded-lg border border-border bg-surface p-3 text-center">
                    <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">{day.label}</p>
                    <div className="mt-2 flex flex-col gap-1">
                      {slots.length > 0 ? (
                        slots.map((slot) => (
                          <span key={slot} className="rounded border border-accent-primary/30 bg-accent-primary/10 py-0.5 text-[10px] text-accent-primary">
                            {capitalize(slot)}
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-text-disabled">—</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </Reveal>
        )}

        {/* CTA */}
        <Reveal delay={0.35} className="mt-10">
          <Button variant="aurora" size="lg" className="w-full" onClick={() => setDemoModalOpen(true)}>
            Book a Free Demo
          </Button>
        </Reveal>
      </div>

      <DemoBookingModal
        open={demoModalOpen}
        onClose={() => setDemoModalOpen(false)}
        teacherId={teacherId}
        teacherName={teacher.display_name}
        subjects={subs}
      />
    </div>
  )
}
