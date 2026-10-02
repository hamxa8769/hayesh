import { Navbar } from "@/components/layout/Navbar"
import { LandingFooter } from "@/components/marketing/LandingFooter"

/**
 * Public site chrome (top navigation + footer) for browse pages such as
 * /marketplace, /teachers and their detail pages, so visitors and signed-in
 * users always have a way to navigate on — never a dead end.
 */
export function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="flex-1 pt-16">{children}</main>
      <LandingFooter />
    </div>
  )
}
