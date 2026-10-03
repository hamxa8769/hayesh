import type { Metadata } from "next"
import Link from "next/link"
import { Mail, MessageCircle, LifeBuoy, MapPin } from "lucide-react"
import type { ReactNode } from "react"
import { Navbar } from "@/components/layout/Navbar"
import { LandingFooter } from "@/components/marketing/LandingFooter"
import { SITE_INFO, whatsAppDigits } from "@/lib/site-info"

export const metadata: Metadata = {
  title: "Contact | Hayesh",
  description: "Get in touch with Hayesh support for account, payment, order or lesson questions.",
}

function ContactCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <div className="flex items-center gap-3 text-text-primary">
        <span className="text-text-muted">{icon}</span>
        <h2 className="font-display text-lg font-semibold">{title}</h2>
      </div>
      <div className="mt-3 text-sm leading-relaxed text-text-muted">{children}</div>
    </div>
  )
}

export default function ContactPage() {
  const wa = whatsAppDigits(SITE_INFO.supportWhatsApp)

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl px-4 pb-24 pt-28 sm:px-6">
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Support</p>
        <h1 className="mt-3 text-balance font-display text-4xl font-bold tracking-tight">Contact us</h1>
        <p className="mt-4 max-w-[65ch] leading-relaxed text-text-muted">
          Questions about a payment, an order, a lesson or your account? Here is how to reach the Hayesh team. Please
          include your payment reference code (it looks like HYS-ABCD2345) if your question is about a payment.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <ContactCard icon={<LifeBuoy className="size-5" />} title="In-app Support">
            <p>The fastest way for account, order and payment issues.</p>
            <Link href="/auth/login?redirect=/messages" className="mt-3 inline-block text-accent-secondary underline">
              Sign in and open Support
            </Link>
          </ContactCard>

          {SITE_INFO.supportEmail && (
            <ContactCard icon={<Mail className="size-5" />} title="Email">
              <a href={`mailto:${SITE_INFO.supportEmail}`} className="break-all text-accent-secondary underline">
                {SITE_INFO.supportEmail}
              </a>
            </ContactCard>
          )}

          {wa && (
            <ContactCard icon={<MessageCircle className="size-5" />} title="WhatsApp">
              <a
                href={`https://wa.me/${wa}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-secondary underline"
              >
                Message us on WhatsApp
              </a>
            </ContactCard>
          )}

          {SITE_INFO.address && (
            <ContactCard icon={<MapPin className="size-5" />} title="Business address">
              <p className="whitespace-pre-line">{SITE_INFO.address}</p>
            </ContactCard>
          )}
        </div>

        {!SITE_INFO.supportEmail && !wa && (
          <p className="mt-6 text-sm text-text-muted">
            To reach us, please contact us through in-app Support.
          </p>
        )}

        <p className="mt-10 font-mono text-xs uppercase tracking-[0.12em] text-text-disabled">
          Typical response time: within 1 business day
        </p>
      </main>
      <LandingFooter />
    </div>
  )
}
