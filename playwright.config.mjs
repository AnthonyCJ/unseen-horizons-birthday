import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser", timeout: 45000, expect: { timeout: 12000 },
  fullyParallel: false, workers: process.env.CI ? 2 : 1, retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL: "http://127.0.0.1:4197", viewport: { width: 390, height: 844 }, reducedMotion: "reduce", screenshot: "only-on-failure", trace: "retain-on-failure", acceptDownloads: true },
  projects: ["chromium", "webkit", "firefox"].map((browserName) => ({ name: browserName, use: { browserName } })),
  webServer: { command: "node scripts/serve-static.mjs out --test-key --reduced-motion", url: "http://127.0.0.1:4197/unseen-horizons-birthday/", env: { PORT: "4197" }, reuseExistingServer: false, timeout: 20000 },
});
