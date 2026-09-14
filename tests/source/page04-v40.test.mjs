import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { CLARIFYING_PROMPT } from "../../lib/clarifying-prompt.mjs";
import { readFile } from "node:fs/promises";
import test from "node:test";

const experiencePath = new URL("../../app/BirthdayExperience.tsx", import.meta.url);
const stylesPath = new URL("../../app/globals.css", import.meta.url);

// Full v1.2.0 template body, excluding the source document heading and code fence.
const expectedPromptHash = "8d0c54fb613d6ed75a254e9487dc3d2c54add78b1698d0c45b7192e4c906f557";

test("implements the approved page 04 revision and full v1.2.0 Prompt without changing page 02", async () => {
  const source = await readFile(experiencePath, "utf8");

  for (const copy of [
    "For the Days Ahead",
    "想与你分享的三件小东西",
    "一个开始，一段时间，一个问题。",
    "让 AI 先问清楚，再开始",
    "给尚未成形的想法，一个更清楚的开端。",
    "把注意力，留给热爱的事",
    "带一个问题去远方",
    "有些问题，会让未来多一点值得期待的事。",
    "新的一岁里，有没有一个问题，你愿意带着它继续往前走？",
    "不必现在回答。让它陪你走一段路，",
    "也许沿途的经历，会带来新的线索。",
    "愿初生的灵感，",
    "在想象里舒展翅膀；",
    "从一个念头出发，",
    "飞向未曾设想的远方。",
    "愿求索有回响，",
    "停歇有晴朗；",
    "愿那些值得长久追问的问题，",
    "总能遇见你清醒、从容的目光。",
  ]) {
    assert.ok(source.includes(copy), `Missing approved page 04 copy: ${copy}`);
  }

  assert.equal(createHash("sha256").update(CLARIFYING_PROMPT).digest("hex"), expectedPromptHash);
  assert.ok(CLARIFYING_PROMPT.endsWith("【在这里写下你的需求；已有背景、材料、约束和偏好可一并提供，无需预先填满简报。】"));

  assert.ok(source.includes('{renderMeta("A Light for Today", 180)}'));
  assert.ok(source.includes('aria-label="十一月十三日">11·13</span>'));
  assert.doesNotMatch(source, /Observation 01/);
});

test("uses the approved overview and focus-reader interaction without adding completion gates", async () => {
  const source = await readFile(experiencePath, "utf8");

  for (const interaction of [
    "const [activeFinding, setActiveFinding] = useState<number | null>(null);",
    "const [findingReaderVisible, setFindingReaderVisible] = useState(false);",
    "const [findingReaderClosing, setFindingReaderClosing] = useState(false);",
    "const openFindingReader = useCallback((index: number) => {",
    "const closeFindingReader = useCallback((restoreFocus = true) => {",
    "role=\"dialog\"",
    "aria-modal=\"true\"",
    "aria-haspopup=\"dialog\"",
    "展开阅读",
    "inert={activeFinding !== null}",
    "findingReaderScrollRef",
    "if (event.key === \"Escape\")",
    "findingButtonRefs.current[triggerIndex]?.focus({ preventScroll: true })",
    "findingReaderCloseTimer.current = window.setTimeout(finishClosing, FINDING_READER_CLOSE_MS);",
    "body.style.position = \"fixed\"",
    "data-keyboard-nav-block",
    "navigator.clipboard.writeText(CLARIFYING_PROMPT)",
    "未能自动复制，可以手动选择文本",
    "inert={!promptExpanded}",
    'className={`prompt-drawer ${promptExpanded ? "is-open" : ""}`}',
    "if (current === 3 && target !== 3) resetFindingReader();",
    "resetSceneReveals();",
    "resetReaderReveals();",
    "setActiveFinding(null);",
    "setPromptExpanded(false);",
    'style={{ "--action-delay": "6200ms" } as CSSProperties}',
  ]) {
    assert.ok(source.includes(interaction), `Missing page 04 interaction: ${interaction}`);
  }

  for (const sceneKey of ["cover", "light", "letter", "discoveries", "finale"]) {
    assert.ok(source.includes(`key="${sceneKey}"`), `Missing remount key for ${sceneKey}`);
  }

  assert.match(
    source,
    /className="finding-toggle"[\s\S]*?type="button"[\s\S]*?aria-haspopup="dialog"/,
  );
  assert.doesNotMatch(source, /discoveriesVisited/);
  assert.match(source, /<InspirationNote note=\{inspiration\}/);
  assert.match(source, /textarea, input, select, \[contenteditable\]/);
  assert.match(source, /下一件：/);
  assert.doesNotMatch(source, /上一条|下一条|阅读进度|已读|顺序解锁/);
  assert.match(source, /copyStatus === "success" \? "已复制" : "复制完整 Prompt"/);
});

