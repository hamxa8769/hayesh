import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";
import { buildCsp } from "./lib/security/csp";

// Baseline security headers for every route. The CSP ships as Report-Only so
// nothing breaks at launch; flip the header name to enforce once reports are clean.
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Meetings need camera/mic/screen-share on our own origin only.
  { key: "Content-Security-Policy-Report-Only", value: buildCsp({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_LIVEKIT_URL: process.env.NEXT_PUBLIC_LIVEKIT_URL,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    SENTRY_DSN: process.env.SENTRY_DSN,
  }) },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), display-capture=(self), geolocation=()" },
];

const nextConfig: NextConfig = {
  /* Optimized for Vercel deployment */
  poweredByHeader: false,
  // Lets a local `next dev` use its own output folder (NEXT_DIST_DIR=.next-dev)
  // so it never overwrites a production build being served from `.next`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
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

const hasSentryAuth = Boolean(process.env.SENTRY_AUTH_TOKEN);

// Everything Sentry does at build time is skipped silently without an auth token.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  telemetry: false,
  sourcemaps: { disable: !hasSentryAuth, deleteSourcemapsAfterUpload: true },
  bundleSizeOptimizations: { excludeDebugStatements: true },
  suppressOnRouterTransitionStartWarning: true,
});
