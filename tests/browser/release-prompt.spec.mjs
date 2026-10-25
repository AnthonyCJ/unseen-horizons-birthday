import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { METHOD_PROMPTS } from "../../lib/clarifying-prompt.mjs";
import { revisit, assertLayout, reachable, recordEnvironment } from "./compatibility-helpers.mjs";

test("release: bilingual prompt payloads, guides and TXT downloads", async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 744 });
  // Check API payload and success UI without changing the user's OS clipboard.
  // Native clipboard/paste remains a separate untested integration layer.
  await page.addInitScript(() => {
    window.__releaseCopied = [];
    Object.defineProperty(navigator, "clipboard", { configurable: true,
      value: { writeText: async text => { window.__releaseCopied.push(text); } } });
  });
  await revisit(page, 1);
  await recordEnvironment(page, info, { scenario: "mobile prompt; controlled clipboard API, actual TXT downloads" });
  for (const language of ["zh", "en"]) {
    await page.getByRole("button", { name: language === "zh" ? "中文" : "English", exact: true }).click();
    await page.locator(".method-controls .prompt-copy-action").click();
    await expect(page.locator("#method-copy-status")).toContainText("已复制");
    expect(await page.evaluate(() => window.__releaseCopied.at(-1))).toBe(METHOD_PROMPTS[language].prompt);
    await page.locator("#method-guide-trigger").click();
    const guide = page.locator("#method-guide-panel");
    await expect(guide).toBeVisible();
    await reachable(guide.locator(".prompt-save-action"));
    await assertLayout(page, info, `${language}-guide`);
    await page.screenshot({ path: info.outputPath(`${language}-guide.png`) });
    await page.locator("#method-prompt-trigger").click();
    const panel = page.locator("#method-prompt-panel");
    await expect(panel).toBeVisible();
    await reachable(panel.locator(".prompt-save-action"));
    const pending = page.waitForEvent("download");
    await panel.locator(".prompt-save-action").click();
    const download = await pending;
    const file = info.outputPath(`prompt-${language}.txt`);
    await download.saveAs(file);
    expect(await readFile(file, "utf8")).toBe(METHOD_PROMPTS[language].prompt);
    expect(download.suggestedFilename()).toBe(`协作启动Prompt-${language === "zh" ? "中文" : "英文"}-v1.2.4.txt`);
    await assertLayout(page, info, `${language}-full-prompt`);
    await page.screenshot({ path: info.outputPath(`${language}-prompt-bottom.png`) });
    await page.locator("#method-prompt-trigger").click();
  }
});
