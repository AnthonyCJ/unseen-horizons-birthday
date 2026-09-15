import { expect } from "@playwright/test";

export const ENTRANCE = "/unseen-horizons-birthday/#/open/birthday_review_2026_local_test0";
export const READING_KEY = "unseen-horizons-birthday:2026:reading:v2";

export async function recordEnvironment(page, info, extra = {}) {
  await info.attach("environment", { contentType: "application/json", body: JSON.stringify({
    ...extra, ...await page.evaluate(() => ({ userAgent: navigator.userAgent,
      screen: { width: screen.width, height: screen.height }, viewport: { width: innerWidth, height: innerHeight },
      dpr: devicePixelRatio, reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
      capabilities: { dialog: "showModal" in HTMLDialogElement.prototype, inert: "inert" in HTMLElement.prototype,
        svh: CSS.supports("height", "100svh"), fonts: "fonts" in document,
        mp3: document.createElement("audio").canPlayType("audio/mpeg") },
    })),
  }, null, 2) });
}

export function observeErrors(page) {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  return errors;
}

export async function scene(page, number) {
  await expect(page.locator(".stage")).toHaveAttribute("data-page", String(number));
  await expect(page.locator(".stage")).not.toHaveClass(/is-(exiting|paper|entering|ritual)/);
}

export async function revisit(page, finding) {
  await page.addInitScript(key => localStorage.setItem(key, JSON.stringify({ version: 2, overview: true, opened: 7 })), READING_KEY);
  await page.goto(ENTRANCE);
  await page.getByRole("button", { name: "回看三件小东西", exact: true }).click();
  await scene(page, 4);
  if (finding) await openFinding(page, finding);
}

export async function openFinding(page, number) {
  await page.locator(`#finding-toggle-${number}`).click();
  await expect(page.locator(".finding-reader-layer")).toHaveAttribute("data-state", "open");
  await expect(page.locator(".finding-reader-layer")).toHaveAttribute("data-swap", "idle");
}

export async function nextFinding(page) {
  await page.locator(".finding-reader-next button").click();
  await expect(page.locator(".finding-reader-layer")).toHaveAttribute("data-swap", "idle");
}

export async function assertLayout(page, info, name) {
  // Inspect actual clipping, not just document width: a fixed-height scene can
  // hide text while document.scrollWidth still looks perfect.
  const state = await page.evaluate(() => {
    const hidden = [];
    for (const selector of [".cover-core", ".letter-copy", ".finale-core"]) {
      const node = document.querySelector(selector);
      if (!node) continue;
      const box = node.getBoundingClientRect();
      let ancestor = node.parentElement;
      while (ancestor) {
        const style = getComputedStyle(ancestor), boundary = ancestor.getBoundingClientRect();
        if (["hidden", "clip"].includes(style.overflowY) && (box.top < boundary.top - 2 || box.bottom > boundary.bottom + 2)) {
          hidden.push({ selector, ancestor: ancestor.className, box: box.toJSON(), boundary: boundary.toJSON() });
          break;
        }
        ancestor = ancestor.parentElement;
      }
    }
    const reader = document.querySelector(".finding-reader-scroll");
    return { horizontalOverflow: document.documentElement.scrollWidth - innerWidth, clippedContent: hidden,
      reader: reader && { width: reader.clientWidth, scrollWidth: reader.scrollWidth, height: reader.clientHeight } };
  });
  await info.attach(`${name}-layout`, { contentType: "application/json", body: JSON.stringify(state, null, 2) });
  expect(state.horizontalOverflow, name).toBeLessThanOrEqual(1);
  expect(state.clippedContent, `${name}: content clipped by a non-scrollable ancestor`).toEqual([]);
  if (state.reader) {
    expect(state.reader.scrollWidth - state.reader.width, name).toBeLessThanOrEqual(1);
    expect(state.reader.height, `${name}: reader needs usable height`).toBeGreaterThan(80);
  }
}

export async function reachable(locator) {
  await locator.scrollIntoViewIfNeeded();
  await expect(locator).toBeInViewport();
  await expect(locator).toBeEnabled();
  await expect.poll(() => locator.evaluate(el => {
    const r = el.getBoundingClientRect();
    return el.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2));
  })).toBe(true);
}
