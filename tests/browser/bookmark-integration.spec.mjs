import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import { revisit, openFinding, scene, recordEnvironment } from "./compatibility-helpers.mjs";

const bookmarkPath = "/unseen-horizons-birthday/keepsakes/iris-bookmark-2026.png";
const book = page => page.locator(".bookmark-preview");
const card = page => page.locator(".question-export-dialog");
async function saved(page, info, button, filename) {
  const pending = page.waitForEvent("download");
  await button.click();
  const download = await pending;
  const path = info.outputPath(filename);
  await download.saveAs(path);
  return { bytes: await readFile(path), name: download.suggestedFilename(), path };
}

for (const width of [1440, 390, 320]) test(`bookmark preserves artwork and reader position at ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: width === 1440 ? 800 : 744 });
  await revisit(page, 2);
  const opener = page.getByRole("button", { name: "看看书签", exact: true });
  await opener.scrollIntoViewIfNeeded();
  const prior = await page.locator(".finding-reader-scroll").evaluate(el => el.scrollTop);
  const entrance = page.url();
  await opener.focus(); await opener.press("Enter");
  await expect(book(page)).toBeVisible();
  await expect(book(page).getByRole("button", { name: "保存书签图片", exact: true })).toBeEnabled();
  await expect(book(page).getByRole("heading", { name: "鸢尾书签" })).toBeFocused();
  expect(page.url()).toBe(entrance);
  const geometry = await book(page).locator("img").evaluate(img => {
    const image = img.getBoundingClientRect(), stage = img.parentElement.getBoundingClientRect();
    return { natural: [img.naturalWidth, img.naturalHeight], contained: image.top >= stage.top - 1 && image.bottom <= stage.bottom + 1 && image.width <= stage.width + 1 };
  });
  expect(geometry).toEqual({ natural: [1080, 2880], contained: true });
  const file = await saved(page, info, book(page).getByRole("button", { name: "保存书签图片", exact: true }), "bookmark.png");
  expect(file.name).toBe("未知风光-鸢尾书签-2026.png");
  expect(createHash("sha256").update(file.bytes).digest("hex")).toBe("81f4365c27e06814d8961176154b624740af63ebe522bbd73b73aba19cf0490c");
  await book(page).screenshot({ path: info.outputPath("bookmark-preview.png") });
  await book(page).getByRole("button", { name: "放大细看", exact: true }).click();
  await expect(book(page).getByRole("button", { name: "看完整图片", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(await book(page).locator(".keepsake-stage").evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
  await book(page).getByRole("button", { name: "看完整图片", exact: true }).click();
  await book(page).getByRole("button", { name: "保存遇到困难？", exact: true }).click();
  await expect(book(page)).toContainText("是否进入相册取决于设备");
  await page.goBack();
  await expect(book(page)).toHaveCount(0);
  await expect(opener).toBeFocused();
  expect(await page.locator(".finding-reader-scroll").evaluate(el => el.scrollTop)).toBeCloseTo(prior, 0);
  expect(page.url()).toBe(entrance);
  await opener.click();
  await book(page).getByRole("button", { name: "返回这页体会", exact: true }).click();
  await expect(opener).toBeFocused();
  await opener.click(); await page.keyboard.press("Escape");
  await expect(opener).toBeFocused();
  await recordEnvironment(page, info, { scenario: "accepted PNG, nested reader, fit/zoom, browser Back/button/Escape" });
});

test("bookmark image and download failures recover without stale feedback", async ({ page }, info) => {
  await page.route(`**${bookmarkPath}*`, route => route.fulfill({ status: 404, body: "Unavailable" }));
  await revisit(page, 2);
  await page.getByRole("button", { name: "看看书签", exact: true }).click();
  await expect(book(page)).toContainText("书签暂时没能加载");
  await expect(book(page).getByRole("button", { name: "保存书签图片", exact: true })).toBeDisabled();
  await page.unroute(`**${bookmarkPath}*`);
  await book(page).getByRole("button", { name: "重新加载", exact: true }).click();
  await expect(book(page).getByRole("button", { name: "保存书签图片", exact: true })).toBeEnabled();
  await page.route(`**${bookmarkPath}`, route => route.fulfill({ status: 200, contentType: "text/html", body: "<p>Unavailable</p>" }));
  await book(page).getByRole("button", { name: "保存书签图片", exact: true }).click();
  await expect(book(page)).toContainText("暂时未能发起保存");
  await page.unroute(`**${bookmarkPath}`);
  await saved(page, info, book(page).getByRole("button", { name: "重试保存", exact: true }), "recovered-bookmark.png");
  await expect(book(page)).toContainText("已发起保存");
  await book(page).getByRole("button", { name: "返回这页体会", exact: true }).click();
  await page.getByRole("button", { name: "看看书签", exact: true }).click();
  await expect(book(page).locator(".keepsake-save-status")).toBeEmpty();
});

for (const mode of ["handwriting", "plain"]) test(`real ${mode} question PNG aligns the complete iris only on the first page`, async ({ page }, info) => {
  await revisit(page, 3);
  const text = Array.from({ length: 13 }, (_, i) => `第${i + 1}行，留下此刻的想法。`).join("\n");
  await page.locator("#inspiration-text").fill(text);
  const entrance = page.url();
  if (mode === "plain") await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    let failed = false;
    HTMLCanvasElement.prototype.getContext = function (...args) {
      if (!failed && args[0] === "2d") { failed = true; return null; }
      return original.apply(this, args);
    };
  });
  await page.getByRole("button", { name: "带走这张问题签", exact: true }).click();
  if (mode === "plain") await card(page).getByRole("button", { name: "先用清晰文字版", exact: true }).click();
  await expect(card(page)).toContainText("第 1 张，共 2 张");
  const first = await saved(page, info, card(page).getByRole("button", { name: "保存第 1 张", exact: true }), `${mode}-first.png`);
  expect(first.name).toBe(`Charlotte-question-2026-1${mode === "plain" ? "-text" : ""}.png`);
  const png = PNG.sync.read(first.bytes);
  let irisBottom = 0, irisPixels = 0, textBottom = 0;
  for (let y = 100; y < 460; y++) for (let x = 928; x < 1068; x++) {
    const offset = (y * png.width + x) * 4;
    if (Math.abs(png.data[offset] - 116) < 3 && Math.abs(png.data[offset + 1] - 134) < 3 && Math.abs(png.data[offset + 2] - 120) < 3) { irisPixels++; irisBottom = y; }
  }
  for (let y = 350; y < 460; y++) for (let x = 132; x < 900; x++) {
    const offset = (y * png.width + x) * 4;
    if (png.data[offset] < 90 && png.data[offset + 1] < 100 && png.data[offset + 2] < 90) textBottom = y;
  }
  await info.attach("actual-ink-alignment", { contentType: "application/json", body: JSON.stringify({ irisPixels, irisBottom, textBottom, delta: irisBottom - textBottom }) });
  // Solid-color pixel coverage varies with engine antialiasing (about 6,000 pixels).
  // Keep a small raster tolerance; the actual ink alignment remains within 2 px.
  expect(irisPixels).toBeGreaterThan(5800);
  expect(irisPixels).toBeLessThan(6300);
  expect(Math.abs(irisBottom - textBottom)).toBeLessThanOrEqual(2);
  await card(page).screenshot({ path: info.outputPath(`${mode}-preview.png`) });
  await card(page).getByRole("button", { name: "下一张", exact: true }).click();
  await expect(card(page)).toContainText("第 2 张，共 2 张");
  const second = await saved(page, info, card(page).getByRole("button", { name: "保存第 2 张", exact: true }), `${mode}-second.png`);
  expect(second.name).toBe(`Charlotte-question-2026-2${mode === "plain" ? "-text" : ""}.png`);
  const continuation = PNG.sync.read(second.bytes);
  let repeatedIris = 0;
  for (let y = 100; y < 460; y++) for (let x = 928; x < 1068; x++) {
    const offset = (y * continuation.width + x) * 4;
    if (Math.abs(continuation.data[offset] - 116) < 3 && Math.abs(continuation.data[offset + 1] - 134) < 3 && Math.abs(continuation.data[offset + 2] - 120) < 3) repeatedIris++;
  }
  expect(repeatedIris).toBe(0);
  await page.goBack();
  await expect(card(page)).not.toBeVisible();
  await expect(page.locator("#inspiration-text")).toHaveValue(text);
  expect(page.url()).toBe(entrance);
});

test("tail revisits the original directory and postcard shares fit/zoom and browser Back", async ({ page }, info) => {
  await revisit(page, 3);
  await page.getByRole("button", { name: "去下一页 →", exact: true }).click();
  await scene(page, 5);
  await page.getByRole("button", { name: "← 回看三件小东西", exact: true }).click();
  await scene(page, 4);
  await expect(page.locator(".finding-toggle")).toHaveCount(3);
  await expect(page.locator(".finding-reader-layer")).toHaveCount(0);
  await openFinding(page, 3);
  await page.getByRole("button", { name: "去下一页 →", exact: true }).click();
  await scene(page, 5);
  const opener = page.getByRole("button", { name: "保存这份祝福", exact: true });
  await opener.click();
  const preview = page.locator(".postcard-dialog");
  await expect(preview.getByRole("button", { name: "保存图片", exact: true })).toBeEnabled();
  const fittedWidth = await preview.locator("img").evaluate(img => img.getBoundingClientRect().width);
  await preview.getByRole("button", { name: "放大细看", exact: true }).click();
  await expect(preview.getByRole("button", { name: "看完整图片", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(await preview.locator("img").evaluate(img => img.getBoundingClientRect().width)).toBeGreaterThan(fittedWidth * 1.2);
  const download = await saved(page, info, preview.getByRole("button", { name: "保存图片", exact: true }), "postcard.png");
  const original = await readFile(new URL("../../public/keepsakes/unknown-horizons-2026.png", import.meta.url));
  expect(download.bytes.equals(original)).toBe(true);
  await page.goBack();
  await expect(preview).toHaveCount(0);
  await expect(opener).toBeFocused();
});
