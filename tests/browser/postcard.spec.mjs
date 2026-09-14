import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { PNG } from "pngjs";
import render from "../../lib/postcard-render.json" with { type: "json" };

// Check the visible ink in the saved bitmap, not only the CSS declarations.
// The old full-em punctuation advance produced a tall face and fails this check.
function expectCompactSmile(image, { bounds, fontSize }) {
  let left = image.width, top = image.height, right = -1, bottom = -1;
  const padding = Math.ceil(fontSize * .3);
  for (let y = Math.max(0, Math.floor(bounds.top) - padding); y < Math.min(image.height, Math.ceil(bounds.bottom) + padding); y++) {
    for (let x = Math.max(0, Math.floor(bounds.left) - padding); x < Math.min(image.width, Math.ceil(bounds.right) + padding); x++) {
      const offset = (y * image.width + x) * 4;
      if (image.data[offset] < 180 && image.data[offset + 1] < 180 && image.data[offset + 2] < 190) {
        left = Math.min(left, x); right = Math.max(right, x);
        top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
    }
  }
  const width = right - left + 1, height = bottom - top + 1;
  expect(width).toBeGreaterThan(fontSize * .65);
  expect(height / width).toBeGreaterThan(.4);
  expect(height / width).toBeLessThan(.85);
}

test("the unified handwriting postcard previews and downloads the same complete PNG", async ({ page }, info) => {
  await page.addInitScript(() => localStorage.setItem("unseen-horizons-birthday:2026:reading:v2", JSON.stringify({ version: 2, overview: true, opened: 7 })));
  await page.goto("/unseen-horizons-birthday/#/open/birthday_review_2026_local_test0");
  await page.getByRole("button", { name: "回看三件小东西", exact: true }).click();
  await page.locator("#finding-toggle-3").click();
  await page.getByRole("button", { name: "去下一页 →", exact: true }).click();
  const opener = page.getByRole("button", { name: "保存这份祝福", exact: true });
  await opener.focus();
  await opener.press("Enter");
  const dialog = page.getByRole("dialog", { name: "留一张明信片" });
  await expect(dialog.locator("img")).toBeVisible();
  const pending = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "保存图片", exact: true }).click();
  const download = await pending;
  await download.saveAs(info.outputPath("postcard.png"));
  const saved = await readFile(info.outputPath("postcard.png"));
  const source = await readFile(new URL("../../public/keepsakes/unknown-horizons-2026.png", import.meta.url));
  expect(saved.equals(source)).toBe(true);
  const image = PNG.sync.read(saved);
  expect([image.width, image.height]).toEqual([1800, 1200]);
  expectCompactSmile(image, render.geometry.smile);
  await expect(dialog).toContainText("已发起保存");
  await dialog.screenshot({ path: info.outputPath("postcard-preview.png") });
  await dialog.getByRole("button", { name: "关闭预览", exact: true }).click();
  await expect(page.getByRole("button", { name: "保存这份祝福", exact: true })).toBeFocused();

  // Render the source independently so a font change cannot be hidden by the
  // pre-rendered PNG. This also provides a lossless 1800 x 1200 build artifact.
  const html = await readFile(new URL("../../scripts/postcard.html", import.meta.url), "utf8");
  await page.route("**/postcard-source.html", (route) => route.fulfill({ status: 200, contentType: "text/html", body: html }));
  await page.setViewportSize({ width: 1800, height: 1200 });
  await page.goto("/postcard-source.html");
  await expect(page.locator(".postcard-sheet")).toHaveAttribute("data-fonts-ready", "true");
  const families = await page.locator(".postcard-title, .postcard-note p, .postcard-signature").evaluateAll((elements) => elements.map((el) => getComputedStyle(el).fontFamily));
  expect(new Set(families).size).toBe(1);
  expect(families[0]).toContain("Birthday Postcard Ink");
  const signatureCenterDifference = await page.evaluate(() => {
    const name = document.querySelector(".postcard-recipient").getBoundingClientRect();
    const signature = document.querySelector(".postcard-signature").getBoundingClientRect();
    return Math.abs(name.left + name.width / 2 - signature.left - signature.width / 2);
  });
  expect(signatureCenterDifference).toBeLessThan(.25);
  expect(await page.locator("#birthday-postcard-note").evaluate((el) => [el.scrollWidth, el.scrollHeight])).toEqual([1800, 1200]);
  const geometry = await page.evaluate(() => {
    const sheet = document.querySelector(".postcard-sheet").getBoundingClientRect();
    const mark = document.querySelector(".postcard-smile-mark").getBoundingClientRect();
    const eyes = document.querySelector(".postcard-smile-eyes").getBoundingClientRect();
    const mouth = document.querySelector(".postcard-smile-mouth").getBoundingClientRect();
    const fontSize = parseFloat(getComputedStyle(document.querySelector(".postcard-smile")).fontSize);
    return { sheet: sheet.toJSON(), bounds: mark.toJSON(), fontSize, advance: (mouth.top - eyes.top) / fontSize };
  });
  expect(geometry.sheet.left).toBeGreaterThan(20);
  expect(geometry.sheet.top).toBeGreaterThan(12);
  expect(geometry.sheet.right).toBeLessThan(1780);
  expect(geometry.sheet.bottom).toBeLessThan(1182);
  expect(geometry.sheet.width / geometry.sheet.height).toBeCloseTo(1.5, 2);
  expect(geometry.advance).toBeCloseTo(.5, 2);
  const rendered = await page.screenshot({ path: info.outputPath("postcard-source.png"), fullPage: true });
  expectCompactSmile(PNG.sync.read(rendered), geometry);
});
