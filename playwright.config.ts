import { defineConfig } from "@playwright/test"

// Drives the real built app (run `npm run build` first). Google is faked: see e2e/helpers.ts.
export default defineConfig({
  testDir: "e2e",
  timeout: 90000,
  expect: { timeout: 15000 },
  workers: 1, // each test is a whole app with its own window
  reporter: "list",
  outputDir: "test-results/playwright",
})
