import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const experiencePath = new URL("../../app/BirthdayExperience.tsx", import.meta.url);
const stylesPath = new URL("../../app/globals.css", import.meta.url);

function section(text, start, end) {
  const startIndex = text.indexOf(start);
  const endIndex = text.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `Missing section start: ${start}`);
  assert.notEqual(endIndex, -1, `Missing section end: ${end}`);
  return text.slice(startIndex, endIndex);
}

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

test("uses semantic compact three-row compositions inside the desktop envelopes", async () => {
  const [source, styles] = await Promise.all([
    readFile(experiencePath, "utf8"),
    readFile(stylesPath, "utf8"),
  ]);

  for (const className of [
    "cover-core",
    "cover-message-group",
    "letter-heading-group",
    "letter-message-group",
    "letter-footer-group",
    "finale-core",
    "finale-message-group",
  ]) {
    assert.match(source, new RegExp(`className="${className}"`));
  }

  assert.match(styles, /\.cover-core \{[^}]*grid-template-rows:\s*auto auto auto[^}]*align-content:\s*center/s);
  assert.match(styles, /\.letter-copy \{[^}]*grid-template-rows:\s*auto auto auto[^}]*align-content:\s*center/s);
  assert.match(styles, /\.finale-core \{[^}]*grid-template-rows:\s*auto auto auto[^}]*align-content:\s*center/s);

  const shortDesktop = section(
    styles,
    "@media (min-width: 1200px) {",
    "@media (min-width: 1200px) and (min-height: 850px)",
  );
  for (const [selector, size] of [
    ["cover-core", "48svh"],
    ["letter-copy", "52svh"],
    ["finale-core", "48svh"],
  ]) {
    assert.match(shortDesktop, new RegExp(`\\.${selector} \\{[\\s\\S]*?min-block-size:\\s*${size}`));
  }
  assert.match(styles, /\.light-inner \{[^}]*min-block-size:\s*calc\(100svh - clamp\(4rem, 12svh, 8rem\)\)[^}]*grid-template-rows:\s*2\.3rem minmax\(0, 1fr\) 2\.3rem/s);
  assert.match(shortDesktop, /\.orb-stage \{ width:\s*clamp\(158px, min\(12\.6vw, 29svh\), 184px\); \}/);
  assert.match(shortDesktop, /\.date-orb, \.ripple \{ width:\s*clamp\(120px, min\(9\.8vw, 22svh\), 138px\); \}/);
  assert.match(shortDesktop, /\.light-kinetic-field \{ width:\s*clamp\(430px, min\(38vw, 70svh\), 560px\); \}/);
  assert.match(shortDesktop, /\.cover-core > \.scene-meta \{ padding-inline-end:\s*clamp\(4\.5rem, 6vw, 12rem\); \}/);

  const highDesktop = section(
    styles,
    "@media (min-width: 1200px) and (min-height: 850px) {",
    "@media (max-width: 640px)",
  );
  for (const [selector, size] of [
    ["cover-core", "52svh"],
    ["letter-copy", "58svh"],
    ["finale-core", "52svh"],
  ]) {
    assert.match(highDesktop, new RegExp(`\\.${selector} \\{[\\s\\S]*?min-block-size:\\s*${size}`));
  }
  assert.match(styles, /\.light-inner \{[^}]*width:\s*min\(90%, 960px\)/s);
  assert.match(styles, /\.light-scene \.music-control-slot\.is-suppressed \{ display: none; \}/);
  assert.match(highDesktop, /\.orb-stage \{ width:\s*clamp\(196px, 12\.1vw, 232px\); \}/);
  assert.match(highDesktop, /\.date-orb, \.ripple \{ width:\s*clamp\(148px, 8\.75vw, 168px\); \}/);
  assert.match(highDesktop, /\.light-kinetic-field \{ width:\s*clamp\(640px, min\(39\.5vw, 72svh\), 760px\); \}/);

  assert.match(styles, /@media \(min-width: 1200px\)[\s\S]*?clamp\(24px, calc\(5\.556vw - 42\.67px\), 72px\)/);
  assert.match(styles, /@media \(min-width: 641px\)[\s\S]*?margin-inline-start:\s*clamp\(0px, calc\(10vw - 64px\), 160px\)/);
  assert.match(styles, /@media \(min-width: 641px\)[\s\S]*?\.cover-core > \.scene-meta \{[^}]*padding-inline-start:\s*clamp\(0px, calc\(10vw - 64px\), 160px\)/s);
  assert.match(styles, /@media \(min-width: 641px\) and \(max-width: 1199px\) \{[\s\S]*?padding-inline-end:\s*clamp\(1\.5rem, 4vw, 3rem\)/);
  assert.doesNotMatch(styles, /@media \(min-width: 1600px\)/);
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*?\.cover-copy \{[^}]*translateX\(0\)/s);
});

