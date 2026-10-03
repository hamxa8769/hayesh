import { defineConfig, devices } from "@playwright/test"
import { E2E_ENV } from "./tests/e2e/env"

/**
 * End-to-end tests against a LOCAL Supabase stack (`supabase start`) — never
 * against production. See tests/e2e/README.md.
 */
const PORT = 3100

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : undefined,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node tests/e2e/mock-anthropic.mjs",
      port: 4010,
      reuseExistingServer: true,
    },
    {
      command: process.env.E2E_SKIP_BUILD ? `npx next start -p ${PORT}` : `npx next build && npx next start -p ${PORT}`,
      port: PORT,
      timeout: 600_000,
      reuseExistingServer: !process.env.CI,
      env: E2E_ENV,
    },
  ],
})
