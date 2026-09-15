import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { METHOD_PROMPTS } from "../../lib/clarifying-prompt.mjs";
import { ENTRANCE, scene, revisit, openFinding, observeErrors, assertLayout } from "./compatibility-helpers.mjs";

test.use({ viewport: { width: 1440, height: 800 }, deviceScaleFactor: 2, reducedMotion: "reduce" });

test("entrance hash changes recover without revealing the gift at invalid URLs @recovery", async ({ page }) => {
  const errors = observeErrors(page);
  await page.goto("/unseen-horizons-birthday/");
  await expect(page.getByRole("heading", { name: "入口暂不可用", exact: true })).toBeVisible();
  await expect(page.locator("audio")).toHaveCount(0);
  await page.goto(ENTRANCE);
  await scene(page, 1);
  await page.goto("/unseen-horizons-birthday/#invalid");
  await expect(page.getByRole("heading", { name: "入口暂不可用", exact: true })).toBeVisible();
  await expect(page.locator("audio")).toHaveCount(0);
  await page.goBack();
  await scene(page, 1);
  expect(errors).toEqual([]);
});

test("method copy denial exposes complete selectable text; both TXT downloads match @recovery", async ({ page }, info) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "clipboard", { configurable: true,
    value: { writeText: async () => { throw new DOMException("Test denied", "NotAllowedError"); } } }));
  await revisit(page, 1);
  for (const language of ["zh", "en"]) {
    await page.getByRole("button", { name: language === "zh" ? "中文" : "English", exact: true }).click();
    await page.locator(".method-controls .prompt-copy-action").click();
    const original = page.locator("#method-manual-text");
    await expect(original).toHaveValue(METHOD_PROMPTS[language].prompt);
    await expect(page.locator("#method-copy-status")).toContainText("未能自动复制");
    await page.getByRole("button", { name: "全选原文", exact: true }).click();
    const selection = await original.evaluate(el => el.value.slice(el.selectionStart, el.selectionEnd));
    expect(selection).toBe(METHOD_PROMPTS[language].prompt);
    const pending = page.waitForEvent("download");
    await page.locator(".method-controls .prompt-save-action").click();
    const download = await pending;
    await download.saveAs(info.outputPath(`prompt-${language}.txt`));
    expect(await readFile(info.outputPath(`prompt-${language}.txt`), "utf8")).toBe(METHOD_PROMPTS[language].prompt);
    await page.getByRole("button", { name: "没有找到文件？", exact: true }).click();
    await expect(page.locator("#method-save-help-top")).toBeVisible();
    await assertLayout(page, info, `copy-denied-${language}`);
  }
});

test("both storage getters denied still allow the complete gift and an editable draft @recovery", async ({ page }) => {
  const errors = observeErrors(page);
  await page.addInitScript(() => {
    for (const name of ["localStorage", "sessionStorage"]) Object.defineProperty(window, name, {
      configurable: true, get() { throw new DOMException("Test private storage unavailable", "SecurityError"); },
    });
  });
  await page.goto(ENTRANCE);
  await page.getByRole("button", { name: "翻开手记", exact: true }).click();
  await scene(page, 3);
  await page.getByRole("button", { name: "继续翻阅", exact: true }).click();
  await scene(page, 4);
  await openFinding(page, 3);
  const input = page.locator("#inspiration-text");
  await input.fill("Private mode still lets me write. 私密模式也能填写。");
  await expect(input).toHaveValue("Private mode still lets me write. 私密模式也能填写。");
  await expect(page.locator("#inspiration-storage")).toContainText("暂存不可用");
  await input.press("Escape");
  await openFinding(page, 3);
  await expect(input).toHaveValue("Private mode still lets me write. 私密模式也能填写。");
  await page.getByRole("button", { name: "去下一页 →", exact: true }).click();
  await scene(page, 5);
  expect(errors).toEqual([]);
});

