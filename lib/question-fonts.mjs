import { QuestionCardError, withDeadline } from "./question-card.mjs";
import coverage from "./question-font-coverage.json" with { type: "json" };

export const QUESTION_HAND_FONT = '"QuestionKalam", "QuestionMaoken", "Segoe UI Emoji", "Apple Color Emoji", serif';
export const QUESTION_PLAIN_FONT = 'system-ui, "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
const base = "/unseen-horizons-birthday/fonts/";
const faces = {
  QuestionKalam: { url: `${base}question/kalam-regular.woff2`, sizeAdjust: "110%" },
  QuestionMaoken: { url: `${base}question/maoken-regular.woff2` },
};
const has = (font, point) => {
  const ranges = coverage[font];
  let low = 0, high = ranges.length - 1;
  while (low <= high) {
    const middle = (low + high) >>> 1;
    if (point < ranges[middle][0]) high = middle - 1;
    else if (point > ranges[middle][1]) low = middle + 1;
    else return true;
  }
  return false;
};
export function questionFontCoverage(text) {
  let needsChinese = false;
  let fallback = false;
  let device = false;
  for (const char of text) {
    const point = char.codePointAt(0);
    if (/\s/u.test(char) || /[\u200c-\u200f\ufe00-\ufe0f]/u.test(char)) continue;
    if (has("kalam", point)) continue;
    if (has("maoken", point)) { needsChinese = true; continue; }
    fallback = true;
    device = true;
  }
  return { needsChinese, fallback, device };
}

async function ensureFace(name, text) {
  // CSS-connected faces cannot be deleted from FontFaceSet. A fresh binary face
  // on retry bypasses the browser's cached font decode failure, without placing
  // the draft in a URL or creating unbounded retries/duplicate loaded faces.
  let failed = false;
  for (const face of document.fonts) {
    if (face.family.replaceAll('"', "") === name) {
      if (face.status === "loaded") return;
      if (face.status === "error") failed = true;
    }
  }
  if (failed) {
    const { url, ...descriptors } = faces[name];
    const response = await fetch(url, { cache: "reload", credentials: "same-origin" });
    if (!response.ok) throw new Error("Font unavailable");
    const face = new FontFace(name, await response.arrayBuffer(), descriptors);
    await face.load();
    document.fonts.add(face);
    return;
  }
  const loaded = await document.fonts.load(`40px "${name}"`, text || "A");
  if (!loaded.length || loaded.some((face) => face.status !== "loaded")) throw new Error("Font unavailable");
}

export async function loadQuestionFonts(text, { mode = "handwriting", signal } = {}) {
  try {
    return await withDeadline(async () => {
      const tasks = [];
      if (mode === "handwriting" && text.trim()) {
        tasks.push(ensureFace("QuestionKalam", "Aa"));
        if (questionFontCoverage(text).needsChinese) tasks.push(ensureFace("QuestionMaoken", text));
      }
      await Promise.all(tasks);
      if (mode === "handwriting") window.dispatchEvent(new Event("question-handwriting-ready"));
    }, 8000, signal, "font-timeout");
  } catch (error) {
    if (error?.name === "AbortError" || error instanceof QuestionCardError) throw error;
    // The readable fallback deliberately remains available if a font request fails.
    if (mode === "plain") return;
    throw new QuestionCardError("font", "字迹样式暂时没准备好。可以重试，或先保存清晰文字版。");
  }
}
