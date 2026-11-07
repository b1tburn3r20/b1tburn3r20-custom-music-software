import { defineConfig } from "@playwright/test"

// Drives the real built app (run `npm run build` first). Google is faked: see e2e/helpers.ts.
export default defineConfig({
  testDir: "e2e",
  timeout: 90000,
  expect: { timeout: 15000 },
  workers: 1, // each test is a whole app with its own window
  // GitHub only shows a run's logs to signed-in users, but its annotations are public.
  reporter: process.env.CI ? [["list"], ["github"]] : "list",
  outputDir: "test-results/playwright",
})
