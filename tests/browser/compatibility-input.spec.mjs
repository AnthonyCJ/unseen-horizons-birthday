import { test, expect } from "@playwright/test";
import { revisit, recordEnvironment, observeErrors, assertLayout } from "./compatibility-helpers.mjs";

test.use({ viewport: { width: 1440, height: 800 }, deviceScaleFactor: 2, reducedMotion: "reduce" });

test("reader keyboard focus stays contained and wheel scrolling reaches long text @input", async ({ page }, info) => {
  await revisit(page, 1);
  const reader = page.locator(".finding-reader");
  await page.locator("#finding-reader-title").press("Tab");
  await expect(page.locator(".finding-reader-back")).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.locator(".finding-reader-next button")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator(".finding-reader-back")).toBeFocused();
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press("Tab");
    expect(await reader.evaluate(el => el.contains(document.activeElement))).toBe(true);
  }
  await page.locator("#method-prompt-trigger").click();
  const scroll = page.locator(".finding-reader-scroll");
  const before = await scroll.evaluate(el => el.scrollTop);
  const bounds = await scroll.boundingBox();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.wheel(0, 800);
  await expect.poll(() => scroll.evaluate(el => el.scrollTop)).toBeGreaterThan(before);
  await page.locator("#finding-reader-title").press("Home");
  await expect.poll(() => scroll.evaluate(el => el.scrollTop)).toBe(0);
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".stage")).toHaveAttribute("data-page", "4");
  await expect(reader).toHaveAttribute("data-kind", "method");
  await assertLayout(page, info, "keyboard-reader");
  await page.keyboard.press("Escape");
  await expect(reader).toHaveCount(0);
  await expect(page.locator("#finding-toggle-1")).toBeFocused();
});

test("delayed local responses still reach editable content and a complete image preview @loading", async ({ page }, info) => {
  const errors = observeErrors(page);
  await page.route(/\.(?:js|jpg|woff2?|ttf|png|mp3)(?:\?|$)/, async route => {
    await new Promise(resolve => setTimeout(resolve, 200));
    await route.continue();
  });
  await revisit(page, 3);
  await page.locator("#inspiration-text").fill("加载慢一点，也能把想法留下。\nA thought worth keeping.");
  await page.getByRole("button", { name: "带走这张问题签", exact: true }).click();
  await expect(page.locator(".question-export-dialog img")).toBeVisible();
  await expect(page.locator(".question-export-dialog").getByRole("button", { name: "保存图片", exact: true })).toBeEnabled();
  const preview = page.locator(".question-export-preview");
  const previewBounds = await preview.boundingBox();
  await page.mouse.move(previewBounds.x + previewBounds.width / 2, previewBounds.y + previewBounds.height / 2);
  await page.mouse.wheel(0, 3000);
  await expect.poll(() => preview.evaluate(el => {
    const image = el.querySelector("img");
    return image.getBoundingClientRect().bottom <= el.getBoundingClientRect().bottom + 2;
  })).toBe(true);
  await recordEnvironment(page, info, { scenario: "200ms added per matched response; no bandwidth/CPU throttle; not a physical-device benchmark" });
  await info.attach("load-observations", { contentType: "application/json", body: JSON.stringify(await page.evaluate(() => ({
    navigation: performance.getEntriesByType("navigation").map(entry => ({ duration: entry.duration, domContentLoaded: entry.domContentLoadedEventEnd })),
    resources: performance.getEntriesByType("resource").map(entry => ({
      path: new URL(entry.name).pathname, duration: entry.duration, transferred: entry.transferSize, decoded: entry.decodedBodySize,
    })),
  })), null, 2) });
  expect(errors).toEqual([]);
});
