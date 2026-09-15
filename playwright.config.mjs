import { defineConfig } from "@playwright/test";
const port = process.env.GIFT_TEST_PORT ?? "4197";
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: "./tests/browser", timeout: 60000, expect: { timeout: 12000 },
  outputDir: "./test-results/browser-regression",
  fullyParallel: false, workers: process.env.CI ? 2 : 1, retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report/browser-regression" }]],
  use: { baseURL, viewport: { width: 390, height: 844 }, reducedMotion: "reduce", screenshot: "only-on-failure", trace: "retain-on-failure", acceptDownloads: true },
  projects: ["webkit", "chromium", "firefox"].map((browserName) => ({ name: browserName, use: { browserName } })),
  // Each test context selects its own motion preference. Rewriting responses
  // globally would silently turn normal-motion regression tests into shortcuts.
  webServer: { command: "node scripts/serve-static.mjs out --test-key", url: `${baseURL}/unseen-horizons-birthday/`, env: { PORT: port }, reuseExistingServer: false, timeout: 20000 },
});
