/**
 * Environment for the app under test. Defaults are the well-known PUBLIC
 * demo credentials every `supabase start` prints (they only work against a
 * local stack). Override with E2E_SUPABASE_* when your local keys differ.
 */
export const E2E_SUPABASE_URL = process.env.E2E_SUPABASE_URL ?? "http://127.0.0.1:54321"
export const E2E_ANON_KEY =
  process.env.E2E_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
export const E2E_SERVICE_KEY =
  process.env.E2E_SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(E2E_SUPABASE_URL)) {
  throw new Error("E2E tests must run against a local Supabase stack, never a hosted project")
}

export const E2E_ENV: Record<string, string> = {
  NEXT_PUBLIC_SUPABASE_URL: E2E_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: E2E_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: E2E_SERVICE_KEY,
  NEXT_PUBLIC_APP_URL: "http://localhost:3100",
  // 32 zero bytes, base64 — test-only key for field encryption.
  FIELD_ENCRYPTION_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
  CRON_SECRET: "e2e-cron-secret",
  ANTHROPIC_API_KEY: "e2e-mock-key",
  ANTHROPIC_BASE_URL: "http://127.0.0.1:4010",
}

export const PASSWORD = "E2e-Passw0rd!"
export const EMAIL = {
  admin: "admin@e2e.hayesh.test",
  parent: "parent@e2e.hayesh.test",
  teacher: "teacher@e2e.hayesh.test",
  seller: "seller@e2e.hayesh.test",
  buyer: "buyer@e2e.hayesh.test",
} as const
export type E2ERole = keyof typeof EMAIL
export const SEED_FILE = "tests/e2e/.seed.json"
