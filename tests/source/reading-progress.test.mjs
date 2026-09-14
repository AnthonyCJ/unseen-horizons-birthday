import assert from "node:assert/strict";
import test from "node:test";
import {
  EMPTY_READING_PROGRESS, READING_STORAGE_KEY, advanceReadingProgress,
  parseReadingProgress, readingShortcutLabel, updateReadingProgress,
} from "../../lib/reading-progress.mjs";
import { isPreviewVisit } from "../../lib/gift-preview.mjs";

function memoryStorage(entries = []) {
  const values = new Map(entries);
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test("overview visits offer continuation; only opening all three details offers revisiting", () => {
  let record = { ...EMPTY_READING_PROGRESS };
  assert.equal(readingShortcutLabel(record), null);
  record = advanceReadingProgress(record, { atOverview: true });
  assert.equal(readingShortcutLabel(record), "继续翻阅三件小东西");
  for (const openedFinding of [2, 2, 0, 0]) {
    record = advanceReadingProgress(record, { openedFinding });
    assert.equal(readingShortcutLabel(record), "继续翻阅三件小东西");
  }
  record = advanceReadingProgress(record, { openedFinding: 1 });
  assert.equal(readingShortcutLabel(record), "回看三件小东西");
});

test("invalid input and legacy overview-only flags cannot establish completed reading", () => {
  for (const invalid of [null, "true", "broken", "{}", '{"version":1,"overview":true,"opened":7}',
    '{"version":2,"overview":true,"opened":8}', '{"version":2,"overview":true,"opened":-1}',
    '{"version":2,"overview":"true","opened":7}', '{"version":2,"overview":true,"opened":1.5}']) {
    assert.deepEqual(parseReadingProgress(invalid), EMPTY_READING_PROGRESS);
  }
  for (const openedFinding of [-1, 3, 100, 0.5, "0", null, undefined]) {
    assert.deepEqual(advanceReadingProgress(EMPTY_READING_PROGRESS, { openedFinding }), EMPTY_READING_PROGRESS);
  }
  const storage = memoryStorage([["birthday-page04-visited", "true"]]);
  const current = updateReadingProgress({ storage, current: EMPTY_READING_PROGRESS, preview: false });
  assert.equal(readingShortcutLabel(current), null);
});

test("reading persists locally, merges visits from multiple tabs, and starts empty in another browser", () => {
  const storage = memoryStorage();
  const visit = (current, openedFinding) => updateReadingProgress({ storage, current, openedFinding, preview: false });
  const firstTab = visit(EMPTY_READING_PROGRESS, 0);
  const secondTab = visit(EMPTY_READING_PROGRESS, 2);
  assert.equal(secondTab.opened, 5);
  const complete = visit(firstTab, 1);
  assert.equal(complete.opened, 7);
  assert.deepEqual(parseReadingProgress(storage.getItem(READING_STORAGE_KEY)), complete);
  assert.equal(readingShortcutLabel(visit(EMPTY_READING_PROGRESS, null)), "回看三件小东西");
  assert.deepEqual(updateReadingProgress({ storage: memoryStorage(), current: EMPTY_READING_PROGRESS, preview: false }), EMPTY_READING_PROGRESS);
});

test("preview reading never touches normal storage and a fresh preview starts empty", () => {
  const storage = { getItem() { assert.fail("Preview must not read normal progress"); }, setItem() { assert.fail("Preview must not write normal progress"); } };
  let current = { ...EMPTY_READING_PROGRESS };
  for (const openedFinding of [0, 1, 2]) current = updateReadingProgress({ storage, current, preview: true, openedFinding });
  assert.equal(readingShortcutLabel(current), "回看三件小东西");
  assert.equal(readingShortcutLabel(updateReadingProgress({ storage, current: EMPTY_READING_PROGRESS, preview: true })), null);
});

test("storage denial leaves a usable in-memory reading journey", () => {
  const storage = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("denied"); } };
  let current = { ...EMPTY_READING_PROGRESS };
  for (const openedFinding of [1, 0, 2]) current = updateReadingProgress({ storage, current, preview: false, openedFinding });
  assert.equal(readingShortcutLabel(current), "回看三件小东西");
});

test("preview mode requires an explicit query value", () => {
  assert.equal(isPreviewVisit("?preview=1"), true);
  assert.equal(isPreviewVisit("?x=2&preview=1"), true);
  for (const query of ["", "?preview", "?preview=0", "?preview=true", "?x=preview%3D1"]) assert.equal(isPreviewVisit(query), false);
});