test("preserves gentle title pacing with a longer four-character cover reveal", async () => {
  const [source, styles] = await Promise.all([
    readFile(experiencePath, "utf8"),
    readFile(stylesPath, "utf8"),
  ]);

  for (const titlePace of [
    '<CharacterReveal text="未知风光" baseDelay={1000} step={450} fadeDuration={1400} />',
    '<CharacterReveal text="生日快乐，Charlotte。" baseDelay={LETTER_GREETING_DELAY_MS} />',
    '<CharacterReveal text="想与你分享的三件小东西" baseDelay={1050} wrapAfter={6} />',
    '<CharacterReveal text="不知远方还藏着怎样的风光" baseDelay={1350} />',
  ]) {
    assert.ok(source.includes(titlePace), `Missing revised title pace: ${titlePace}`);
  }
  assert.doesNotMatch(styles, /cover-character-unfold/);
  assert.doesNotMatch(styles, /\.section-title \.character\s*\{/);
  assert.match(source, /const TITLE_CHARACTER_STEP_MS = 160;/);
  assert.match(source, /step = TITLE_CHARACTER_STEP_MS/);
  assert.match(source, /const CHARACTER_FADE_MS = 1100;/);
  assert.match(styles, /--text-reveal-ease: cubic-bezier\(0\.42, 0, 0\.58, 1\)/);

  const characterMotion = section(styles, ".character {", ".phrase-reveal {");
  assert.match(characterMotion, /1100ms/);
  assert.match(characterMotion, /var\(--text-reveal-ease\)/);
  assert.doesNotMatch(characterMotion, /transform:|filter:/);

  const phraseMotion = section(styles, ".phrase-reveal {", ".delayed-action {");
  assert.match(phraseMotion, /1500ms/);
  assert.match(phraseMotion, /var\(--text-reveal-ease\)/);
  assert.doesNotMatch(phraseMotion, /transform:|filter:/);

  const metaMotion = section(styles, ".scene-meta-unified {", ".meta-tools");
  assert.match(metaMotion, /720ms/);
  assert.doesNotMatch(metaMotion, /transform:|filter:/);

  const actionMotion = section(styles, ".delayed-action {", ".light-scene .phrase-reveal");
  assert.match(actionMotion, /720ms/);
  assert.doesNotMatch(actionMotion, /transform:|filter:/);

  assert.match(styles, /\.finding-note \{[^}]*1100ms/s);
  const findingMotion = section(styles, "@keyframes finding-enter", ".reading-recalled");
  assert.doesNotMatch(findingMotion, /transform:|filter:/);
  assert.match(source, /const unifiedMotion = page !== 2;/);
});

test("locks the revised calm-reading text start times", async () => {
  const [source, styles] = await Promise.all([
    readFile(experiencePath, "utf8"),
    readFile(stylesPath, "utf8"),
  ]);

  for (const invariant of [
    'renderMeta("Field Note · 11 / 13", 200)',
    '<CharacterReveal text="未知风光" baseDelay={1000} step={450} fadeDuration={1400} />',
    '<Reveal delay={4200} className="copy-secondary subtitle">',
    '<Reveal delay={6000} className="intro-copy">',
    'style={{ "--action-delay": "8000ms" } as CSSProperties}',
    'renderMeta("A Small Note", 240)',
    'baseDelay={LETTER_GREETING_DELAY_MS}',
    'baseDelay={10200} unfoldDuration={3600}',
    'baseDelay={14900} unfoldDuration={4100}',
    'baseDelay={19900} unfoldDuration={4400}',
    'baseDelay={25400} unfoldDuration={4400} fadeDuration={3200}',
    'baseDelay={30400} unfoldDuration={4250} fadeDuration={3200}',
    'baseDelay={35150} unfoldDuration={5150} fadeDuration={3400}',
    'baseDelay={40950} unfoldDuration={4450} fadeDuration={3200}',
    'style={{ "--action-delay": "48920ms" } as CSSProperties}',
    'renderMeta("For the Days Ahead", 220)',
    'baseDelay={1050} wrapAfter={6}',
    '<Reveal delay={2950}>',
    '`${3900 + index * 650}ms`',
    'style={{ "--action-delay": "6200ms" } as CSSProperties}',
    'renderMeta("Unseen Horizons", 220)',
    'baseDelay={1350}',
    '<Reveal delay={5400}>',
    '<Reveal delay={7800}>',
    '<Reveal delay={10800}',
    'style={{ "--action-delay": "12800ms" } as CSSProperties}',
  ]) {
    assert.ok(source.includes(invariant), `Missing V41 start-time invariant: ${invariant}`);
  }

  assert.match(source, /const LETTER_GREETING_DELAY_MS = 5000;/);
  assert.match(source, /const FINALE_LIFT_DELAY_MS = 12200;/);
  assert.match(styles, /\.enter-line\.line-late \{[^}]*calc\(46400ms \+ var\(--letter-sync-adjustment, 0ms\)\)/s);
  assert.match(styles, /finale-smile-appear 600ms 9200ms/);
  assert.match(styles, /finale-smile-turn 2160ms 9800ms/);
});

test("renders content 3 as a top-to-bottom reading sequence with a calm opacity-only question", async () => {
  const [source, styles] = await Promise.all([
    readFile(experiencePath, "utf8"),
    readFile(stylesPath, "utf8"),
  ]);

  for (const invariant of [
    'const FINDING_QUESTION_TEXT = "新的一岁里，有没有一个问题，你愿意带着它继续往前走？";',
    '"新的一岁里，"',
    '"有没有一个问题，"',
    '"你愿意带着它继续往前走？"',
    "const FINDING_QUESTION_BASE_DELAY_MS = 2500;",
    "const FINDING_QUESTION_STEP_MS = 175;",
    "const FINDING_QUESTION_AFTER_DELAY_MS = 8300;",
    "const FINDING_QUESTION_CLOSING_DELAY_MS = 10200;",
    "let characterIndex = 0;",
    "const currentIndex = characterIndex;",
    "characterIndex += 1;",
    'data-character-index={currentIndex}',
    'aria-label={FINDING_QUESTION_TEXT}',
  ]) {
    assert.ok(source.includes(invariant), `Missing question invariant: ${invariant}`);
  }

  assert.match(styles, /\.finding-question-segment \{[^}]*white-space:\s*nowrap/s);
  assert.match(styles, /\.finding-reader-layer:is\(\.is-open, \.is-closing\) \.finding-question-line \{[^}]*1500ms[^}]*var\(--finding-line-delay\)/s);
  assert.match(styles, /\.finding-reader-layer:is\(\.is-open, \.is-closing\) \.finding-question-character \{[^}]*1100ms[^}]*var\(--question-char-delay\)/s);
  const questionCharacterRule = section(
    styles,
    ".finding-reader-layer:is(.is-open, .is-closing) .finding-question-character {",
    "@keyframes finding-question-line-reveal",
  );
  const questionCharacterKeyframes = section(
    styles,
    "@keyframes finding-question-character-reveal",
    ".prompt-tool {",
  );
  assert.match(questionCharacterKeyframes, /from \{ opacity:\s*0; \}/);
  assert.match(questionCharacterKeyframes, /to \{ opacity:\s*1; \}/);
  assert.doesNotMatch(questionCharacterRule + questionCharacterKeyframes, /transform:|filter:|scale\(/);
  assert.equal((source.match(/className="finding-question-line/g) ?? []).length, 2);
});

test("keeps the softened 840/780 reader state machine while removing every panel scale", async () => {
  const [source, styles] = await Promise.all([
    readFile(experiencePath, "utf8"),
    readFile(stylesPath, "utf8"),
  ]);

  for (const invariant of [
    "const FINDING_READER_CLOSE_MS = 780;",
    "setFindingReaderClosing(true);",
    "findingReaderCloseTimer.current = window.setTimeout(finishClosing, FINDING_READER_CLOSE_MS);",
    'data-state={findingReaderClosing ? "closing" : findingReaderVisible ? "open" : "opening"}',
    "if (reducedMotion) {",
  ]) {
    assert.ok(source.includes(invariant), `Missing reader state invariant: ${invariant}`);
  }

  const readerMotion = section(styles, ".finding-reader-layer {", ".finding-reader-header {");
  assert.match(readerMotion, /transition:\s*opacity 840ms/);
  assert.match(readerMotion, /opacity:\s*0; transform:\s*translateY\(4px\)/);
  assert.match(readerMotion, /is-open \.finding-reader \{ opacity:\s*1; transform:\s*translateY\(0\)/);
  assert.match(readerMotion, /is-closing[^}]*780ms/s);
  assert.match(readerMotion, /is-closing \.finding-reader \{[^}]*translateY\(4px\)[^}]*780ms/s);
  assert.doesNotMatch(readerMotion, /scale\(/);

  const reducedMotion = section(styles, "@media (prefers-reduced-motion: reduce)", "}",);
  assert.ok(styles.includes(".finding-question-character, .finding-question-line {\n    opacity: 1;\n    animation: none !important;"));
  assert.ok(reducedMotion.length > 0);
});

test("keeps page 02 JSX isolated while making its BGM-locked choreography perceptible", async () => {
  const [source, styles] = await Promise.all([
    readFile(experiencePath, "utf8"),
    readFile(stylesPath, "utf8"),
  ]);

  const page02 = section(source, "    if (current === 1) {", "    if (current === 2) {");
  assert.equal(
    sha256(page02),
    "ff6604ac6c9a5c1a372ff22fe32f449f453b6c800c8b3a420dae958f3926032a",
  );
  assert.match(page02, /renderMeta\("A Light for Today", 180\)/);
  assert.match(page02, /aria-label="十一月十三日">11·13<\/span>/);
  assert.doesNotMatch(page02, /CharacterReveal|scene-meta-unified|Observation 01/);

  for (const invariant of [
    "const OCARINA_ENTRY_SECONDS = 20.6;",
    "const LIGHT_MIN_DURATION_MS = 4400;",
    "const LIGHT_MAX_DURATION_MS = 14500;",
    "const LIGHT_INITIAL_DURATION_MS = 13900;",
    "const LIGHT_DEPARTURE_MS = 1400;",
    "const LIGHT_SCORE_BPM = 92.95;",
    "const LIGHT_SCORE_BEAT_MS = 60000 / LIGHT_SCORE_BPM;",
    "const LIGHT_SCORE_DURATION_MS = LETTER_SCENE_TARGET_SECONDS * 1000;",
    "const LETTER_SCENE_TARGET_SECONDS = OCARINA_ENTRY_SECONDS - LETTER_GREETING_DELAY_MS / 1000;",
    "const setLightScoreTime = useCallback((audioTime: number) => {",
    'lightScene.style.setProperty("--light-score-duration", `${LIGHT_SCORE_DURATION_MS}ms`);',
    'lightScene.style.setProperty("--light-score-delay", `${(-scoreTime * 1000).toFixed(2)}ms`);',
    'lightScene.style.setProperty("--light-score-play-state", "paused");',
    'lightScene.style.setProperty("--light-beat-duration", `${LIGHT_SCORE_BEAT_MS.toFixed(2)}ms`);',
    "const prepareLightScoreFallback = useCallback((duration: number) => {",
    'lightScene.style.setProperty("--light-score-play-state", "running");',
    "const startLightSyncClock = useCallback(() => {",
    "lightSyncFrame.current = window.requestAnimationFrame(tick);",
    "if (audioTime >= LETTER_SCENE_TARGET_SECONDS) {",
    'setLightStage((stage) => stage === "lighting" ? "departing" : stage);',
    "onTimeUpdate={syncLightToMusic}",
    "const [letterSyncAdjustmentMs, setLetterSyncAdjustmentMs] = useState(0);",
    "(LETTER_SCENE_TARGET_SECONDS - audio.currentTime) * 1000",
    'style={{ "--letter-sync-adjustment": `${letterSyncAdjustmentMs}ms` } as CSSProperties}',
  ]) {
    assert.ok(source.includes(invariant), `Missing page 02 timing invariant: ${invariant}`);
  }

  assert.match(styles, /\.light-scene \.phrase-reveal \{[^}]*1400ms/s);
  const lightScore = section(styles, ".light-stage:not(.is-waiting) .light-inner,", ".light-actions {");
  for (const invariant of [
    "animation-duration: var(--light-score-duration)",
    "animation-delay: var(--light-score-delay)",
    "animation-play-state: var(--light-score-play-state)",
    "@keyframes light-score-vignette",
    "@keyframes light-score-aurora",
    "@keyframes light-score-content",
    "0%, 91.03%",
    "@keyframes light-score-core-aura",
    "@keyframes light-score-core-ring",
    "@keyframes light-score-orb",
    "14.1%",
    "35.26%",
    "38.55%",
    "55.07%",
    "71.62%",
    "88.12%",
    "91.24%",
    "@keyframes light-score-beacon-one",
    "@keyframes light-score-beacon-two",
    "@keyframes light-score-beacon-three",
    "@keyframes light-score-ripple-one",
    "@keyframes light-score-ripple-two",
    "@keyframes light-score-ripple-three",
    "@keyframes light-score-ripple-four",
    "@keyframes light-score-wash",
  ]) {
    assert.ok(lightScore.includes(invariant), `Missing BGM score invariant: ${invariant}`);
  }
  const stableContent = section(styles, "@keyframes light-score-content", "@keyframes light-score-core-aura");
  const stableOrb = section(styles, "@keyframes light-score-orb", "@keyframes light-score-date-mark");
  const stableDate = section(styles, "@keyframes light-score-date-mark", "@keyframes light-score-ambient-one");
  assert.match(stableContent, /91\.03% \{ opacity: 1; \}[\s\S]*94\.37% \{ opacity: 0\.9; \}[\s\S]*100% \{ opacity: 0; \}/);
  assert.doesNotMatch(stableContent, /transform:/);
  assert.match(stableOrb, /transform:\s*translateY\(0\) scale\(1\); filter:\s*none/);
  assert.doesNotMatch(stableOrb, /translateY\((?!0\))/);
  assert.doesNotMatch(stableDate, /transform:|letter-spacing:|filter:/);
  assert.match(styles, /\.date-mark \{[^}]*letter-spacing:\s*0\.04em/s);
  assert.doesNotMatch(styles, /\.light-stage:not\(\.is-waiting\) \.date-orb::after \{ animation-name:/);
  assert.match(lightScore, /light-score-ripple-four[\s\S]*scale\(5\.8\)/);
  assert.match(styles, /\.light-track-line \{[^}]*border:\s*1\.25px solid rgba\(118, 139, 205, 0\.5\)/s);
  assert.match(styles, /\.light-track-beacon \{[^}]*width:\s*7px/s);
  assert.match(styles, /\.light-node \{[^}]*width:\s*6px/s);
  assert.ok(styles.includes("width: clamp(640px, min(39.5vw, 72svh), 760px)"));
  assert.doesNotMatch(lightScore, /orb-breathe|light-track-turn|rotate\(360deg\)|infinite reverse/);

  for (const timingVariable of ["meta-delay", "char-delay", "reveal-delay", "action-delay"]) {
    assert.match(
      styles,
      new RegExp(`\\.letter-scene \\.[^{]+\\{[^}]*var\\(--${timingVariable}\\) \\+ var\\(--letter-sync-adjustment, 0ms\\)`),
    );
  }
});

test("gives the audited BGM accents explicit outer-only visual peaks", async () => {
  const styles = await readFile(stylesPath, "utf8");
  const bloom = section(
    styles,
    "@keyframes light-score-accent-bloom",
    "@keyframes light-score-accent-spark",
  );
  const spark = section(
    styles,
    "@keyframes light-score-accent-spark",
    "@keyframes light-score-track-one",
  );

  assert.match(
    styles,
    /\.light-kinetic-field::before, \.light-kinetic-field::after \{[^}]*opacity:\s*0[^}]*will-change:\s*opacity, transform/s,
  );
  assert.match(
    styles,
    /\.light-stage:not\(\.is-waiting\) \.light-kinetic-field::before \{ animation-name: light-score-accent-bloom; \}/,
  );
  assert.match(
    styles,
    /\.light-stage:not\(\.is-waiting\) \.light-kinetic-field::after \{ animation-name: light-score-accent-spark; \}/,
  );

  for (const cue of ["25.08", "34.46", "58.12", "67.5", "82.01"]) {
    assert.match(bloom, new RegExp(`${cue.replace(".", "\\.")}% \\{ opacity: (?!0;)`));
    assert.match(spark, new RegExp(`${cue.replace(".", "\\.")}% \\{ opacity: (?!0;)`));
  }

  assert.match(
    styles,
    /\.light-kinetic-field::before \{[^}]*rgba\(119,154,211,\.27\)[^}]*rgba\(175,143,210,\.21\)[^}]*blur\(2px\)/s,
  );
  assert.match(
    styles,
    /\.light-track-two \.light-track-line \{[^}]*rgba\(152,121,185,\.68\)[^}]*rgba\(177,136,198,\.16\)/s,
  );

  const bloomStateAt = (percentage) => {
    const match = bloom.match(
      new RegExp(
        `${percentage.replace(".", "\\.")}%[^\\{]*\\{\\s*opacity:\\s*([\\d.]+);\\s*transform:\\s*scale\\(([\\d.]+)\\);`,
      ),
    );
    assert.ok(match, `missing accent-bloom state at ${percentage}%`);
    return { opacity: Number(match[1]), scale: Number(match[2]) };
  };

  for (const [reset, peak, release] of [
    ["24.31", "25.08", "28.54"],
    ["33.69", "34.46", "38.33"],
    ["57.35", "58.12", "61.54"],
    ["66.73", "67.5", "71.47"],
    ["81.24", "82.01", "86.22"],
  ]) {
    const resetState = bloomStateAt(reset);
    const peakState = bloomStateAt(peak);
    const releaseState = bloomStateAt(release);

    assert.equal(resetState.opacity, 0);
    assert.ok(resetState.scale < peakState.scale, `${peak}% accent must arrive outward`);
    assert.ok(peakState.opacity > 0);
    assert.equal(releaseState.opacity, 0);
    assert.ok(peakState.scale < releaseState.scale, `${peak}% accent must dissolve outward`);
  }

  assert.ok(
    bloomStateAt("67.5").opacity > bloomStateAt("58.12").opacity,
    "the 10.53s accent remains the strongest mist bloom",
  );

  assert.match(styles, /@keyframes light-score-core-ring[\s\S]*67\.5% \{ opacity: 1;/);
  assert.match(styles, /@keyframes light-score-thread[\s\S]*82\.01% \{ opacity: 0\.9;/);
  assert.match(
    styles,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.light-kinetic-field::before, \.light-kinetic-field::after \{ display: none; \}/,
  );
});

test("bridges the standard and light-to-letter handoffs with the shared paper tone", async () => {
  const styles = await readFile(stylesPath, "utf8");

  assert.match(styles, /\.stage::after \{[^}]*background:\s*var\(--paper\)[^}]*opacity:\s*0/s);
  assert.match(
    styles,
    /\.stage\[data-transition-profile="standard"\]\.is-exiting::after \{[^}]*paper-veil-cover 320ms/s,
  );
  assert.match(
    styles,
    /\.stage\[data-transition-profile="standard"\]\.is-paper::after \{ opacity: 1; \}/,
  );
  assert.match(
    styles,
    /\.stage\[data-transition-profile="standard"\]\.is-entering::after \{[^}]*paper-veil-reveal 1000ms/s,
  );

  assert.match(styles, /\.light-wash::after \{[^}]*background:\s*var\(--paper\)[^}]*opacity:\s*0/s);
  assert.match(
    styles,
    /\.light-stage:not\(\.is-waiting\) \.light-wash::after \{[^}]*light-score-paper-handoff var\(--light-score-duration\) var\(--light-score-delay\) linear both[^}]*animation-play-state:\s*var\(--light-score-play-state\)/s,
  );
  assert.match(
    styles,
    /@keyframes light-score-paper-handoff \{\s*0%, 96\.8% \{ opacity: 0; \}\s*98\.38% \{ opacity: 0\.46; \}\s*100% \{ opacity: 1; \}\s*\}/,
  );
  assert.match(
    styles,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.stage::after \{ display: none; \}/,
  );
});

