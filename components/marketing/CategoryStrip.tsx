import Link from "next/link"
import { Reveal } from "@/components/motion/Reveal"
import { Stagger } from "@/components/motion/Stagger"

interface Category {
  label: string
  href: string
}

const CATEGORIES: Category[] = [
  { label: "Programming", href: "/marketplace?category=Programming" },
  { label: "Design", href: "/marketplace?category=Design" },
  { label: "Writing", href: "/marketplace?category=Writing" },
  { label: "Video", href: "/marketplace?category=Video" },
  { label: "Marketing", href: "/marketplace?category=Marketing" },
  { label: "Mathematics", href: "/teachers?subject=Mathematics" },
  { label: "Languages", href: "/teachers?subject=Languages" },
  { label: "Test Prep", href: "/teachers?subject=Test%20Prep" },
]

export function CategoryStrip() {
  return (
    <section className="border-y border-border bg-surface/30 py-10">
      <div className="mx-auto w-full max-w-[1200px] px-6">
        <Stagger className="flex flex-wrap items-center justify-center gap-2.5" staggerDelay={0.04}>
          {CATEGORIES.map((category) => (
            <Reveal key={category.label}>
              <Link
                href={category.href}
                className="inline-flex items-center rounded-full border border-border bg-surface px-4 py-2 font-mono text-xs uppercase tracking-[0.08em] text-text-muted transition-all duration-150 hover:border-accent-primary/40 hover:bg-surface-elevated hover:text-text-primary"
              >
                {category.label}
              </Link>
            </Reveal>
          ))}
        </Stagger>
      </div>
    </section>
  )
}