test("failed artwork and fonts keep navigation and readable input available @recovery", async ({ page }) => {
  const errors = observeErrors(page);
  await page.route(/\/assets\/healing-.*\.jpg/, route => route.abort());
  await page.route(/\.(?:woff2?|ttf)(?:\?|$)/, route => route.abort());
  await revisit(page, 3);
  await expect(page.locator("#inspiration-font")).toContainText("暂时没准备好");
  await page.locator("#inspiration-text").fill("字迹回退时仍可继续。Fallback text remains readable.");
  await expect(page.locator("#inspiration-text")).toHaveValue("字迹回退时仍可继续。Fallback text remains readable.");
  await page.getByRole("button", { name: "去下一页 →", exact: true }).click();
  await scene(page, 5);
  await page.getByRole("button", { name: "重新翻阅", exact: true }).click();
  await scene(page, 1);
  expect(errors).toEqual([]);
});

test("postcard image and save failures offer retry and original-image fallback @recovery", async ({ page }) => {
  let failImage = true, failFetch = false;
  await page.route("**/keepsakes/unknown-horizons-2026.png*", route =>
    (route.request().resourceType() === "image" ? failImage : failFetch) ? route.abort() : route.continue());
  await revisit(page, 3);
  await page.getByRole("button", { name: "去下一页 →", exact: true }).click();
  await scene(page, 5);
  await page.getByRole("button", { name: "保存这份祝福", exact: true }).click();
  const dialog = page.locator(".postcard-dialog");
  await expect(dialog.getByRole("button", { name: "重新加载", exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "保存图片", exact: true })).toBeDisabled();
  failImage = false;
  await dialog.getByRole("button", { name: "重新加载", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "保存图片", exact: true })).toBeEnabled();
  failFetch = true;
  await dialog.getByRole("button", { name: "保存图片", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "重试保存", exact: true })).toBeEnabled();
  await expect(dialog.getByRole("link", { name: "打开原图", exact: true })).toHaveAttribute("href", /\.png$/);
  failFetch = false;
  const pending = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "重试保存", exact: true }).click();
  const download = await pending;
  expect(await download.failure()).toBeNull();
});

test("music policy rejection never blocks navigation and can be retried @recovery", async ({ page }) => {
  await page.addInitScript(() => {
    HTMLMediaElement.prototype.play = function () { return Promise.reject(new DOMException("Test autoplay denied", "NotAllowedError")); };
  });
  await page.goto(ENTRANCE);
  await page.getByRole("button", { name: "翻开手记", exact: true }).click();
  await scene(page, 3);
  await expect(page.getByRole("button", { name: /^播放音乐/ })).toBeEnabled();
  await page.getByRole("button", { name: /^播放音乐/ }).click();
  await expect(page.getByRole("button", { name: /^播放音乐/ })).toBeEnabled();
  await page.getByRole("button", { name: "继续翻阅", exact: true }).click();
  await scene(page, 4);
});

test("pending music startup has a deadline and leaves a usable retry @recovery", async ({ page }) => {
  // Keep the 16-second recovery assertion below; browser startup has its own
  // budget and must not consume the media deadline on the Windows WebKit build.
  test.setTimeout(60000);
  await page.addInitScript(() => {
    window.pendingMusic = [];
    HTMLMediaElement.prototype.play = function () { return new Promise(resolve => window.pendingMusic.push(resolve)); };
  });
  await page.goto(ENTRANCE);
  await page.getByRole("button", { name: "翻开手记", exact: true }).click();
  await scene(page, 3);
  await expect(page.getByRole("button", { name: /^播放音乐/ })).toBeEnabled({ timeout: 16000 });
  await page.getByRole("button", { name: /^播放音乐/ }).click();
  await page.evaluate(() => window.pendingMusic[0]());
  await expect(page.getByRole("button", { name: /^音乐加载中/ })).toBeDisabled();
  await page.getByRole("button", { name: "继续翻阅", exact: true }).click();
  await scene(page, 4);
});
