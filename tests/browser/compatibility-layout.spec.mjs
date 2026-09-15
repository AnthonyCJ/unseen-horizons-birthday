import { test, expect } from "@playwright/test";
import { COMPATIBILITY_PROFILES, profileContext } from "../compatibility-profiles.mjs";
import { ENTRANCE, recordEnvironment, observeErrors, scene, openFinding, nextFinding, assertLayout, reachable } from "./compatibility-helpers.mjs";

for (const profile of COMPATIBILITY_PROFILES) {
  test(`${profile.id}: all pages and reader controls remain reachable @layout`, async ({ browser, browserName, baseURL }, info) => {
    const context = await browser.newContext({ baseURL, ...profileContext(profile, browserName), reducedMotion: "reduce" });
    const page = await context.newPage();
    const errors = observeErrors(page);
    try {
      await page.goto(ENTRANCE);
      await scene(page, 1);
      await recordEnvironment(page, info, { profile, method: "viewport/DPR emulation; not physical hardware or browser UI zoom" });
      await assertLayout(page, info, "cover");
      await page.getByRole("button", { name: "翻开手记", exact: true }).click();
      await scene(page, 3);
      await assertLayout(page, info, "letter");
      await page.getByRole("button", { name: "继续翻阅", exact: true }).click();
      await scene(page, 4);
      await assertLayout(page, info, "overview");
      await openFinding(page, 1);
      await page.locator("#method-prompt-trigger").click();
      await reachable(page.locator("#method-prompt-panel").getByRole("button", { name: /保存/ }));
      await assertLayout(page, info, "method-expanded");
      await nextFinding(page);
      await expect(page.getByRole("heading", { name: "Harness Self", exact: true })).toBeVisible();
      await assertLayout(page, info, "attention");
      await nextFinding(page);
      const input = page.locator("#inspiration-text");
      await input.fill("此刻，保持好奇。\nA little room for tomorrow.");
      await input.press("ArrowLeft");
      await expect(page.locator(".finding-reader")).toHaveAttribute("data-kind", "question");
      await assertLayout(page, info, "question");
      await page.getByRole("button", { name: "带走这张问题签", exact: true }).click();
      const dialog = page.locator(".question-export-dialog");
      await expect(dialog.locator("img")).toBeVisible();
      await reachable(dialog.getByRole("button", { name: "保存图片", exact: true }));
      await expect(dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).resolves.toBe(true);
      await page.screenshot({ path: info.outputPath("question-preview.png"), fullPage: true });
      await dialog.getByRole("button", { name: "返回填写", exact: true }).click();
      await expect(dialog).not.toBeVisible();
      await expect(page.getByRole("button", { name: "带走这张问题签", exact: true })).toBeFocused();
      await page.getByRole("button", { name: "去下一页 →", exact: true }).click();
      await scene(page, 5);
      await assertLayout(page, info, "finale");
      await page.getByRole("button", { name: "保存这份祝福", exact: true }).click();
      const postcard = page.locator(".postcard-dialog");
      await expect(postcard.locator("img")).toBeVisible();
      await reachable(postcard.getByRole("button", { name: "保存图片", exact: true }));
      await expect(postcard.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).resolves.toBe(true);
      await postcard.getByRole("button", { name: "关闭预览", exact: true }).click();
      await page.getByRole("button", { name: "重新翻阅", exact: true }).click();
      await scene(page, 1);
      expect(errors).toEqual([]);
    } finally { await context.close(); }
  });
}
