import assert from "node:assert/strict";
import test from "node:test";
import { createQuestionDraft, QUESTION_DRAFT_LIMIT } from "../../lib/question-draft.mjs";
import { wrapCardText } from "../../lib/question-card.mjs";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  };
}

test("a refreshed visit restores the exact draft, including whitespace and emoji", () => {
  const storage = memoryStorage();
  const visit = createQuestionDraft({ storage });
  const text = "  好奇 🌱\n与家人👨‍👩‍👧‍👦一起探索。\n  ";
  visit.edit(text);
  assert.equal(createQuestionDraft({ storage }).read().text, text);
  assert.equal(visit.read().storageAvailable, true);
  assert.equal(createQuestionDraft({ storage: memoryStorage() }).read().text, "");
});

test("preview and gift drafts remain separate, including after clearing and reloading", () => {
  const storage = memoryStorage();
  const gift = createQuestionDraft({ storage });
  const preview = createQuestionDraft({ storage, preview: true });
  gift.edit("正式填写");
  preview.edit("预览测试");
  assert.equal(createQuestionDraft({ storage }).read().text, "正式填写");
  assert.equal(createQuestionDraft({ storage, preview: true }).read().text, "预览测试");
  preview.clear();
  assert.equal(createQuestionDraft({ storage }).read().text, "正式填写");
  assert.equal(createQuestionDraft({ storage, preview: true }).read().text, "");
});

test("clear removes only the draft; undo is temporary and never replaces subsequent typing", () => {
  const storage = memoryStorage();
  storage.setItem("reading-progress", "keep");
  const visit = createQuestionDraft({ storage });
  visit.edit("这一刻");
  assert.equal(visit.clear().canUndo, true);
  assert.equal(createQuestionDraft({ storage }).read().text, "");
  assert.equal(createQuestionDraft({ storage }).read().canUndo, false);
  assert.equal(storage.getItem("reading-progress"), "keep");
  assert.equal(visit.undoClear().text, "这一刻");
  assert.equal(createQuestionDraft({ storage }).read().text, "这一刻");
  visit.clear();
  visit.edit("新写下的想法");
  assert.equal(visit.undoClear().text, "新写下的想法");
  assert.equal(visit.read().canUndo, false);
  visit.edit("");
  assert.equal(createQuestionDraft({ storage }).read().text, "");
});

test("denied storage, including a throwing getter, leaves editing and undo usable in memory", () => {
  const unavailable = () => { throw new Error("Browser storage blocked"); };
  const storage = {
    get getItem() { return unavailable(); },
    get setItem() { return unavailable(); },
    get removeItem() { return unavailable(); },
  };
  const visit = createQuestionDraft({ storage });
  assert.equal(visit.read().storageAvailable, false);
  assert.equal(visit.edit("依然可以写").text, "依然可以写");
  assert.equal(visit.clear().clearPending, true);
  assert.equal(visit.undoClear().text, "依然可以写");
  assert.equal(visit.read().storageAvailable, false);
});

test("failed writes preserve the new in-memory draft and recover on the next successful edit", () => {
  const storage = memoryStorage();
  createQuestionDraft({ storage }).edit("旧草稿");
  let blocked = true;
  const visit = createQuestionDraft({ storage: {
    ...storage,
    setItem(key, value) {
      if (blocked) throw new Error("Quota exceeded");
      storage.setItem(key, value);
    },
  } });
  const changed = visit.edit("新草稿仍留在页面");
  assert.equal(changed.text, "新草稿仍留在页面");
  assert.equal(changed.storageAvailable, false);
  assert.equal(createQuestionDraft({ storage }).read().text, "旧草稿");
  blocked = false;
  assert.equal(visit.edit(changed.text).storageAvailable, true);
  assert.equal(createQuestionDraft({ storage }).read().text, changed.text);
});

test("a failed clear is reported and can be retried without losing the undo copy", () => {
  const storage = memoryStorage();
  createQuestionDraft({ storage }).edit("还在暂存的文字");
  let blocked = true;
  const visit = createQuestionDraft({ storage: {
    ...storage,
    removeItem(key) {
      if (blocked) throw new Error("Access revoked");
      storage.removeItem(key);
    },
  } });
  const cleared = visit.clear();
  assert.equal(cleared.text, "");
  assert.equal(cleared.clearPending, true);
  assert.equal(createQuestionDraft({ storage }).read().text, "还在暂存的文字");
  blocked = false;
  assert.equal(visit.clear().clearPending, false);
  assert.equal(createQuestionDraft({ storage }).read().text, "");
  assert.equal(visit.undoClear().text, "还在暂存的文字");
});

test("input limits reject oversize changes without corrupting the last usable draft", () => {
  const storage = memoryStorage();
  const visit = createQuestionDraft({ storage });
  const atLimit = "字".repeat(QUESTION_DRAFT_LIMIT);
  visit.edit(atLimit);
  for (const invalid of [atLimit + "字", null, 42]) assert.throws(() => visit.edit(invalid), RangeError);
  assert.equal(visit.read().text, atLimit);
  assert.equal(createQuestionDraft({ storage }).read().text, atLimit);
  const damaged = createQuestionDraft({ storage: { ...storage, getItem: () => atLimit + "字" } });
  assert.equal(damaged.read().text, "");
  assert.equal(damaged.read().storageAvailable, false);
  assert.equal(damaged.edit("重新开始").text, "重新开始");
});

test("question card wrapping preserves all text and never splits a grapheme", () => {
  const text = "关注🌱家人👨‍👩‍👧‍👦与世界\n下一行\n\n" + "想法".repeat(2000);
  const measure = (line) => [...new Intl.Segmenter("zh", { granularity: "grapheme" }).segment(line)].length;
  const lines = wrapCardText(text, measure, 8);
  assert.equal(lines.join(""), text.replaceAll("\n", ""));
  assert.ok(lines.some((line) => line.includes("👨‍👩‍👧‍👦")));
  assert.ok(lines.every((line) => measure(line) <= 8));
  assert.deepEqual(wrapCardText("", (line) => line.length, 8), [""]);
});
