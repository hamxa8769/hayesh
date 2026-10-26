import { MfaEnrollment } from "@/components/admin/MfaEnrollment"
import { Reveal } from "@/components/motion/Reveal"

export const metadata = { title: "Security" }

export default async function AdminSecurityPage({ searchParams }: { searchParams: Promise<{ setup?: string }> }) {
  const { setup } = await searchParams
  return (
    <div className="max-w-2xl space-y-8">
      <Reveal>
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Admin / Security</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-text-primary sm:text-3xl">Two-factor authentication</h1>
      </Reveal>
      {setup === "1" && (
        <div role="status" className="rounded-lg border border-accent-warning/40 bg-accent-warning/5 p-4 text-sm text-text-primary">
          Two-factor authentication is required for admin accounts. Set it up below to continue.
        </div>
      )}
      <MfaEnrollment />
    </div>
  )
}
