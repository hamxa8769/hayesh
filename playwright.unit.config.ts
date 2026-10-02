import { defineConfig } from "@playwright/test"

/** Fast, browserless unit tests for pure server logic (`npm run test:unit`). */
export default defineConfig({
  testDir: "./tests/unit",
  reporter: "list",
  workers: 4,
  outputDir: "test-results/unit",
})
