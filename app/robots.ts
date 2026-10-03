import type { MetadataRoute } from "next"
import { getSiteUrl } from "@/lib/utils/site-url"

export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl()
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin", "/teacher/", "/parent/", "/seller/", "/buyer/", "/checkout/", "/meet/", "/auth/callback"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  }
}
