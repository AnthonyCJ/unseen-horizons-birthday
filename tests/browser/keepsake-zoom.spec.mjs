import { test, expect } from "@playwright/test";
import { revisit, scene } from "./compatibility-helpers.mjs";

const sizes = [[1440, 800], [390, 844], [320, 568], [1024, 360]];
async function resize(page, width, height) {
  await page.setViewportSize({ width, height });
  await expect.poll(() => page.evaluate(() => [innerWidth, innerHeight])).toEqual([width, height]);
  // Viewport units and container units may settle after the resize protocol reply.
  // Wait for actual geometry, including the image, instead of sampling mid-reflow.
  await page.locator(".keepsake-stage:visible").evaluate(stage => new Promise((resolve, reject) => {
    let previous = "", stable = 0;
    const started = performance.now();
    const sample = () => {
      const s = stage.getBoundingClientRect(), i = stage.querySelector("img").getBoundingClientRect();
      const current = [s.width, s.height, i.width, i.height].join(",");
      stable = current === previous ? stable + 1 : 0; previous = current;
      if (stable >= 6) resolve();
      else if (performance.now() - started > 5000) reject(new Error("Image layout did not settle after resize"));
      else requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }));
}
async function dimensions(surface) {
  return surface.locator(".keepsake-stage").evaluate(stage => {
    const img = stage.querySelector("img"), box = img.getBoundingClientRect();
    return { width: box.width, height: box.height, ratio: img.naturalWidth / img.naturalHeight,
      viewportWidth: stage.clientWidth, viewportHeight: stage.clientHeight,
      pageOverflow: document.documentElement.scrollWidth - innerWidth };
  });
}

for (const kind of ["bookmark", "question", "postcard"]) test(`${kind} zoom stays moderate, reachable and reversible across window changes`, async ({ page }) => {
  await revisit(page, kind === "bookmark" ? 2 : 3);
  const draft = Array.from({ length: 17 }, (_, i) => `第${i + 1}行，愿好奇与从容始终相伴。`).join("\n");
  if (kind === "bookmark") await page.getByRole("button", { name: "看看书签", exact: true }).click();
  if (kind === "question") {
    await page.locator("#inspiration-text").fill(draft);
    await page.getByRole("button", { name: "带走这张问题签", exact: true }).click();
  }
  if (kind === "postcard") {
    await page.getByRole("button", { name: "去下一页 →", exact: true }).click(); await scene(page, 5);
    await page.getByRole("button", { name: "保存这份祝福", exact: true }).click();
  }
  const surface = page.locator(kind === "bookmark" ? ".bookmark-preview" : kind === "question" ? ".question-export-dialog" : ".postcard-dialog");
  await expect(surface.locator(".keepsake-primary")).toBeEnabled();
  const toggle = surface.locator(".keepsake-zoom"), stage = surface.locator(".keepsake-stage");
  const fits = [];
  for (const [width, height] of sizes) {
    await resize(page, width, height);
    fits.push(await dimensions(surface));
  }
  await toggle.focus(); await page.keyboard.press("Enter");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  for (const [index, [width, height]] of sizes.entries()) {
    await resize(page, width, height);
    const fit = fits[index], zoom = await dimensions(surface);
    await test.info().attach(`geometry-${width}x${height}`, { body: JSON.stringify({ fit, zoom }), contentType: "application/json" });
    expect(zoom.width / fit.width).toBeGreaterThan(1.3);
    expect(zoom.width / fit.width).toBeLessThanOrEqual(kind === "bookmark" ? 4 : 2.2);
    if (kind === "bookmark") expect(zoom.width).toBeGreaterThanOrEqual(200);
    expect(zoom.width / zoom.height).toBeCloseTo(zoom.ratio, 3);
    expect(Math.min(zoom.width, zoom.viewportWidth) * Math.min(zoom.height, zoom.viewportHeight) / (zoom.width * zoom.height)).toBeGreaterThan(kind === "bookmark" ? .27 : .43);
    expect(zoom.pageOverflow).toBeLessThanOrEqual(1);
    await stage.evaluate(el => el.scrollTo({ top: 0, left: 0, behavior: "instant" }));
    await stage.focus(); await page.keyboard.press("ArrowDown");
    if (zoom.height > zoom.viewportHeight + 1) await expect.poll(() => stage.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
    await expect.poll(() => stage.evaluate(el => {
      el.scrollTo({ top: el.scrollHeight, left: el.scrollWidth, behavior: "instant" });
      const image = el.querySelector("img").getBoundingClientRect(), box = el.getBoundingClientRect();
      return Math.max(image.right - box.left - el.clientLeft - el.clientWidth,
        image.bottom - box.top - el.clientTop - el.clientHeight);
    })).toBeLessThanOrEqual(1);
  }
  if (kind === "question") {
    await surface.getByRole("button", { name: "下一张", exact: true }).click();
    await expect(surface.getByRole("button", { name: "保存第 2 张", exact: true })).toBeEnabled();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => stage.evaluate(el => el.scrollTop)).toBe(0);
  }
  await toggle.focus(); await page.keyboard.press("Enter");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  const restored = await dimensions(surface);
  expect(restored.width).toBeCloseTo(fits.at(-1).width, 1);
  expect(restored.height).toBeLessThanOrEqual(restored.viewportHeight + 1);
  expect(restored.width).toBeLessThanOrEqual(restored.viewportWidth + 1);
  await page.keyboard.press("Escape"); await expect(surface).not.toBeVisible();
  if (kind === "question") await expect(page.locator("#inspiration-text")).toHaveValue(draft);
});
