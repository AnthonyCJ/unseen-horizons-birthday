import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { ENTRANCE, READING_KEY, scene, openFinding, nextFinding, observeErrors, assertLayout } from "./compatibility-helpers.mjs";
import { METHOD_PROMPTS } from "../../lib/clarifying-prompt.mjs";

test.use({ reducedMotion: "no-preference" });

async function overview(page, opened = 0) {
  // The overview has been visited, but opened=0 means none of its details has.
  // This fixture avoids changing the unrelated cover/letter timing chain.
  await page.addInitScript(({ key, opened }) => localStorage.setItem(key,
    JSON.stringify({ version: 2, overview: true, opened })), { key: READING_KEY, opened });
  await page.goto(ENTRANCE);
  await page.getByRole("button", { name: /^(继续翻阅|回看)三件小东西$/ }).click();
  await scene(page, 4);
}
const root = page => page.locator(".finding-detail");
async function opacities(page) {
  return root(page).evaluate(el => [...el.querySelectorAll("[data-finding-reveal],.finding-question-character,.finding-question-line")]
    .map(n => Number(getComputedStyle(n).opacity)));
}
async function complete(page) {
  await expect.poll(async () => (await opacities(page)).every(n => n > .999), { timeout: 28000 }).toBe(true);
}
async function close(page) {
  await page.locator(".finding-reader-back").click();
  await expect(page.locator(".finding-reader-layer")).toHaveCount(0);
}
async function rememberClock(page) {
  await root(page).evaluate(el => {
    const target = el.querySelector("[data-finding-reveal],.finding-question-character");
    window.__findingClock = { element: target, animation: target.getAnimations()[0] };
  });
  await expect.poll(() => page.evaluate(() => window.__findingClock.animation?.startTime)).not.toBeNull();
  return page.evaluate(() => window.__findingClock.animation.startTime);
}
async function sameClock(page, start) {
  expect(await page.evaluate(() => ({ connected: window.__findingClock.element.isConnected,
    start: window.__findingClock.animation.startTime }))).toEqual({ connected: true, start });
}

test("finding complete sequences replay on first entry, rereading and next-item navigation", async ({ page }, info) => {
  test.setTimeout(210000);
  await page.setViewportSize({ width: 1440, height: 800 });
  await page.addInitScript(() => {
    window.__motionFocusEvents = [];
    document.addEventListener("focusin", event => window.__motionFocusEvents.push({ time: performance.now(), id: event.target.id, tag: event.target.tagName }));
  });
  const errors = observeErrors(page);
  await overview(page);
  for (let number = 1; number <= 3; number++) {
    if (number === 1) await openFinding(page, number);
    else await nextFinding(page);
    expect((await opacities(page)).at(-1)).toBeLessThan(.05);
    await expect.poll(async () => (await opacities(page)).some(n => n > .05 && n < .95)).toBe(true);
    await complete(page);
    const firstCopy = await root(page).innerText();
    await close(page);
    try { await expect(page.locator(`#finding-toggle-${number}`)).toBeFocused(); }
    catch (error) {
      await info.attach("return-focus-state", { contentType: "application/json", body: JSON.stringify(await page.evaluate(() => ({
        active: document.activeElement?.id, tag: document.activeElement?.tagName, focused: document.hasFocus(),
        visibility: document.visibilityState, inert: !!document.querySelector("#finding-toggle-1")?.closest("[inert]"),
        events: window.__motionFocusEvents,
      }))) });
      throw error;
    }
    await openFinding(page, number);
    expect((await opacities(page)).at(-1)).toBeLessThan(.05);
    await complete(page);
    expect(await root(page).innerText()).toBe(firstCopy);
    await assertLayout(page, info, `complete-${number}`);
  }
  expect(errors).toEqual([]);
});

test("finding interrupted entry restarts cleanly without retaining visible fragments", async ({ page }) => {
  test.setTimeout(140000);
  await overview(page, 7);
  for (const number of [1, 2, 3]) {
    await openFinding(page, number);
    await expect.poll(async () => (await opacities(page)).some(n => n > .1)).toBe(true);
    expect((await opacities(page)).at(-1)).toBeLessThan(.05);
    await close(page);
    await openFinding(page, number);
    expect((await opacities(page)).every(n => n < .05)).toBe(true);
    await complete(page);
    await page.locator("#finding-reader-title").focus();
    await page.keyboard.press("Escape");
    await expect(page.locator(".finding-reader-layer")).toHaveCount(0);
  }
});

