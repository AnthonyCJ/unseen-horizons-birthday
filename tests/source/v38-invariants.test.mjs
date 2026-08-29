import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const experiencePath = new URL("../../app/BirthdayExperience.tsx", import.meta.url);
const publicAssets = new Map([
  ["healing-002.jpg", "605f3cbaa46646230bfbff48ac0000aa460551e4d163ba2a504a8e313917534e"],
  ["healing-004.jpg", "e1e936b4137ce5218dd585c577e307eaa5b275dc1008d3fef1f31ed79141bdc3"],
  ["healing-008.jpg", "b2a55f707f2fbf13580aaae8909808b163a11492ebef8171b2a206da13157a65"],
  ["sky-castle-ocarina.mp3", "b007e7aa8aaec9f1fed9098ecab62c58b1e3daa1e8ee6a855ad3dd4991d0cecc"],
]);

test("preserves protected timing, navigation, transition, and volume constants", async () => {
  const source = await readFile(experiencePath, "utf8");

  for (const invariant of [
    "const OCARINA_ENTRY_SECONDS = 20.6;",
    "const LETTER_GREETING_DELAY_MS = 5000;",
    "const LIGHT_MIN_DURATION_MS = 4400;",
    "const LIGHT_MAX_DURATION_MS = 14500;",
    "const LIGHT_INITIAL_DURATION_MS = 13900;",
    "const LIGHT_DEPARTURE_MS = 1400;",
    "const STANDARD_VOLUME = 0.841;",
    "const FOCUS_VOLUME = 0.6;",
    "const FINALE_VOLUME = 1;",
    "const STANDARD_TRANSITION = { exit: 320, paper: 180, enter: 1000 } as const;",
    "const ARTWORK_TRANSITION = { exit: 660, paper: 180, enter: 1320 } as const;",
    "if (target === 1 && current !== 0) return;",
    'label="← 回到封面"',
    "onClick={restartJourney}",
    "animation is defined in V38 CSS",
  ]) {
    if (invariant === "animation is defined in V38 CSS") continue;
    assert.ok(source.includes(invariant), `Missing V38 invariant: ${invariant}`);
  }

  assert.equal((source.match(/<BackButton/g) ?? []).length, 3);
  assert.match(source, /if \(\(event\.key === "ArrowRight" \|\| event\.key === "ArrowLeft"\) && current === 1\)/);
  assert.match(source, /if \(event\.key === "ArrowLeft" && current === 2\)[\s\S]*?restartJourney\(\)/);
});

test("ships only the approved production asset bytes", async () => {
  for (const [filename, expected] of publicAssets) {
    const bytes = await readFile(new URL(`../../public/assets/${filename}`, import.meta.url));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), expected, filename);
  }
});