test("uses a full-width overview and one reduced-motion-safe reader scroll context", async () => {
  const styles = await readFile(stylesPath, "utf8");

  assert.match(styles, /\.stage \{[\s\S]*?width:\s*100%[\s\S]*?height:\s*100svh/);
  assert.match(styles, /\.stage\[data-page="4"\][\s\S]*?height:\s*100svh[\s\S]*?overflow:\s*hidden/);
  assert.match(styles, /\.finding-toggle[\s\S]*?border:[\s\S]*?background:[\s\S]*?box-shadow:/);
  assert.match(styles, /\.finding-open-label/);
  assert.match(styles, /\.finding-reader-layer[\s\S]*?position:\s*fixed/);
  assert.match(styles, /\.finding-reader[\s\S]*?overflow:\s*hidden/);
  assert.match(
    styles,
    /\.finding-reader-scroll[\s\S]*?overflow-y:\s*auto[\s\S]*?overflow-x:\s*hidden[\s\S]*?overscroll-behavior:\s*contain/,
  );
  assert.match(styles, /\.prompt-text[\s\S]*?white-space:\s*pre-wrap;[\s\S]*?overflow-wrap:\s*anywhere/);
  assert.match(styles, /\.prompt-drawer \{[^}]*grid-template-rows:\s*0fr[^}]*520ms/s);
  assert.match(styles, /\.prompt-drawer\.is-open \{[^}]*grid-template-rows:\s*1fr[^}]*620ms/s);
  assert.match(styles, /\.prompt-label-stack > span \{[^}]*380ms/s);
  assert.match(
    styles,
    /@media \(max-width: 640px\)[\s\S]*?\.stage\[data-page="4"\][\s\S]*?height:\s*auto[\s\S]*?\.finding-reader[\s\S]*?height:\s*100svh/,
  );
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(
    styles,
    /\.(?:finding-detail|prompt-text)[^{]*\{[^}]*overflow(?:-y)?:\s*(?:auto|scroll)/s,
  );
});

test("keeps the focus reader mounted through its softened closing state", async () => {
  const [source, styles] = await Promise.all([
    readFile(experiencePath, "utf8"),
    readFile(stylesPath, "utf8"),
  ]);

  for (const closingInvariant of [
    "const FINDING_READER_CLOSE_MS = 780;",
    "if (activeFinding === null || findingReaderClosing) return;",
    "setFindingReaderClosing(true);",
    "setFindingReaderVisible(false);",
    "clearFindingReaderCloseTimer();",
    'data-state={findingReaderClosing ? "closing" : findingReaderVisible ? "open" : "opening"}',
    'aria-disabled={findingReaderClosing}',
    'findingReaderClosing ? "is-reader-closing" : ""',
  ]) {
    assert.ok(source.includes(closingInvariant), `Missing reader closing invariant: ${closingInvariant}`);
  }

  const closeBlock = source.match(
    /const closeFindingReader = useCallback\(\(restoreFocus = true\) => \{([\s\S]*?)\n  \}, \[activeFinding/,
  )?.[1] ?? "";
  assert.match(closeBlock, /const finishClosing = \(\) => \{[\s\S]*?setActiveFinding\(null\);[\s\S]*?requestAnimationFrame/);
  assert.match(closeBlock, /if \(reducedMotion\) \{\s*finishClosing\(\);\s*return;\s*\}/);
  assert.match(closeBlock, /setFindingReaderClosing\(true\);[\s\S]*?window\.setTimeout\(finishClosing, FINDING_READER_CLOSE_MS\)/);

  assert.match(
    styles,
    /\.finding-reader-layer \{[^}]*opacity:\s*0;[^}]*transition:\s*opacity 840ms/s,
  );
  assert.match(
    styles,
    /\.finding-reader \{[^}]*height:\s*min\(46rem, calc\(100svh - 4\.5rem\)\)[^}]*translateY\(4px\)[^}]*840ms/s,
  );
  assert.match(
    styles,
    /\.finding-reader-layer\.is-open \.finding-reader \{[^}]*translateY\(0\)/s,
  );
  assert.match(
    styles,
    /\.finding-reader-layer\.is-closing \{[^}]*opacity:\s*0;[^}]*780ms/s,
  );
  assert.match(
    styles,
    /\.finding-reader-layer\.is-closing \.finding-reader \{[^}]*translateY\(4px\)[^}]*780ms/s,
  );

  const readerMotion = styles.slice(
    styles.indexOf(".finding-reader {"),
    styles.indexOf(".finding-reader-header {"),
  );
  assert.doesNotMatch(readerMotion, /scale\(/);

  const backgroundRule = styles.match(
    /\.stage\.is-reading \.discoveries-copy,[\s\S]*?\.stage\.is-reading \.visual-panel\.is-active \{([^}]*)\}/,
  )?.[1] ?? "";
  assert.match(backgroundRule, /saturate\(0\.78\) brightness\(0\.94\)/);
  assert.match(backgroundRule, /opacity:\s*0\.5/);
  assert.match(backgroundRule, /840ms/);
  assert.doesNotMatch(backgroundRule, /blur\(/);
});

