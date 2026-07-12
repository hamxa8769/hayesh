import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Reveal } from "@/components/motion/Reveal"

export function CtaBand() {
  return (
    <section className="py-24 sm:py-28">
      <div className="mx-auto w-full max-w-[1200px] px-6">
        <Reveal>
          <div className="relative overflow-hidden rounded-lg border border-border bg-surface p-12 text-center sm:p-16">
            <div className="aurora-bg absolute inset-x-0 top-0 h-[2px]" />
            <div
              className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full opacity-20 blur-3xl"
              style={{ background: "radial-gradient(circle, #27C4A0 0%, transparent 70%)" }}
            />
            <h2 className="relative text-balance font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Ready to start?
            </h2>
            <p className="relative mx-auto mt-4 max-w-lg text-text-muted">
              Join teachers, freelancers, and buyers already building on Hayesh.
            </p>
            <div className="relative mt-8 flex flex-wrap justify-center gap-4">
              <Button asChild variant="aurora" size="lg">
                <Link href="/auth/register?role=teacher">Become a teacher or seller</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/teachers">Find a teacher</Link>
              </Button>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