test("uses a quieter reading mix on page 04 without changing the finale lift", async () => {
  const source = await readFile(experiencePath, "utf8");

  for (const invariant of [
    "const STANDARD_VOLUME = 0.841;",
    "const FOCUS_VOLUME = 0.6;",
    "const FOCUS_FADE_DURATION_MS = 3400;",
    "const FINALE_BASE_VOLUME = 0.78;",
    "const FINALE_BASE_FADE_DURATION_MS = 3200;",
    "const FINALE_VOLUME = 1;",
    "const FINALE_LIFT_DELAY_MS = 12200;",
    "const FINALE_LIFT_DURATION_MS = 5200;",
  ]) {
    assert.ok(source.includes(invariant), `Missing approved page mix invariant: ${invariant}`);
  }
});

test("locks the approved page 03 copy, order, and length-aware phrase windows", async () => {
  const source = await readFile(experiencePath, "utf8");
  const page03 = section(source, "    if (current === 2) {", "    if (current === 3) {");

  for (const copy of [
    "生日快乐，Charlotte。",
    "愿新的一岁里，你依然拥有追问世界的好奇，也常有抬头看风景的轻松。",
    "愿研究顺利，生活明亮；愿细碎的欢喜，落满日常。",
    "← 回到封面",
    "回到封面并结束本轮配乐",
    "继续翻阅",
  ]) {
    assert.ok(page03.includes(copy), `Missing protected page 03 copy or ARIA: ${copy}`);
  }

  for (const delay of [10200, 14900, 19900, 25400, 30400, 35150, 40950, 48920]) {
    assert.ok(page03.includes(String(delay)), `Missing approved page 03 delay: ${delay}`);
  }

  assert.ok(
    page03.includes('text="也常有抬头看风景的轻松。" baseDelay={19900} unfoldDuration={4400}')
      && page03.includes('text="愿研究顺利，" baseDelay={25400} unfoldDuration={4400}'),
    "The first paragraph leaves breathing room before the 41-second closing blessing",
  );
  assert.ok(
    page03.includes('text="生活明亮；" baseDelay={30400} unfoldDuration={4250}')
      && page03.includes('text="愿细碎的欢喜，" baseDelay={35150} unfoldDuration={5150}')
      && page03.includes('text="落满日常。" baseDelay={40950} unfoldDuration={4450}')
      && page03.includes('style={{ "--action-delay": "48920ms" } as CSSProperties}'),
    "Four closing phrases retain their melody entries with overlapping fades; controls finish near 65.2 seconds",
  );
});

