import { defineConfig, devices } from "@playwright/test";

/**
 * The doctor's journey (scope section 9.2) against a running CaviNet: `make up`, then
 * `make e2e`. E2E_BASE_URL points elsewhere; E2E_CHROMIUM uses an installed Chromium
 * instead of Playwright's own download.
 */
export default defineConfig({
  testDir: "tests",
  timeout: 10 * 60_000, // the analysis of the synthetic scan runs on the CPU
  expect: { timeout: 20_000 },
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:8080",
    viewport: { width: 1366, height: 900 }, // NFR-5: at least 1280 px wide
    timezoneId: process.env.E2E_TIMEZONE ?? "Asia/Karachi", // the team's time zone
    acceptDownloads: true,
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: process.env.E2E_CHROMIUM ? { executablePath: process.env.E2E_CHROMIUM } : {},
  },
});