test("uses the approved artwork rhythm, finale mix, and smile trajectory", async () => {
  const [source, styles] = await Promise.all([
    readFile(experiencePath, "utf8"),
    readFile(stylesPath, "utf8"),
  ]);

  for (const timingInvariant of [
    "const STANDARD_TRANSITION = { exit: 320, paper: 180, enter: 1000 } as const;",
    "const ARTWORK_TRANSITION = { exit: 660, paper: 180, enter: 1320 } as const;",
    "const FINALE_BASE_VOLUME = 0.78;",
    "const FINALE_BASE_FADE_DURATION_MS = 3200;",
    "const FINALE_LIFT_DELAY_MS = 12200;",
    "const FINALE_LIFT_DURATION_MS = 5200;",
    ": current === 4",
    "? FINALE_BASE_VOLUME",
  ]) {
    assert.ok(source.includes(timingInvariant), `Missing approved timing or volume invariant: ${timingInvariant}`);
  }

  assert.match(styles, /paper-veil-cover 660ms/);
  assert.match(styles, /paper-veil-reveal 1320ms/);
  assert.match(styles, /artwork-scene-exit 660ms/);
  assert.match(styles, /artwork-scene-enter 1320ms/);
  assert.match(styles, /artwork-mobile-art-settle 1320ms/);
  assert.match(styles, /\.reading-recalled[^}]*animation:\s*none !important/s);
  assert.match(styles, /\.finale-smile-mark \{[^}]*2160ms 9800ms[^}]*cubic-bezier\(0\.4, 0, 0\.2, 1\)/s);
  assert.match(styles, /from \{ transform: translateY\(-0\.22em\) rotate\(0deg\); \}/);
  assert.match(styles, /to \{ transform: translateY\(0\.14em\) rotate\(90deg\); \}/);
  assert.match(
    styles,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.finale-smile-mark \{[^}]*translateY\(0\.14em\) rotate\(90deg\)/,
  );
});

test("locks the page 01 offset, question typography, equal spacing, and neutral seams", async () => {
  const styles = await readFile(stylesPath, "utf8");

  assert.match(
    styles,
    /@media \(min-width: 1200px\) \{[\s\S]*?\.cover-copy \{ transform: translateX\(clamp\(24px, calc\(5\.556vw - 42\.67px\), 72px\)\); \}/,
  );
  assert.match(
    styles,
    /@media \(max-width: 640px\)[\s\S]*?\.cover-copy \{[^}]*transform:\s*translateX\(0\)/,
  );
  assert.match(
    styles,
    /@media \(min-width: 641px\) \{[\s\S]*?\.cover-message-group,[\s\S]*?\.cover-core > \.scene-actions \{[^}]*margin-inline-start:\s*clamp\(0px, calc\(10vw - 64px\), 160px\)/,
  );

  assert.match(styles, /\.finding-detail-question \{\s*display:\s*grid;\s*gap:\s*clamp\(1rem, 1\.4vw, 1\.25rem\);/);
  assert.match(styles, /\.finding-detail-question > p \{ margin:\s*0 !important; \}/);
  assert.match(
    styles,
    /\.finding-question \{[^}]*font-family:\s*"Noto Serif SC", "Source Han Serif SC", "Songti SC", "STSong", serif;[^}]*font-weight:\s*500;[^}]*font-size:\s*clamp\(1\.25rem, 2\.05vw, 1\.8rem\)[^}]*line-height:\s*1\.78[^}]*letter-spacing:\s*0\.015em/s,
  );
  assert.doesNotMatch(styles, /\.finding-question-closing\s*\{/);
  assert.match(styles, /\.finding-harness-closing \{[^}]*clamp\(1\.7rem, 2\.6vw, 2\.35rem\)/);

  assert.match(styles, /--art-blend-width:\s*clamp\(48px, 4\.2vw, 72px\);/);
  assert.match(styles, /--art-blend-height:\s*clamp\(48px, 7\.5svh, 64px\);/);
  assert.doesNotMatch(styles, /--discoveries-edge-(?:blue|violet|pearl)/);

  for (const selector of ["cover-art", "discoveries-art", "finale-visual"]) {
    const seamRules = [...styles.matchAll(new RegExp(`\\.${selector}::after\\s*\\{([^}]*)\\}`, "g"))]
      .filter(([, body]) => /background:/.test(body));
    assert.equal(seamRules.length, 2, `${selector} should have one desktop and one mobile seam rule`);
    for (const [, body] of seamRules) {
      assert.equal((body.match(/linear-gradient\(/g) ?? []).length, 1, `${selector} must use one gradient layer`);
      assert.match(body, /var\(--paper\)/);
      assert.doesNotMatch(body, /rgba\(188, 197, 228|rgba\(202, 186, 241|rgba\(213, 211, 249/);
    }
  }
});
