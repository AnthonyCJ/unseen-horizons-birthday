import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const experiencePath = new URL("../../app/BirthdayExperience.tsx", import.meta.url);
const stylesPath = new URL("../../app/globals.css", import.meta.url);

const expectedPrompt = `请围绕下面的任务先完成需求澄清。

成功条件
在执行前形成一份我已确认的任务简报，包含：
- 目标；
- 必要背景与已有材料；
- 使用场景或受众；
- 交付内容与形式；
- 关键约束和不可遗漏项；
- 成功标准；
- 已确认的选择；
- 仍保留的假设及其可能影响。

协作方式
1. 先简要复述你对目标、背景和交付内容的理解，不重复询问我已经提供的信息。
2. 只追问缺失且会实质影响结果的信息，按影响程度排序，每轮最多提出 5 个问题。
3. 对影响较小的信息缺口，提出合理默认值，并明确标记为“待确认假设”。
4. 存在会明显改变结果的多种选择时，给出 2～3 个选项，简述主要差异，并标明你的建议。
5. 信息足够后，整理任务简报。

开始条件
给出任务简报后暂停，等我明确回复“确认开始”再执行最终任务。
如果现有信息已经足够，请直接整理任务简报，无需为了提问而提问。

任务内容
【在这里写下你的需求】`;

test("implements the approved V40 page 04 copy without changing page 02", async () => {
  const source = await readFile(experiencePath, "utf8");

  for (const copy of [
    "For the Days Ahead",
    "想与你分享的三件小东西",
    "一种让事情慢慢清楚的方法，一点关于注意力的体会，还有一个可以带着继续往前的问题。",
    "让 AI 先问清楚，再开始",
    "最初的几句话可以只是一个起点，任务的轮廓会在接下来的对话里慢慢清楚起来。",
    "Harness Self",
    "让自己进入更清醒、更从容的状态，把更完整的注意力留给真正重要的事。",
    "带一个问题去远方",
    "有些问题会让人对尚未展开的日子多一点期待。",
    "新的一岁里，有没有一个问题，你愿意带着它继续往前走？",
    "先把它轻轻带上，再往前一点。",
  ]) {
    assert.ok(source.includes(copy), `Missing approved page 04 copy: ${copy}`);
  }

  const promptMatch = source.match(/const CLARIFYING_PROMPT = `([\s\S]*?)`;/);
  assert.equal(promptMatch?.[1], expectedPrompt);

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
    "findingButtonRefs.current[triggerIndex]?.focus()",
    "findingReaderCloseTimer.current = window.setTimeout(finishClosing, FINDING_READER_CLOSE_MS);",
    "body.style.position = \"fixed\"",
    "data-keyboard-nav-block",
    "navigator.clipboard.writeText(CLARIFYING_PROMPT)",
    "未能自动复制，可以手动选择文本",
    "inert={!promptExpanded}",
    'className={`prompt-drawer ${promptExpanded ? "is-open" : ""}`}',
    "if (current === 3 && target !== 3) resetFindingReader();",
    "setDiscoveriesReturning(current === 4);",
    "setActiveFinding(null);",
    "setPromptExpanded(false);",
    'style={{ "--action-delay": "9000ms" } as CSSProperties}',
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
  assert.doesNotMatch(source, /<(?:input|textarea)\b/i);
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
  assert.match(styles, /\.discoveries-scene\.is-returning[^}]*animation-duration:\s*720ms/s);
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
    /\.finding-question \{[^}]*font-family:\s*"Noto Serif SC", "Source Han Serif SC", "Songti SC", "STSong", serif;[^}]*font-weight:\s*500;[^}]*font-size:\s*clamp\(1\.12rem, 1\.32vw, 1\.28rem\)[^}]*line-height:\s*1\.78[^}]*letter-spacing:\s*0\.015em/s,
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
