import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { ThemeProvider } from "@/components/providers/ThemeProvider"
import { AuthSync } from "@/components/providers/AuthSync"
import { BrandingProvider } from "@/components/branding/BrandingProvider"
import { getBranding, buildBrandingStyleCss } from "@/lib/branding"
import { getSiteUrl } from "@/lib/utils/site-url"
import "./globals.css"

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
})

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
})

const SITE_DESCRIPTION =
  "Verified home tutors with a free demo lesson, monthly tuition plans, a freelance services marketplace, and instant HayeshAI Studio services."

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "Hayesh — Verified Tutors, Services & AI Studio",
    template: "%s · Hayesh",
  },
  description: SITE_DESCRIPTION,
  applicationName: "Hayesh",
  openGraph: {
    type: "website",
    siteName: "Hayesh",
    title: "Hayesh — Verified Tutors, Services & AI Studio",
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "Hayesh — Verified Tutors, Services & AI Studio",
    description: SITE_DESCRIPTION,
  },
  robots: { index: true, follow: true },
}

// Sets data-theme on <html> synchronously, before first paint, so there is
// no dark->light (or light->dark) flash while React hydrates. Mirrors the
// storage key and system-preference fallback used by ThemeProvider.
const NO_FLASH_THEME_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('hayesh-theme');
    var theme = stored === 'dark' || stored === 'light'
      ? stored
      : (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    document.documentElement.dataset.theme = theme;
  } catch (e) {
    document.documentElement.dataset.theme = 'dark';
  }
})();
`

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Read admin-configured branding on every request and turn it into an
  // inline stylesheet of CSS variable overrides. Rendered in <head> so it
  // themes SSR output with no flash and no client JS. See lib/branding.ts
  // for how each value is validated before it can reach this string.
  const branding = await getBranding()
  const brandingStyleCss = buildBrandingStyleCss(branding)

  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_THEME_SCRIPT }} />
        <style id="hayesh-branding" dangerouslySetInnerHTML={{ __html: brandingStyleCss }} />
      </head>
      <body className="min-h-screen bg-background font-body text-text-primary antialiased" suppressHydrationWarning>
        <BrandingProvider branding={branding}>
          <ThemeProvider>
            <AuthSync />
            {children}
          </ThemeProvider>
        </BrandingProvider>
      </body>
    </html>
  )
}
