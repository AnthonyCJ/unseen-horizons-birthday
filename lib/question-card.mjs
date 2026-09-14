import { normalizeQuestionText, splitGraphemes, validateQuestionText } from "./question-text.mjs";
import { loadQuestionFonts, QUESTION_HAND_FONT, QUESTION_PLAIN_FONT } from "./question-fonts.mjs";

export const QUESTION_LINES = ["新的一岁里，", "有没有一个问题，", "你愿意带着它继续往前走？"];
export const CARD = Object.freeze({ width: 1200, height: 1600, x: 132, textWidth: 936, fontSize: 40, lineHeight: 84, firstBaseline: 630, nextBaseline: 350, firstLines: 10, nextLines: 13, maxPages: 20 });
const closed = /^[，。！？、；：）》」』】〕〉,.!?;:)}\]]/u;
const opened = /[（《「『【〔〈({\[]$/u;
const word = /^[\p{Script=Latin}\p{M}\d'_’-]+$/u;
export const displayCardLine = (line) => line.replace(/\t/g, "    ");
const ideographic = /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\u3000-\u303f\uff01-\uff60\uffe0-\uffee]/u;

// Use the same shaped runs for measuring and drawing. Never split a grapheme
// or an alphabetic word: combining marks, emoji and Latin shaping stay intact.
export function layoutCardLine(text, measure) {
  const runs = [];
  for (const char of splitGraphemes(text)) {
    const cjk = ideographic.test(char);
    if (runs.length && runs.at(-1).cjk === cjk) runs.at(-1).text += char;
    else runs.push({ text: char, cjk });
  }
  let advance = 0, left = 0, right = 0;
  for (const run of runs) {
    const metric = measure(run.text);
    run.x = advance;
    run.ascent = metric.actualBoundingBoxAscent || 0;
    run.descent = metric.actualBoundingBoxDescent || 0;
    left = Math.min(left, advance - (metric.actualBoundingBoxLeft || 0));
    right = Math.max(right, advance + (metric.actualBoundingBoxRight || 0));
    advance += metric.width;
  }
  return { runs, inset: -left, width: Math.max(advance, right) - left };
}

export class QuestionCardError extends Error {
  constructor(code, message) { super(message); this.name = "QuestionCardError"; this.code = code; }
}

// Retain literal text and explicit paragraph breaks; soft wraps add no text.
export function wrapCardLines(text, measure, maxWidth) {
  if (!(maxWidth > 0)) throw new RangeError("Invalid line width");
  const lines = [];
  const paragraphs = normalizeQuestionText(text).split("\n");
  paragraphs.forEach((paragraph, paragraphIndex) => {
    const chars = [...splitGraphemes(paragraph)];
    if (chars.some((char) => char.length > 1024)) throw new QuestionCardError("layout", "这段文字有过长的叠加字符，暂时无法排成图片。原文仍保留，可以先复制文字。");
    const startOfParagraph = lines.length;
    let start = 0;
    while (start < chars.length) {
      let end = start;
      let value = "";
      while (end < chars.length && measure(displayCardLine(value + chars[end])) <= maxWidth) value += chars[end++];
      if (end === start) throw new QuestionCardError("layout", "有一个组合字符太宽，图片放不下。文字仍保留，请调整后重试或先复制文字。");
      if (end < chars.length) {
        if (word.test(chars[end]) && word.test(chars[end - 1])) {
          let boundary = end;
          while (boundary > start && word.test(chars[boundary - 1])) boundary--;
          if (boundary > start) end = boundary;
        }
        while (end > start + 1 && (closed.test(chars[end]) || opened.test(chars[end - 1]))) end--;
      }
      lines.push({ text: chars.slice(start, end).join(""), breakAfter: "" });
      start = end;
    }
    if (lines.length === startOfParagraph) lines.push({ text: "", breakAfter: "" });
    if (paragraphIndex < paragraphs.length - 1) lines[lines.length - 1].breakAfter = "\n";
  });
  return lines;
}

export function wrapCardText(text, measure, maxWidth) { return wrapCardLines(text, measure, maxWidth).map((line) => line.text); }

export function planQuestionCards(value, measure) {
  const { text } = validateQuestionText(value);
  const blank = text.trim() === "";
  const lines = blank ? [] : wrapCardLines(text, measure, CARD.textWidth);
  const count = 1 + Math.ceil(Math.max(0, lines.length - CARD.firstLines) / CARD.nextLines);
  if (count > CARD.maxPages) throw new QuestionCardError("pages", `这些文字或换行会排成 ${count} 张问题签，超过一次 20 张的上限。可以减少空行或分段带走；全文仍保留。`);
  const pages = [lines.slice(0, CARD.firstLines)];
  for (let offset = CARD.firstLines; offset < lines.length; offset += CARD.nextLines) pages.push(lines.slice(offset, offset + CARD.nextLines));
  return { text, blank, pages };
}

function aborted(signal) { if (signal?.aborted) throw new DOMException("Cancelled", "AbortError"); }

export function withDeadline(operation, ms, signal, code) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
      if (error) reject(error); else resolve(value);
    };
    const cancel = () => finish(new DOMException("Cancelled", "AbortError"));
    if (signal?.aborted) { cancel(); return; }
    signal?.addEventListener("abort", cancel, { once: true });
    timer = setTimeout(() => finish(new QuestionCardError(code, code === "font-timeout"
      ? "字迹样式准备得有些久。可以重试，或先保存清晰文字版。"
      : "这张图片准备得有些久，文字仍在这里。可以重试或先复制文字。")), ms);
    Promise.resolve().then(operation).then((value) => finish(null, value), (error) => finish(error));
  });
}

