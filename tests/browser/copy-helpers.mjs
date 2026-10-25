import { expect } from "@playwright/test";
import { APPROVED_COPY as copy } from "../approved-copy.mjs";

const normalize = text => text.replace(/\s+/gu, "");
async function exact(locator, expected) {
  expect(normalize(await locator.textContent())).toBe(normalize(expected));
}
async function lines(locator, expected) {
  expect((await locator.locator(":scope > span").allTextContents()).map(normalize)).toEqual(expected.map(normalize));
}

export async function assertApprovedCopy(page, section) {
  if (section === "cover") await exact(page.locator(".intro-copy"), copy.cover);
  if (section === "letter") {
    await exact(page.locator(".letter-body").first(), copy.letterLead);
    await exact(page.locator(".letter-closing"), copy.letterClosing);
    await expect(page.locator(".letter-closing")).toHaveAttribute("aria-label", copy.letterClosing);
  }
  if (section === "overview") await exact(page.locator("#finding-summary-3"), copy.questionSummary);
  if (section === "method") await lines(page.locator(".finding-detail-method .finding-poem"), copy.methodPoem);
  if (section === "attention") {
    await exact(page.locator(".finding-detail-harness > p").first(), copy.attentionIntro);
    await lines(page.locator(".finding-harness-anchor"), copy.attentionAnchor);
    await exact(page.locator(".finding-harness-meaning"), copy.attentionMeaning);
    await lines(page.locator(".finding-harness-rhythm"), copy.attentionRhythm);
    await lines(page.locator(".finding-harness-closing"), copy.attentionClosing);
  }
  if (section === "question") {
    await exact(page.locator("#finding-reader-summary"), copy.questionSummary);
    await exact(page.locator(".finding-question"), copy.question);
  }
  if (section === "finale") await exact(page.locator(".finale-wish"), copy.finale);
}

export async function recordCopyLayout(page, info, section) {
  await expect.poll(() => page.evaluate(() => document.fonts.status), {
    message: "Measure copy only after the current page fonts have loaded",
  }).toBe("loaded");
  const result = await page.evaluate(() => {
    const boxes = [], failures = [];
    const selectors = ['.intro-copy', '.letter-body', '.finding-summary', '.finding-detail > p', '.finding-harness-anchor', '.finding-harness-meaning', '.finale-wish'];
    for (const selector of selectors) for (const el of document.querySelectorAll(selector)) {
      if (el.closest('[inert]') || !el.getClientRects().length) continue;
      const range = document.createRange(); range.selectNodeContents(el);
      const rect = el.getBoundingClientRect();
      const textRects = [...range.getClientRects()].filter(r => r.width > 0 && r.height > 0);
      const lineTops = [...new Set(textRects.map(r => Math.round(r.top)))];
      const font = getComputedStyle(el);
      boxes.push({ selector, text: el.textContent.trim(), rect: rect.toJSON(), lines: lineTops.length, font: font.fontFamily, size: font.fontSize });
      if (textRects.some(r => r.left < rect.left - 3 || r.right > rect.right + 3)) failures.push({ selector, reason: 'text crosses its horizontal box' });
      for (let a=el.parentElement; a; a=a.parentElement) {
        const style=getComputedStyle(a), bounds=a.getBoundingClientRect();
        if (['auto','scroll'].includes(style.overflowY)) break;
        if (['hidden','clip'].includes(style.overflowY) && textRects.some(r=>r.top<bounds.top-3 || r.bottom>bounds.bottom+3)) {
          failures.push({ selector, reason:'text clipped vertically', ancestor:a.className }); break;
        }
      }
    }
    return { viewport:{width:innerWidth,height:innerHeight},dpr:devicePixelRatio,fontsReady:document.fonts.status,boxes,failures };
  });
  await info.attach(`${section}-copy-layout`, {contentType:'application/json',body:JSON.stringify(result,null,2)});
  expect(result.failures).toEqual([]);
  expect(result.fontsReady).toBe('loaded');
  return result;
}
