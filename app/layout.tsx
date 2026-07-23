import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { ThemeProvider } from "@/components/providers/ThemeProvider"
import { BrandingProvider } from "@/components/branding/BrandingProvider"
import { getBranding, buildBrandingStyleCss } from "@/lib/branding"
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

export const metadata: Metadata = {
  title: "Hayesh — Tutoring Marketplace Platform",
  description: "Connect with verified teachers, buy services, and leverage AI-powered tools.",
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
          <ThemeProvider>{children}</ThemeProvider>
        </BrandingProvider>
      </body>
    </html>
  )
}
