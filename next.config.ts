import type { NextConfig } from "next";

// Baseline security headers for every route. A strict CSP is intentionally
// not set yet: the app loads LiveKit (wss), Supabase, Stripe and inline
// theme/branding scripts, so a CSP needs its own tested rollout.
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Meetings need camera/mic/screen-share on our own origin only.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), display-capture=(self), geolocation=()" },
];

const nextConfig: NextConfig = {
  /* Optimized for Vercel deployment */
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
      {
        protocol: "https",
        hostname: "**.supabase.in",
      },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