export async function prepareQuestionCards(text, { mode = "handwriting", signal } = {}) {
  validateQuestionText(text);
  await loadQuestionFonts(text, { mode, signal });
  aborted(signal);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new QuestionCardError("canvas", "图片还没生成好，文字仍在这里。可以重试，或先复制文字。");
  const font = mode === "plain" ? QUESTION_PLAIN_FONT : QUESTION_HAND_FONT;
  ctx.font = `${CARD.fontSize}px ${font}`;
  const plan = planQuestionCards(text, (value) => layoutCardLine(value, (run) => ctx.measureText(run)).width);
  canvas.width = canvas.height = 0;
  return { ...plan, mode, font };
}

export async function renderQuestionPage(plan, page, { signal } = {}) {
  aborted(signal);
  if (!Number.isInteger(page) || !plan.pages[page]) throw new RangeError("Invalid card page");
  await new Promise((resolve) => setTimeout(resolve, 0));
  aborted(signal);
  const canvas = document.createElement("canvas");
  canvas.width = CARD.width;
  canvas.height = CARD.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new QuestionCardError("canvas", "图片还没生成好，文字仍在这里。可以重试，或先复制文字。");
  try {
    const uiFont = '"Noto Serif SC", "Songti SC", "SimSun", serif';
    ctx.fillStyle = "#f8f5ed";
    ctx.fillRect(0, 0, CARD.width, CARD.height);
    ctx.strokeStyle = "#cbd1c5";
    ctx.lineWidth = 2;
    ctx.strokeRect(48, 48, 1104, 1504);
    ctx.fillStyle = "#60766c";
    ctx.font = '23px Georgia, serif';
    ctx.fillText("A QUESTION TO TAKE ALONG", CARD.x, 144);
    ctx.fillStyle = "#36483e";
    if (page === 0) {
      ctx.font = `43px ${uiFont}`;
      QUESTION_LINES.forEach((line, i) => ctx.fillText(line, CARD.x, 258 + i * 73));
      ctx.font = `25px ${uiFont}`;
      ctx.fillStyle = "#69776b";
      ctx.fillText(plan.blank ? "把空白留给以后，也很好。" : "此刻的想法", CARD.x, 539);
    } else {
      ctx.font = `30px ${uiFont}`;
      ctx.fillText("此刻的想法 · 续", CARD.x, 257);
    }
    const baseline = page === 0 ? CARD.firstBaseline : CARD.nextBaseline;
    const capacity = page === 0 ? CARD.firstLines : CARD.nextLines;
    ctx.strokeStyle = "#dedfd4";
    ctx.lineWidth = 1;
    for (let i = 0; i < capacity; i++) {
      const y = baseline + i * CARD.lineHeight + 33;
      ctx.beginPath(); ctx.moveTo(CARD.x, y); ctx.lineTo(CARD.x + CARD.textWidth, y); ctx.stroke();
    }
    ctx.fillStyle = "#405a4c";
    ctx.font = `${CARD.fontSize}px ${plan.font}`;
    // A stable sample aligns Chinese ink bottoms without making punctuation or
    // varying letter shapes move a whole line. Latin keeps its natural baseline.
    const descents = [..."日子想的走把好前"].map((char) => ctx.measureText(char).actualBoundingBoxDescent || 0).sort((a, b) => a - b);
    const chineseDescent = (descents[3] + descents[4]) / 2;
    for (let index = 0; index < plan.pages[page].length; index++) {
      const line = displayCardLine(plan.pages[page][index].text);
      const layout = layoutCardLine(line, (run) => ctx.measureText(run));
      const rule = baseline + index * CARD.lineHeight + 33;
      for (const run of layout.runs) {
        const offset = -2 - (run.cjk ? chineseDescent : 0);
        if (offset - run.ascent < -65 || offset + run.descent > 18) {
          throw new QuestionCardError("layout", "有一组叠加字符超出了纸签行距。请调整后重试，或先复制文字；原文仍在这里。");
        }
        ctx.fillText(run.text, CARD.x + layout.inset + run.x, rule + offset);
      }
    }
    ctx.fillStyle = "#68796c";
    ctx.font = 'italic 27px Georgia, serif';
    ctx.fillText("For Charlotte · 2026", CARD.x, 1468);
    if (plan.mode === "plain") {
      ctx.font = `21px ${uiFont}`;
      ctx.fillText("清晰文字版", CARD.x, 1494);
    }
    if (plan.pages.length > 1) {
      ctx.textAlign = "right";
      ctx.font = '24px Georgia, serif';
      ctx.fillText(`${page + 1} / ${plan.pages.length}`, CARD.x + CARD.textWidth, 1468);
    }
    return await withDeadline(() => new Promise((resolve, reject) => {
      canvas.toBlob((blob) => blob?.size ? resolve(blob) : reject(new QuestionCardError("encoding", "图片还没生成好，文字仍在这里。可以重试，或先复制文字。")), "image/png");
    }), 10000, signal, "render-timeout");
  } catch (error) {
    if (error instanceof QuestionCardError || error?.name === "AbortError") throw error;
    throw new QuestionCardError("encoding", "图片还没生成好，文字仍在这里。可以重试，或先复制文字。");
  } finally { canvas.width = canvas.height = 0; }
}