test("uses gentle reversible motion for cards, reader controls, and Prompt disclosure", async () => {
  const [source, styles] = await Promise.all([
    readFile(experiencePath, "utf8"),
    readFile(stylesPath, "utf8"),
  ]);

  for (const interaction of [
    'className={`prompt-label-stack ${promptExpanded ? "is-alternate" : ""}`}',
    'className={`prompt-label-stack ${copyStatus === "success" ? "is-alternate" : ""}`}',
    'className={`prompt-drawer ${promptExpanded ? "is-open" : ""}`}',
    "inert={!promptExpanded}",
    "}, 2000);",
  ]) {
    assert.ok(source.includes(interaction), `Missing softened interaction invariant: ${interaction}`);
  }

  assert.match(styles, /\.finding-toggle \{[^}]*transform 360ms[^}]*box-shadow 360ms/s);
  assert.match(styles, /\.finding-toggle:hover, \.finding-toggle:focus-visible \{[^}]*translateY\(-1px\)/s);
  assert.match(styles, /\.prompt-label-stack > span \{[^}]*380ms/s);
  assert.match(styles, /\.prompt-drawer \{[^}]*grid-template-rows:\s*0fr[^}]*520ms/s);
  assert.match(styles, /\.prompt-drawer\.is-open \{[^}]*grid-template-rows:\s*1fr[^}]*620ms/s);
  assert.match(styles, /\.prompt-feedback \{[^}]*420ms/s);
  assert.match(styles, /\.music-button \{[^}]*color 320ms[^}]*opacity 320ms/s);
  assert.match(styles, /:where\(\.cover-scene, \.letter-scene, \.discoveries-scene, \.finale-scene\) \.button \{[^}]*transform 340ms/s);
  assert.match(styles, /\.button:active:not\(:disabled\) \{[^}]*scale\(0\.99\)[^}]*150ms/s);
});
