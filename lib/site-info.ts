export interface SiteInfo {
  legalName: string
  supportEmail: string | null
  supportWhatsApp: string | null
  address: string | null
  jurisdiction: string
  lastUpdated: string
}

export const SITE_INFO: SiteInfo = {
  legalName: process.env.NEXT_PUBLIC_LEGAL_NAME ?? "Hayesh",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? null,
  supportWhatsApp: process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? null,
  address: process.env.NEXT_PUBLIC_BUSINESS_ADDRESS ?? null,
  jurisdiction: "Pakistan",
  lastUpdated: "2 October 2026",
}

/** Digits-only WhatsApp number for wa.me links, or null. */
export function whatsAppDigits(value: string | null): string | null {
  if (!value) return null
  const digits = value.replace(/\D/g, "")
  return digits.length > 0 ? digits : null
}
