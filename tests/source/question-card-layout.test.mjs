import { test } from "node:test";
import assert from "node:assert/strict";
import { visibleLength, validateQuestionText, QUESTION_TEXT_BYTES, splitGraphemes } from "../../lib/question-text.mjs";
import { createQuestionDraft } from "../../lib/question-draft.mjs";
import { CARD, wrapCardLines, planQuestionCards, withDeadline, layoutCardLine } from "../../lib/question-card.mjs";
import { questionFontCoverage } from "../../lib/question-fonts.mjs";

const measure = (text) => visibleLength(text) * 46;
const reconstruct = (lines) => lines.map((line) => line.text + line.breakAfter).join("");
test("3999/4000/4001 count visible graphemes, including complete complex emoji", () => {
  for (const glyph of ["字", "a", "👨‍👩‍👧‍👦", "🇨🇳", "👩🏽‍💻", "é", "𠮷"]) {
    assert.equal(visibleLength(glyph), 1);
    for (const n of [3999, 4000]) assert.equal(validateQuestionText(glyph.repeat(n)).length, n);
    assert.throws(() => validateQuestionText(glyph.repeat(4001)), { code: "length" });
  }
});
test("normalizes only newline spelling and rejects pathological bytes and lone surrogates", () => {
  assert.equal(validateQuestionText(" \tA\r\nB\r C\n").text, " \tA\nB\n C\n");
  assert.equal(validateQuestionText("  \n ").length, 4);
  assert.throws(() => validateQuestionText("a" + "\u0301".repeat(QUESTION_TEXT_BYTES)), { code: "bytes" });
  for (const text of ["\ud800", "a\udfff"]) assert.throws(() => validateQuestionText(text), { code: "invalid" });
});
test("rejected edits preserve text, storage and the undo copy", () => {
  const records = new Map();
  const draft = createQuestionDraft({ storage: { getItem: (k) => records.get(k) ?? null, setItem: (k, v) => records.set(k, v), removeItem: (k) => records.delete(k) } });
  draft.edit("好好生活 👩🏽‍💻"); draft.clear();
  assert.throws(() => draft.edit("a".repeat(4001)));
  assert.equal(draft.read().canUndo, true);
  assert.equal(records.size, 0);
  assert.equal(draft.undoClear().text, "好好生活 👩🏽‍💻");
});
test("invalid stored text stays recoverable and is never automatically overwritten", () => {
  const original = "a".repeat(4001); let writes = 0;
  const draft = createQuestionDraft({ storage: { getItem: () => original, setItem: () => writes++, removeItem: () => writes++ } });
  assert.equal(draft.read().recoveryText, original);
  assert.equal(draft.read().text, ""); assert.equal(writes, 0);
  draft.edit("new"); assert.equal(draft.read().recoveryText, original);
});
test("blank and whitespace-only drafts produce one blank card", () => {
  for (const text of ["", " ", "\t\n", "　\n ", "\n".repeat(4000)]) {
    const plan = planQuestionCards(text, measure);
    assert.equal(plan.pages.length, 1); assert.equal(plan.blank, true); assert.equal(plan.text, text);
  }
});
test("literal whitespace, HTML, long URLs, graphemes and explicit empty paragraphs reconstruct exactly", () => {
  for (const text of ["\n  春天\n\n\thello world  \n", "<img src=x onerror=alert(1)>\nhttps://example.test/" + "x".repeat(100), "👨‍👩‍👧‍👦".repeat(40), "你好，世界！「未来」继续往前走。", "one beautiful afternoon, with a little question."]) {
    const lines = wrapCardLines(text, measure, 460);
    assert.equal(reconstruct(lines), text);
    for (const line of lines) assert.ok(measure(line.text.replaceAll("\t", "    ")) <= 460);
  }
  assert.deepEqual(wrapCardLines("hello world", (s) => s.length, 8).map((x) => x.text), ["hello ", "world"]);
});
test("soft wraps and page breaks do not split graphemes or lose/repeat any text", () => {
  const text = ("  期待新的可能。Hello world! 👩🏽‍💻 é\n\n").repeat(60);
  const plan = planQuestionCards(text, measure);
  assert.ok(plan.pages.length > 1);
  assert.equal(reconstruct(plan.pages.flat()), text);
  assert.deepEqual(plan.pages.flatMap((page) => page.flatMap((line) => [...splitGraphemes(line.text + line.breakAfter)])), [...splitGraphemes(text)]);
});
test("exact one-page and 20-page budgets are accepted; a single additional line is rejected before rendering", () => {
  const text = (n) => Array.from({ length: n }, (_, i) => `${i}`).join("\n");
  assert.equal(planQuestionCards(text(CARD.firstLines), measure).pages.length, 1);
  assert.equal(planQuestionCards(text(CARD.firstLines + 1), measure).pages.length, 2);
  const maximum = CARD.firstLines + 19 * CARD.nextLines;
  assert.equal(planQuestionCards(text(maximum), measure).pages.length, 20);
  assert.throws(() => planQuestionCards(text(maximum + 1), measure), { code: "pages" });
  assert.throws(() => planQuestionCards("a" + "\n".repeat(3998) + "b", measure), { code: "pages" });
});
test("wide or pathological graphemes fail explicitly instead of clipping", () => {
  assert.throws(() => wrapCardLines("A", () => 100, 50), { code: "layout" });
  assert.throws(() => wrapCardLines("a" + "\u0301".repeat(1024), () => 1, 100), { code: "layout" });
  let measured = false;
  assert.throws(() => wrapCardLines("hello b" + "\u0301".repeat(1024), () => { measured = true; return 1; }, 100), { code: "layout" });
  assert.equal(measured, false);
});
test("font coverage distinguishes selected Chinese, Latin accents and device fallbacks", () => {
  assert.equal(questionFontCoverage("Hello café").needsChinese, false);
  assert.equal(questionFontCoverage("此刻的想法 新的一岁里").needsChinese, true);
  assert.equal(questionFontCoverage("此刻的想法").fallback, false);
  assert.equal(questionFontCoverage("岁问题带继续让远给终乐顺细欢满").fallback, false);
  assert.equal(questionFontCoverage("闫颍").fallback, false);
  assert.equal(questionFontCoverage("👩🏽‍💻").device, true);
});

test("mixed baseline runs retain complete words and graphemes, including all ink overhangs", () => {
  const text = "你好，café é 👩🏽‍💻𠮷\ufe0f！hello";
  const measured = [];
  const layout = layoutCardLine(text, (run) => {
    measured.push(run);
    return { width: 100, actualBoundingBoxLeft: 4, actualBoundingBoxRight: 108, actualBoundingBoxAscent: 30, actualBoundingBoxDescent: 8 };
  });
  assert.deepEqual(measured, ["你好，", "café é 👩🏽‍💻", "𠮷\ufe0f！", "hello"]);
  assert.equal(layout.runs.map((r) => r.text).join(""), text);
  assert.equal(layout.width, 412);
  assert.equal(layout.inset, 4);
  assert.deepEqual(layout.runs.map((r) => r.x), [0, 100, 200, 300]);
});
test("timeouts and cancellation release waiting callers; late results remain obsolete", async () => {
  let complete;
  await assert.rejects(withDeadline(() => new Promise((resolve) => { complete = resolve; }), 10, undefined, "render-timeout"), { code: "render-timeout" });
  complete("late");
  const controller = new AbortController();
  const waiting = withDeadline(() => new Promise(() => {}), 10000, controller.signal, "font-timeout");
  controller.abort(); await assert.rejects(waiting, { name: "AbortError" });
});