test("finding ordinary actions and bookmark return preserve the current reading clock", async ({ page }, info) => {
  test.setTimeout(140000);
  const errors = observeErrors(page);
  await overview(page, 7);
  await openFinding(page, 1);
  const methodClock = await rememberClock(page);
  await page.getByRole("button", { name: "English", exact: true }).click();
  await expect(page.getByRole("button", { name: "English", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.locator("#method-guide-trigger").click();
  await expect(page.locator("#method-guide-panel")).toBeVisible();
  await page.locator(".finding-reader-scroll").evaluate(el => el.scrollTo({ top: el.scrollHeight, behavior: "instant" }));
  await sameClock(page, methodClock);
  const music = page.locator(".finding-reader-toolbar .music-button");
  await expect(music).toBeEnabled(); await music.click();
  await sameClock(page, methodClock);
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "保存英文 Prompt", exact: true }).first().click();
  const download = await pending, file = info.outputPath("prompt-en.txt");
  await download.saveAs(file);
  expect((await readFile(file, "utf8")).replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").trim()).toBe(METHOD_PROMPTS.en.prompt.trim());
  await sameClock(page, methodClock);
  await close(page);

  await openFinding(page, 2);
  const attentionClock = await rememberClock(page);
  const opener = page.getByRole("button", { name: "看看书签", exact: true });
  await opener.scrollIntoViewIfNeeded();
  const readingTop = await page.locator(".finding-reader-scroll").evaluate(el => el.scrollTop);
  await opener.click();
  await expect(page.locator(".bookmark-preview .keepsake-primary")).toBeEnabled();
  // Let the actual reading clock finish while its DOM is display:none.
  await expect.poll(() => root(page).getAttribute("data-reveal-state"), { timeout: 28000 }).toBe("complete");
  await page.goBack();
  await expect(page.locator(".bookmark-preview")).toHaveCount(0);
  await expect(opener).toBeFocused();
  await sameClock(page, attentionClock);
  expect((await opacities(page)).every(n => n > .999)).toBe(true);
  expect(await page.locator(".finding-reader-scroll").evaluate(el => el.scrollTop)).toBeCloseTo(readingTop, 0);
  await opener.click();
  await page.getByRole("button", { name: "返回这页体会", exact: true }).click();
  await sameClock(page, attentionClock);
  await close(page);

  await openFinding(page, 3);
  const questionClock = await rememberClock(page);
  const draft = "这一岁，想继续追问什么？";
  await page.locator("#inspiration-text").fill(draft);
  await page.locator(".finding-reader-scroll").evaluate(el => el.scrollTo({ top: el.scrollHeight, behavior: "instant" }));
  await sameClock(page, questionClock);
  await page.getByRole("button", { name: "带走这张问题签", exact: true }).click();
  await expect(page.locator(".question-export-dialog .keepsake-primary")).toBeEnabled();
  await page.goBack();
  await expect(page.locator(".question-export-dialog")).not.toBeVisible();
  await sameClock(page, questionClock);
  await expect(page.locator("#inspiration-text")).toHaveValue(draft);
  await close(page); await openFinding(page, 3);
  await expect(page.locator("#inspiration-text")).toHaveValue(draft);
  expect((await opacities(page)).at(-1)).toBeLessThan(.05);
  expect(errors).toEqual([]);
});

test("finding reduced motion is immediately readable and preference changes do not replay content", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await overview(page, 7);
  for (const number of [1, 2, 3]) {
    await openFinding(page, number);
    expect((await opacities(page)).every(n => n === 1)).toBe(true);
    await close(page);
  }
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await openFinding(page, 2);
  expect((await opacities(page)).at(-1)).toBeLessThan(.05);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await complete(page);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  expect((await opacities(page)).every(n => n === 1)).toBe(true);
});
