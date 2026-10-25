import { test, expect } from "@playwright/test";
import { revisit, scene, reachable, observeErrors, recordEnvironment } from "./compatibility-helpers.mjs";

const sizes = [[1440, 800], [390, 844], [320, 568], [1024, 360]];
for (const [width, height] of sizes) test(`keepsake titles and operations stay aligned and reachable at ${width}x${height}`, async ({ page }, info) => {
  await page.setViewportSize({ width, height });
  const errors = observeErrors(page), fonts = [];
  for (const kind of ["bookmark", "question", "postcard"]) {
    // Navigating to the same fragment can retain the previous page's reader.
    await page.goto(`/unseen-horizons-birthday/?ux01-reset=${kind}`);
    await revisit(page, kind === "bookmark" ? 2 : 3);
    if (kind === "question") {
      await page.locator("#inspiration-text").fill(Array.from({ length: 13 }, (_, i) => `第${i + 1}行，留下此刻的想法。`).join("\n"));
      await page.getByRole("button", { name: "带走这张问题签", exact: true }).click();
    } else if (kind === "postcard") {
      await page.getByRole("button", { name: "去下一页 →", exact: true }).click();
      await scene(page, 5);
      await page.getByRole("button", { name: "保存这份祝福", exact: true }).click();
    } else {
      const entry = page.getByRole("button", { name: "看看书签", exact: true });
      await reachable(entry);
      expect(await entry.evaluate(el => getComputedStyle(el).borderTopStyle)).toBe("solid");
      await entry.click();
    }
    const surface = page.locator(kind === "bookmark" ? ".bookmark-preview" : `.${kind === "question" ? "question-export" : "postcard"}-dialog`);
    const save = surface.locator(".keepsake-primary"), back = surface.locator(".keepsake-back");
    await expect(save).toBeEnabled();
    await expect(surface.locator(".keepsake-stage img")).toBeVisible();
    const geometry = await surface.evaluate(el => {
      const header = el.querySelector(".keepsake-header").getBoundingClientRect();
      const title = el.querySelector(".keepsake-title"), titleBox = title.getBoundingClientRect();
      const back = el.querySelector(".keepsake-back").getBoundingClientRect();
      const zoom = el.querySelector(".keepsake-zoom").getBoundingClientRect();
      const stage = el.querySelector(".keepsake-stage").getBoundingClientRect();
      const body = el.querySelector(".keepsake-body"), style = getComputedStyle(title);
      return { header: header.toJSON(), title: titleBox.toJSON(), back: back.toJSON(), zoomRight: zoom.right,
        stageRight: stage.right, horizontalOverflow: body.scrollWidth - body.clientWidth,
        pageOverflow: document.documentElement.scrollWidth - innerWidth,
        font: [style.fontFamily, style.fontSize, style.fontWeight, style.lineHeight],
        targetHeights: [...el.querySelectorAll("button,a")].filter(n => n.getClientRects().length).map(n => n.getBoundingClientRect().height) };
    });
    expect(geometry.header.top).toBeGreaterThanOrEqual(0);
    expect(geometry.header.bottom).toBeLessThanOrEqual(height);
    expect(geometry.title.right).toBeLessThanOrEqual(geometry.back.left - 5);
    expect(geometry.horizontalOverflow).toBeLessThanOrEqual(1);
    expect(geometry.pageOverflow).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry.zoomRight - geometry.stageRight)).toBeLessThanOrEqual(1);
    expect(geometry.targetHeights.every(h => h >= 43.9)).toBe(true);
    expect(geometry.font[1]).toBe(width <= 640 ? "16px" : "18px");
    expect(geometry.font[2]).toBe("400");
    fonts.push(geometry.font);
    await surface.screenshot({ path: info.outputPath(`${kind}-${width}x${height}.png`) });
    await info.attach(`${kind}-geometry`, { body: JSON.stringify(geometry, null, 2), contentType: "application/json" });
    await reachable(save);
    const after = await back.boundingBox();
    expect(after.y).toBeCloseTo(geometry.back.y, 0);
    await back.focus(); await page.keyboard.press("Tab");
    const zoom = surface.getByRole("button", { name: "放大细看", exact: true });
    await expect(zoom).toBeFocused();
    expect(await zoom.evaluate(el => getComputedStyle(el).outlineStyle)).toBe("solid");
    await page.keyboard.press("Enter");
    await expect(zoom).toHaveCount(0);
    await expect(surface.getByRole("button", { name: "看完整图片", exact: true })).toHaveAttribute("aria-pressed", "true");
    await back.click();
    await expect(surface).not.toBeVisible();
  }
  expect(fonts[1]).toEqual(fonts[0]);
  expect(fonts[2]).toEqual(fonts[0]);
  expect(errors).toEqual([]);
  await recordEnvironment(page, info, { scenario: "UX-01 three keepsakes, visible controls, fixed header, keyboard zoom" });
});

test("touch can discover, enlarge and return from a bookmark without hovering", async ({ browser }, info) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, reducedMotion: "reduce", baseURL: test.info().project.use.baseURL });
  try {
    const page = await context.newPage();
    await revisit(page, 2);
    const entry = page.getByRole("button", { name: "看看书签", exact: true });
    await entry.tap();
    const book = page.locator(".bookmark-preview");
    await expect(book.locator(".keepsake-primary")).toBeEnabled();
    await book.getByRole("button", { name: "放大细看", exact: true }).tap();
    await expect(book.getByRole("button", { name: "看完整图片", exact: true })).toHaveAttribute("aria-pressed", "true");
    await book.getByRole("button", { name: "返回这页体会", exact: true }).tap();
    await expect(entry).toBeFocused();
    await recordEnvironment(page, info, { scenario: "touch emulation only; not a physical-device result" });
  } finally { await context.close(); }
});
