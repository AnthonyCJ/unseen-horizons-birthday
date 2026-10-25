import { defineConfig } from "@playwright/test";
import base from "./playwright.config.mjs";

// Bounded release gate; the broader suite remains separately available.
// WebKit/mobile emulation is not actual Safari/physical-device certification.
const coreCases = [
  "(?:desktop-default|desktop-more-space|desktop-larger-text|desktop-largest-text|external-desktop|mobile-portrait|mobile-landscape|mobile-narrow): all pages",
  "normal motion: first visit completes all five pages and replay",
  "normal motion 390: modal focus, resize, and preference changes",
  "entrance hash changes recover", "method copy denial exposes complete selectable text",
  "bookmark preserves artwork and reader position at 390px",
  "real handwriting question PNG aligns", "tail revisits the original directory",
  "(?:bookmark|question|postcard) zoom stays moderate", "refresh restores exact whitespace",
  "finding complete sequences replay on first entry",
  "release: bilingual prompt payloads, guides and TXT downloads",
];
export default defineConfig({
  ...base,
  testMatch: ["compatibility-layout.spec.mjs", "compatibility-journey.spec.mjs",
    "compatibility-recovery.spec.mjs", "bookmark-integration.spec.mjs",
    "keepsake-zoom.spec.mjs", "question-card.spec.mjs", "finding-replay.spec.mjs", "release-prompt.spec.mjs"],
  grep: new RegExp(coreCases.join("|")),
  outputDir: "./test-results/release-verification",
  reporter: [["list"], ["json"], ["html", { open: "never", outputFolder: "playwright-report/release-verification" }]],
  projects: [
    { name: "webkit", use: { browserName: "webkit" } },
    { name: "chrome", use: { browserName: "chromium", channel: "chrome" } },
  ],
});
