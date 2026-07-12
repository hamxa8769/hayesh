import Link from "next/link"

interface FooterLink {
  label: string
  href: string
}

interface FooterColumn {
  title: string
  links: FooterLink[]
}

const FOOTER_COLUMNS: FooterColumn[] = [
  {
    title: "Product",
    links: [
      { label: "Find a teacher", href: "/teachers" },
      { label: "Marketplace", href: "/marketplace" },
      { label: "HayeshAI Studio", href: "/ai-services" },
    ],
  },
  {
    title: "For teachers",
    links: [
      { label: "Become a teacher", href: "/auth/register?role=teacher" },
      { label: "Teacher sign in", href: "/auth/login" },
    ],
  },
  {
    title: "For sellers",
    links: [
      { label: "Become a seller", href: "/auth/register?role=seller" },
      { label: "Seller sign in", href: "/auth/login" },
    ],
  },
]

export function LandingFooter() {
  return (
    <footer className="border-t border-border bg-surface/40">
      <div className="mx-auto w-full max-w-[1200px] px-6 py-16">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
          <div className="max-w-xs">
            <span className="aurora-text font-display text-xl font-bold">HAYESH</span>
            <p className="mt-3 text-sm leading-relaxed text-text-muted">
              The tutoring-first marketplace for verified teachers, freelance experts, and
              Claude-powered AI services.
            </p>
          </div>

          {FOOTER_COLUMNS.map((column) => (
            <div key={column.title}>
              <h3 className="font-mono text-xs uppercase tracking-[0.12em] text-text-disabled">{column.title}</h3>
              <ul className="mt-4 space-y-3">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-text-muted transition-colors duration-150 hover:text-text-primary"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 sm:flex-row">
          <p className="text-sm text-text-muted">&copy; 2026 Hayesh. All rights reserved.</p>
          <p className="font-mono text-xs uppercase tracking-[0.1em] text-text-disabled">
            Built for tutors, freelancers &amp; AI agents
          </p>
        </div>
      </div>
    </footer>
  )
}
