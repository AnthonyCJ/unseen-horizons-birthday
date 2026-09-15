"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode, SyntheticEvent } from "react";
import PostcardPreview from "./PostcardPreview";
import type { PromptLanguage } from "../lib/clarifying-prompt.mjs";
import MethodPrompt from "./MethodPrompt";
import { useQuestionDraft } from "./useQuestionDraft";
import InspirationNote from "./InspirationNote";
import { useReadingProgress } from "./useReadingProgress";

const PUBLIC_BASE_PATH = "/unseen-horizons-birthday";
const TITLE_CHARACTER_STEP_MS = 160;
const CHARACTER_FADE_MS = 1100;
const BGM_SOURCE = `${PUBLIC_BASE_PATH}/assets/sky-castle-ocarina.mp3`;
const OCARINA_ENTRY_SECONDS = 20.6;
const LETTER_GREETING_DELAY_MS = 5000;
const LETTER_SCENE_TARGET_SECONDS = OCARINA_ENTRY_SECONDS - LETTER_GREETING_DELAY_MS / 1000;
const LIGHT_MIN_DURATION_MS = 4400;
const LIGHT_MAX_DURATION_MS = 14500;
const LIGHT_INITIAL_DURATION_MS = 13900;
const LIGHT_DEPARTURE_MS = 1400;
const LIGHT_DEPARTURE_SECONDS = LETTER_SCENE_TARGET_SECONDS - LIGHT_DEPARTURE_MS / 1000;
const LIGHT_SCORE_BPM = 92.95;
const LIGHT_SCORE_BEAT_MS = 60000 / LIGHT_SCORE_BPM;
const LIGHT_SCORE_DURATION_MS = LETTER_SCENE_TARGET_SECONDS * 1000;
const STANDARD_VOLUME = 0.841;
const MUSIC_LOADING_TIMEOUT_MS = 12000;
const FOCUS_VOLUME = 0.6;
const FINALE_BASE_VOLUME = 0.78;
const FINALE_VOLUME = 1;
const FOCUS_FADE_DURATION_MS = 3400;
const STANDARD_FADE_DURATION_MS = 2800;
const FINALE_BASE_FADE_DURATION_MS = 3200;
const FINALE_LIFT_DELAY_MS = 12200;
const FINALE_LIFT_DURATION_MS = 5200;
const FINDING_READER_CLOSE_MS = 780;
const STANDARD_TRANSITION = { exit: 320, paper: 180, enter: 1000 } as const;
const ARTWORK_TRANSITION = { exit: 660, paper: 180, enter: 1320 } as const;
const IMAGE_ASSETS = [
  `${PUBLIC_BASE_PATH}/assets/healing-003.jpg`,
  `${PUBLIC_BASE_PATH}/assets/healing-004.jpg`,
  `${PUBLIC_BASE_PATH}/assets/healing-008.jpg`,
] as const;

const screens = ["封面", "点亮", "祝福", "三件小东西", "远方"] as const;

const findings = [
  {
    kind: "method", label: "一张方法纸条",
    title: "让 AI 先问清楚，再开始",
    summary: "给尚未成形的想法，一个更清楚的开端。",
  },
  {
    kind: "attention", label: "一页关于专注的体会",
    title: "把注意力，留给热爱的事",
    summary: "给在意的事，留一段完整的时间。",
  },
  {
    kind: "question", label: "一张可以带走的问题签",
    title: "带一个问题去远方",
    summary: "有些问题，会让未来多一点值得期待的事。",
  },
] as const;

const FINDING_QUESTION_TEXT = "新的一岁里，有没有一个问题，你愿意带着它继续往前走？";
const FINDING_QUESTION_SEGMENTS = [
  "新的一岁里，",
  "有没有一个问题，",
  "你愿意带着它继续往前走？",
] as const;
const FINDING_QUESTION_BASE_DELAY_MS = 2500;
const FINDING_QUESTION_STEP_MS = 175;
const FINDING_QUESTION_AFTER_DELAY_MS = 8300;
const FINDING_QUESTION_CLOSING_DELAY_MS = 10200;

type Phase = "idle" | "exiting" | "paper" | "entering" | "ritual";
type TransitionProfile = "standard" | "artwork";
type InputMode = "pointer" | "keyboard";
type MusicState = "idle" | "loading" | "playing" | "pausing" | "paused" | "ended" | "error";
type LightStage = "waiting" | "lighting" | "departing";

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return reduced;
}

function CharacterReveal({
  text,
  baseDelay = 0,
  step = TITLE_CHARACTER_STEP_MS,
  wrapAfter = 0,
  unfoldDuration,
  fadeDuration = CHARACTER_FADE_MS,
}: {
  text: string;
  baseDelay?: number;
  step?: number;
  wrapAfter?: number;
  unfoldDuration?: number;
  fadeDuration?: number;
}) {
  const characters = Array.from(text);
  const characterStep = unfoldDuration === undefined
    ? step
    : Math.max(0, (unfoldDuration - fadeDuration) / Math.max(1, characters.length - 1));
  const groups = wrapAfter
    ? [characters.slice(0, wrapAfter), characters.slice(wrapAfter)]
    : [characters];

  return (
    <span className="character-reveal" aria-label={text} style={{ "--char-duration": `${fadeDuration}ms` } as CSSProperties}>
      {groups.map((group, groupIndex) => (
        <span className={wrapAfter ? "title-unit" : undefined} key={groupIndex}>
          {group.map((character, index) => (
            <span
              aria-hidden="true"
              className="character"
              key={`${character}-${index}`}
              style={{ "--char-delay": `${baseDelay + (index + groupIndex * wrapAfter) * characterStep}ms` } as CSSProperties}
            >
              {character === " " ? "\u00a0" : character}
            </span>
          ))}
        </span>
      ))}
    </span>
  );
}

function FindingQuestionReveal() {
  let characterIndex = 0;

  return (
    <span className="finding-question-reveal" aria-hidden="true">
      {FINDING_QUESTION_SEGMENTS.map((segment, segmentIndex) => (
        <span className="finding-question-segment" key={segment}>
          {Array.from(segment).map((character) => {
            const currentIndex = characterIndex;
            characterIndex += 1;

            return (
              <span
                className="finding-question-character"
                data-character-index={currentIndex}
                key={`${segmentIndex}-${currentIndex}`}
                style={{
                  "--question-char-delay": `${FINDING_QUESTION_BASE_DELAY_MS + currentIndex * FINDING_QUESTION_STEP_MS}ms`,
                } as CSSProperties}
              >
                {character}
              </span>
            );
          })}
        </span>
      ))}
    </span>
  );
}

function Reveal({
  children,
  delay,
  duration,
  className = "",
}: {
  children: ReactNode;
  delay: number;
  duration?: number;
  className?: string;
}) {
  return (
    <span
      className={`phrase-reveal ${className}`}
      style={{
        "--reveal-delay": `${delay}ms`,
        ...(duration === undefined ? {} : { "--reveal-duration": `${duration}ms` }),
      } as CSSProperties}
    >
      {children}
    </span>
  );
}

function MusicControl({
  state,
  onToggleMusic,
}: {
  state: MusicState;
  onToggleMusic: () => void;
}) {
  if (state === "idle") {
    return (
      <span className="music-status" title="翻开手记后将播放《天空之城》陶笛版">
        配乐随手记开启
      </span>
    );
  }

  const loading = state === "loading";
  const pausing = state === "pausing";
  const label = loading
    ? "音乐加载中…"
    : pausing
      ? "正在暂停…"
      : state === "playing"
        ? "暂停音乐"
        : state === "paused"
          ? "继续音乐"
          : state === "ended"
            ? "重新播放"
            : "播放音乐";

  return (
    <span className="music-controls" data-keyboard-nav-block>
      <button
        className={`music-button ${state === "error" ? "is-retry" : ""}`}
        type="button"
        onClick={onToggleMusic}
        disabled={loading || pausing}
        aria-pressed={state === "playing"}
        aria-label={`${label}，《天空之城》陶笛版`}
      >
        {label}
      </button>
    </span>
  );
}

function SceneMeta({
  eyebrow,
  delay = 80,
  page,
  musicState,
  onToggleMusic,
  suppressMusicControl = false,
}: {
  eyebrow: string;
  delay?: number;
  page: number;
  musicState: MusicState;
  onToggleMusic: () => void;
  suppressMusicControl?: boolean;
}) {
  const unifiedMotion = page !== 2;

  return (
    <div
      className={unifiedMotion ? "scene-meta scene-meta-unified" : "scene-meta"}
      style={unifiedMotion ? { "--meta-delay": `${delay}ms` } as CSSProperties : undefined}
    >
      {unifiedMotion
        ? <span className="eyebrow">{eyebrow}</span>
        : <Reveal delay={delay} className="eyebrow">{eyebrow}</Reveal>}
      <span className="meta-tools">
        <span className="page-count" aria-hidden="true">
          {String(page).padStart(2, "0")} / 05
        </span>
        <span
          className={`music-control-slot ${suppressMusicControl ? "is-suppressed" : ""}`}
          aria-hidden={suppressMusicControl || undefined}
        >
          <MusicControl
            state={musicState}
            onToggleMusic={onToggleMusic}
          />
        </span>
      </span>
    </div>
  );
}

function BackButton({
  onClick,
  label = "← 返回",
  ariaLabel,
}: {
  onClick: () => void;
  label?: string;
  ariaLabel?: string;
}) {
  return (
    <button className="button button-quiet" type="button" onClick={onClick} aria-label={ariaLabel}>
      {label}
    </button>
  );
}

function preloadAndDecode(source: string, timeoutMs = 5000) {
  return new Promise<{ source: string; ok: boolean; image: HTMLImageElement }>((resolve) => {
    const image = new Image();
    let settled = false;

    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      image.onload = null;
      image.onerror = null;
      resolve({ source, ok, image });
    };

    const decode = async () => {
      try {
        await image.decode();
        finish(image.naturalWidth > 0);
      } catch {
        finish(image.naturalWidth > 0);
      }
    };

    const timeout = window.setTimeout(() => finish(false), timeoutMs);
    image.decoding = "async";
    image.onload = decode;
    image.onerror = () => finish(false);
    image.src = source;

    if (image.complete) void decode();
  });
}

export default function BirthdayExperience() {
  const [assetsReady, setAssetsReady] = useState(false);
  const [failedAssets, setFailedAssets] = useState<Set<string>>(new Set());
  const [current, setCurrent] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [direction, setDirection] = useState<1 | -1>(1);
  const [transitionProfile, setTransitionProfile] = useState<TransitionProfile>("standard");
  const [lightStage, setLightStage] = useState<LightStage>("waiting");
  const [lightDuration, setLightDuration] = useState(LIGHT_INITIAL_DURATION_MS);
  const [musicState, setMusicState] = useState<MusicState>("idle");
  const [activeFinding, setActiveFinding] = useState<number | null>(null);
  const [findingReaderVisible, setFindingReaderVisible] = useState(false);
  const [findingReaderClosing, setFindingReaderClosing] = useState(false);
  const [readerSwap, setReaderSwap] = useState<"idle" | "out" | "in">("idle");
  const isFindingReaderOpen = activeFinding !== null;
  const [promptLanguage, setPromptLanguage] = useState<PromptLanguage>("zh");
  const [finaleStarted, setFinaleStarted] = useState(false);
  const [postcardOpen, setPostcardOpen] = useState(false);
  const reading = useReadingProgress(current, activeFinding, findingReaderVisible);
  const inspiration = useQuestionDraft();
  const [letterSyncAdjustmentMs, setLetterSyncAdjustmentMs] = useState(0);
  const reducedMotion = useReducedMotion();
  const finaleMessageRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const inputMode = useRef<InputMode>("pointer");
  const entryLock = useRef(false);
  const lightSyncActive = useRef(false);
  const pauseInProgress = useRef(false);
  const resetInProgress = useRef(false);
  const musicSession = useRef(0);
  const sceneVolume = useRef(STANDARD_VOLUME);
  const timers = useRef<number[]>([]);
  const volumeFrame = useRef<number | null>(null);
  const lightSyncFrame = useRef<number | null>(null);
  const lightPointerFrame = useRef<number | null>(null);
  const lightPointerBounds = useRef<DOMRect | null>(null);
  const decodedImages = useRef<HTMLImageElement[]>([]);
  const findingReaderCloseTimer = useRef<number | null>(null);
  const swapTimer = useRef<number | null>(null);
  const swapFrame = useRef<number | null>(null);
  const swapBusy = useRef(false);
  const findingButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const findingReaderRef = useRef<HTMLElement>(null);
  const findingReaderTitleRef = useRef<HTMLHeadingElement>(null);
  const findingReaderScrollRef = useRef<HTMLDivElement>(null);
  const overviewScrollPosition = useRef(0);

  useEffect(() => {
    if (musicState !== "loading") return;
    const session = musicSession.current;
    // A stalled play() or buffering request must not leave the only music
    // control disabled indefinitely. Late promises belong to the old session.
    const timer = window.setTimeout(() => {
      if (musicSession.current !== session || resetInProgress.current) return;
      musicSession.current += 1;
      if (volumeFrame.current !== null) window.cancelAnimationFrame(volumeFrame.current);
      volumeFrame.current = null;
      const audio = audioRef.current;
      audio?.pause();
      if (audio) audio.volume = sceneVolume.current;
      pauseInProgress.current = false;
      setMusicState("error");
    }, MUSIC_LOADING_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [musicState]);

  const clearTimers = useCallback(() => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
  }, []);

  const clearFindingReaderCloseTimer = useCallback(() => {
    if (findingReaderCloseTimer.current !== null) {
      window.clearTimeout(findingReaderCloseTimer.current);
      findingReaderCloseTimer.current = null;
    }
  }, []);

  const cancelSwap = useCallback(() => {
    if (swapTimer.current !== null) window.clearTimeout(swapTimer.current);
    if (swapFrame.current !== null) window.cancelAnimationFrame(swapFrame.current);
    swapTimer.current = null;
    swapFrame.current = null;
    swapBusy.current = false;
  }, []);

  const resetFindingReader = useCallback(() => {
    cancelSwap();
    setReaderSwap("idle");
    clearFindingReaderCloseTimer();
    setFindingReaderVisible(false);
    setFindingReaderClosing(false);
    setActiveFinding(null);
  }, [clearFindingReaderCloseTimer, cancelSwap]);

  useEffect(
    () => () => {
      clearTimers();
      cancelSwap();
      if (volumeFrame.current !== null) window.cancelAnimationFrame(volumeFrame.current);
      if (lightSyncFrame.current !== null) window.cancelAnimationFrame(lightSyncFrame.current);
      if (lightPointerFrame.current !== null) window.cancelAnimationFrame(lightPointerFrame.current);
      if (findingReaderCloseTimer.current !== null) window.clearTimeout(findingReaderCloseTimer.current);
    },
    [clearTimers, cancelSwap],
  );

  useEffect(() => {
    let active = true;

    void Promise.all(IMAGE_ASSETS.map((source) => preloadAndDecode(source))).then((results) => {
      if (!active) return;
      decodedImages.current = results.map((result) => result.image);
      setFailedAssets(new Set(results.filter((result) => !result.ok).map((result) => result.source)));
      setAssetsReady(true);
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (inputMode.current !== "keyboard" || phase !== "idle") return;
    const frame = window.requestAnimationFrame(() => headingRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [current, phase]);

  useEffect(() => {
    if (current === 0 && phase === "idle") {
      entryLock.current = false;
    }
  }, [current, phase]);

  const moveTo = useCallback(
    (target: number) => {
      if (phase !== "idle" || target < 0 || target >= screens.length || target === current) return;
      if (target === 1 && current !== 0) return;

      if (target === 2) setLetterSyncAdjustmentMs(0);
      if (target === 4) setFinaleStarted(false);

      setDirection(target > current ? 1 : -1);
      if (target <= 1) setLightStage("waiting");
      const nextProfile: TransitionProfile = current >= 3 || target >= 3 || target === 0
        ? "artwork"
        : "standard";
      const timing = nextProfile === "artwork" ? ARTWORK_TRANSITION : STANDARD_TRANSITION;
      setTransitionProfile(nextProfile);

      if (reducedMotion) {
        if (current === 3 && target !== 3) resetFindingReader();
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
        setCurrent(target);
        return;
      }

      setPhase("exiting");
      timers.current.push(
        window.setTimeout(() => {
          setPhase("paper");
          // The paper veil now covers the reader; removing it earlier reveals the overview.
          if (current === 3 && target !== 3) resetFindingReader();
          timers.current.push(
            window.setTimeout(() => {
              window.scrollTo({ top: 0, left: 0, behavior: "auto" });
              setCurrent(target);
              setPhase("entering");
              timers.current.push(window.setTimeout(() => setPhase("idle"), timing.enter));
            }, timing.paper),
          );
        }, timing.exit),
      );
    },
    [current, phase, reducedMotion, resetFindingReader],
  );

  const setLightScoreTime = useCallback((audioTime: number) => {
    const lightScene = headingRef.current?.closest(".light-scene") as HTMLElement | null;
    if (!lightScene) return;

    const scoreTime = Math.max(0, Math.min(LETTER_SCENE_TARGET_SECONDS, audioTime));
    lightScene.style.setProperty("--light-score-duration", `${LIGHT_SCORE_DURATION_MS}ms`);
    lightScene.style.setProperty("--light-score-delay", `${(-scoreTime * 1000).toFixed(2)}ms`);
    lightScene.style.setProperty("--light-score-play-state", "paused");
    lightScene.style.setProperty("--light-beat-duration", `${LIGHT_SCORE_BEAT_MS.toFixed(2)}ms`);
  }, []);

  const prepareLightScoreFallback = useCallback((duration: number) => {
    const lightScene = headingRef.current?.closest(".light-scene") as HTMLElement | null;
    if (!lightScene) return;

    lightScene.style.setProperty("--light-score-duration", `${duration}ms`);
    lightScene.style.setProperty("--light-score-delay", "0ms");
    lightScene.style.setProperty("--light-score-play-state", "running");
    lightScene.style.setProperty("--light-beat-duration", `${LIGHT_SCORE_BEAT_MS.toFixed(2)}ms`);
  }, []);

  const finishLightSequence = useCallback(() => {
    if (lightSyncFrame.current !== null) {
      window.cancelAnimationFrame(lightSyncFrame.current);
      lightSyncFrame.current = null;
    }
    lightSyncActive.current = false;
    const audio = audioRef.current;
    if (audio && !audio.paused) setLightScoreTime(audio.currentTime);
    setLetterSyncAdjustmentMs(audio && !audio.paused
      ? Math.max(-2000, Math.min(2000, Math.round(
        (LETTER_SCENE_TARGET_SECONDS - audio.currentTime) * 1000,
      )))
      : 0);
    setCurrent(2);
    setLightStage("waiting");
    setPhase("entering");
    timers.current.push(window.setTimeout(() => setPhase("idle"), 1000));
  }, [setLightScoreTime]);

  const startLightSyncClock = useCallback(() => {
    if (lightSyncFrame.current !== null) window.cancelAnimationFrame(lightSyncFrame.current);

    const tick = () => {
      if (!lightSyncActive.current) {
        lightSyncFrame.current = null;
        return;
      }

      const audioTime = audioRef.current?.currentTime;
      if (typeof audioTime === "number") {
        setLightScoreTime(audioTime);
        if (audioTime >= LETTER_SCENE_TARGET_SECONDS) {
          lightSyncFrame.current = null;
          finishLightSequence();
          return;
        }

        if (audioTime >= LIGHT_DEPARTURE_SECONDS) {
          setLightStage((stage) => stage === "lighting" ? "departing" : stage);
        }
      }

      lightSyncFrame.current = window.requestAnimationFrame(tick);
    };

    // timeupdate is intentionally kept as a secondary path below. Its delivery
    // cadence varies by browser, so the foreground animation clock is the precise
    // source for the 15.6s handoff that anchors the page 03 text to the BGM.
    lightSyncFrame.current = window.requestAnimationFrame(tick);
  }, [finishLightSequence, setLightScoreTime]);

  const handleLight = useCallback(() => {
    if (phase !== "idle" || lightStage !== "waiting") return;

    setDirection(1);
    setPhase("ritual");

    if (reducedMotion) {
      setCurrent(2);
      setLightStage("waiting");
      setPhase("entering");
      timers.current.push(window.setTimeout(() => setPhase("idle"), 120));
      return;
    }

    const audioTime = audioRef.current?.currentTime ?? 0;
    const syncedDuration = Math.round((LETTER_SCENE_TARGET_SECONDS - audioTime) * 1000);
    const duration = Math.max(
      LIGHT_MIN_DURATION_MS,
      Math.min(LIGHT_MAX_DURATION_MS, syncedDuration),
    );
    const departureAt = Math.max(0, duration - LIGHT_DEPARTURE_MS);
    const syncToMusic = Boolean(
      audioRef.current
      && !audioRef.current.paused
      && audioTime < LETTER_SCENE_TARGET_SECONDS - 0.25
    );

    if (syncToMusic) setLightScoreTime(audioTime);
    else prepareLightScoreFallback(duration);
    setLightDuration(duration);
    setLightStage("lighting");

    if (syncToMusic) {
      lightSyncActive.current = true;
      startLightSyncClock();
      timers.current.push(
        window.setTimeout(() => {
          if (!lightSyncActive.current) return;
          setLightStage("departing");
          timers.current.push(window.setTimeout(finishLightSequence, LIGHT_DEPARTURE_MS));
        }, duration + 600),
      );
      return;
    }

    timers.current.push(
      window.setTimeout(() => setLightStage("departing"), departureAt),
      window.setTimeout(finishLightSequence, duration),
    );
  }, [
    finishLightSequence,
    lightStage,
    phase,
    prepareLightScoreFallback,
    reducedMotion,
    setLightScoreTime,
    startLightSyncClock,
  ]);

  useEffect(() => {
    if (current !== 1 || phase !== "idle" || lightStage !== "waiting") return;

    const timer = window.setTimeout(handleLight, 220);
    timers.current.push(timer);
    return () => window.clearTimeout(timer);
  }, [current, handleLight, lightStage, phase]);

  const fadeVolume = useCallback((target: number, duration: number, onDone?: () => void) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (volumeFrame.current !== null) window.cancelAnimationFrame(volumeFrame.current);
    const start = audio.volume;
    const startTime = performance.now();

    const tick = (time: number) => {
      const progress = Math.min(1, (time - startTime) / duration);
      audio.volume = Math.max(0, Math.min(1, start + (target - start) * progress));
      if (progress < 1) volumeFrame.current = window.requestAnimationFrame(tick);
      else {
        volumeFrame.current = null;
        onDone?.();
      }
    };
    volumeFrame.current = window.requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const previousTarget = sceneVolume.current;
    const baseTarget = current === 3
      ? FOCUS_VOLUME
      : current === 4
        ? FINALE_BASE_VOLUME
        : STANDARD_VOLUME;
    sceneVolume.current = baseTarget;

    const audio = audioRef.current;
    if (
      audio
      && !audio.paused
      && !pauseInProgress.current
      && Math.abs(previousTarget - baseTarget) > 0.001
    ) {
      fadeVolume(
        baseTarget,
        current === 3
          ? FOCUS_FADE_DURATION_MS
          : current === 4
            ? FINALE_BASE_FADE_DURATION_MS
            : STANDARD_FADE_DURATION_MS,
      );
    }

    if (current !== 4) return;

    const timer = window.setTimeout(() => {
      if (cancelled) return;
      sceneVolume.current = FINALE_VOLUME;
      const finaleAudio = audioRef.current;
      if (finaleAudio && !finaleAudio.paused && !pauseInProgress.current) {
        fadeVolume(FINALE_VOLUME, FINALE_LIFT_DURATION_MS);
      }
    }, FINALE_LIFT_DELAY_MS);
    timers.current.push(timer);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [current, fadeVolume]);

  const playMusic = useCallback((restart = false, fadeDuration = 1200) => {
    const audio = audioRef.current;
    if (!audio) return;

    const session = ++musicSession.current;
    pauseInProgress.current = false;
    if (restart) audio.currentTime = 0;
    audio.volume = 0;
    setMusicState("loading");

    const playRequest = audio.play();
    void playRequest
      .then(() => {
        if (musicSession.current !== session) return;
        setMusicState("playing");
        fadeVolume(sceneVolume.current, fadeDuration);
      })
      .catch(() => {
        if (musicSession.current !== session) return;
        pauseInProgress.current = false;
        audio.volume = sceneVolume.current;
        setMusicState("error");
      });
  }, [fadeVolume]);

  const toggleMusic = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (musicState === "playing") {
      pauseInProgress.current = true;
      setMusicState("pausing");
      fadeVolume(0, 650, () => {
        audio.pause();
        audio.volume = sceneVolume.current;
        pauseInProgress.current = false;
        setMusicState("paused");
      });
      return;
    }

    if (musicState === "paused") playMusic(false, 1200);
    else if (musicState === "ended") playMusic(true, 1800);
    else if (musicState === "error") playMusic(false, 1800);
  }, [fadeVolume, musicState, playMusic]);

  const handleMusicEnded = useCallback(() => {
    if (resetInProgress.current || pauseInProgress.current) return;
    pauseInProgress.current = false;
    if (volumeFrame.current !== null) window.cancelAnimationFrame(volumeFrame.current);
    volumeFrame.current = null;

    if (current > 0 && musicState !== "paused") {
      playMusic(true, 1800);
      return;
    }

    setMusicState("ended");
  }, [current, musicState, playMusic]);

  const syncLightToMusic = useCallback((event: SyntheticEvent<HTMLAudioElement>) => {
    if (!lightSyncActive.current) return;
    const audioTime = event.currentTarget.currentTime;
    setLightScoreTime(audioTime);

    if (audioTime >= LETTER_SCENE_TARGET_SECONDS) {
      finishLightSequence();
      return;
    }

    if (audioTime >= LIGHT_DEPARTURE_SECONDS && lightStage === "lighting") {
      setLightStage("departing");
    }
  }, [finishLightSequence, lightStage, setLightScoreTime]);

  const openNotebook = useCallback(() => {
    if (entryLock.current) return;
    entryLock.current = true;
    resetInProgress.current = false;
    if (musicState === "idle") playMusic(false, 2400);
    else if (musicState === "ended") playMusic(true, 2400);
    else if (musicState === "error") playMusic(false, 2400);
    moveTo(1);
  }, [moveTo, musicState, playMusic]);

  const revisitFindings = useCallback(() => {
    if (entryLock.current || phase !== "idle") return;
    entryLock.current = true;
    resetInProgress.current = false;
    if (musicState === "idle" || musicState === "error") playMusic(false, 2400);
    else if (musicState === "ended") playMusic(true, 2400);
    moveTo(3);
  }, [moveTo, musicState, phase, playMusic]);

  const restartJourney = useCallback(() => {
    if (phase !== "idle") return;
    resetInProgress.current = true;
    clearTimers();
    resetFindingReader();
    setPostcardOpen(false);
    lightSyncActive.current = false;
    if (lightSyncFrame.current !== null) {
      window.cancelAnimationFrame(lightSyncFrame.current);
      lightSyncFrame.current = null;
    }
    setLetterSyncAdjustmentMs(0);
    setLightStage("waiting");
    setLightDuration(LIGHT_INITIAL_DURATION_MS);
    musicSession.current += 1;
    const audio = audioRef.current;

    if (audio) {
      // Lock the cover mix target before the page transition so the current-page
      // volume effect cannot replace this fade and strand the control in "pausing".
      sceneVolume.current = STANDARD_VOLUME;
      if (reducedMotion || audio.paused) {
        if (volumeFrame.current !== null) window.cancelAnimationFrame(volumeFrame.current);
        volumeFrame.current = null;
        audio.pause();
        pauseInProgress.current = false;
        audio.currentTime = 0;
        audio.volume = STANDARD_VOLUME;
        setMusicState("idle");
      } else {
        pauseInProgress.current = true;
        setMusicState("pausing");
        fadeVolume(0, 650, () => {
          audio.pause();
          audio.currentTime = 0;
          audio.volume = STANDARD_VOLUME;
          pauseInProgress.current = false;
          setMusicState("idle");
        });
      }
    } else {
      pauseInProgress.current = false;
      setMusicState("idle");
    }

    moveTo(0);
  }, [clearTimers, fadeVolume, moveTo, phase, reducedMotion, resetFindingReader]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if ((event.key === "ArrowRight" || event.key === "ArrowLeft") && current === 1) {
        event.preventDefault();
        return;
      }

      if (event.key === "ArrowLeft" && current === 2) {
        event.preventDefault();
        inputMode.current = "keyboard";
        restartJourney();
        return;
      }

      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-keyboard-nav-block]")) return;

      if (event.key === "ArrowRight" && current < screens.length - 1) {
        event.preventDefault();
        inputMode.current = "keyboard";
        if (current === 0) openNotebook();
        else moveTo(current + 1);
      }

      if (event.key === "ArrowLeft" && current > 0) {
        event.preventDefault();
        inputMode.current = "keyboard";
        moveTo(current - 1);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [current, moveTo, openNotebook, restartJourney]);

  useEffect(() => {
    if (current !== 4) return;
    const target = finaleMessageRef.current?.querySelector(".finale-wish");
    if (!target) return;
    if (reducedMotion || window.matchMedia("(min-width: 641px)").matches) {
      const frame = window.requestAnimationFrame(() => setFinaleStarted(true));
      return () => window.cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.95)) {
        setFinaleStarted(true);
        observer.disconnect();
      }
    }, { threshold: 0.95 });
    observer.observe(target);
    return () => observer.disconnect();
  }, [current, reducedMotion]);

  const pageStatus = `第 ${current + 1} 页，共 ${screens.length} 页：${screens[current]}`;
  const phaseClass = phase === "idle" ? "" : `is-${phase}`;
  const suppressMusicControl = phase !== "idle" || current === 1;

  const imageError = (event: SyntheticEvent<HTMLImageElement>) => {
    event.currentTarget.style.display = "none";
  };

  const imageAvailable = (source: string) => !failedAssets.has(source);

  const openFindingReader = useCallback((index: number) => {
    if (swapBusy.current || findingReaderClosing || index === activeFinding) return;
    clearFindingReaderCloseTimer();
    if (activeFinding !== null) {
      const commit = () => {
        setActiveFinding(index);
        setReaderSwap(reducedMotion ? "idle" : "in");
        swapFrame.current = window.requestAnimationFrame(() => {
          swapFrame.current = null;
          findingReaderScrollRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
          findingReaderTitleRef.current?.focus({ preventScroll: true });
        });
        if (!reducedMotion) {
          swapTimer.current = window.setTimeout(() => {
            swapTimer.current = null;
            swapBusy.current = false;
            setReaderSwap("idle");
          }, 460);
        }
      };
      if (reducedMotion) {
        commit();
        return;
      }
      swapBusy.current = true;
      // Keep keyboard events inside the reader before its content becomes inert.
      if (findingReaderScrollRef.current?.contains(document.activeElement)) {
        findingReaderTitleRef.current?.focus({ preventScroll: true });
      }
      setReaderSwap("out");
      swapTimer.current = window.setTimeout(commit, 240);
      return;
    }
    cancelSwap();
    setReaderSwap("idle");
    setFindingReaderVisible(false);
    setFindingReaderClosing(false);
    setActiveFinding(index);
  }, [activeFinding, findingReaderClosing, reducedMotion, clearFindingReaderCloseTimer, cancelSwap]);

  const closeFindingReader = useCallback((restoreFocus = true) => {
    if (activeFinding === null || findingReaderClosing) return;
    cancelSwap();
    if (findingReaderScrollRef.current?.contains(document.activeElement)) {
      findingReaderTitleRef.current?.focus({ preventScroll: true });
    }

    const triggerIndex = activeFinding;
    const finishClosing = () => {
      findingReaderCloseTimer.current = null;
      setReaderSwap("idle");
      setFindingReaderVisible(false);
      setFindingReaderClosing(false);
      setActiveFinding(null);

      if (restoreFocus) {
        window.requestAnimationFrame(() => findingButtonRefs.current[triggerIndex]?.focus({ preventScroll: true }));
      }
    };

    if (reducedMotion) {
      finishClosing();
      return;
    }

    setFindingReaderClosing(true);
    setFindingReaderVisible(false);
    findingReaderCloseTimer.current = window.setTimeout(finishClosing, FINDING_READER_CLOSE_MS);
  }, [activeFinding, findingReaderClosing, reducedMotion, cancelSwap]);

  useEffect(() => {
    if (!isFindingReaderOpen) return;

    overviewScrollPosition.current = window.scrollY;
    const body = document.body;
    const previousBodyStyles = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
    };

    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${overviewScrollPosition.current}px`;
    body.style.width = "100%";

    // Keep the body locked throughout swaps; only opening/closing owns this lock.
    let secondFrame: number | null = null;
    const frame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        setFindingReaderVisible(true);
        findingReaderScrollRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
        findingReaderTitleRef.current?.focus({ preventScroll: true });
      });
    });

    return () => {
      window.cancelAnimationFrame(frame);
      if (secondFrame !== null) window.cancelAnimationFrame(secondFrame);
      body.style.overflow = previousBodyStyles.overflow;
      body.style.position = previousBodyStyles.position;
      body.style.top = previousBodyStyles.top;
      body.style.width = previousBodyStyles.width;
      window.scrollTo({ top: overviewScrollPosition.current, left: 0, behavior: "auto" });
    };
  }, [isFindingReaderOpen]);

  const handleFindingReaderKeyDown = useCallback((event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeFindingReader();
      return;
    }

    if (event.key === "Tab") {
      const reader = findingReaderRef.current;
      if (!reader) return;

      const focusable = Array.from(reader.querySelectorAll<HTMLElement>(
        'button:not(:disabled), textarea:not(:disabled), input:not(:disabled), select:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
      )).filter((element) => !element.closest('[hidden], [inert], dialog:not([open])') && element.getClientRects().length > 0);
      if (focusable.length === 0) {
        event.preventDefault();
        findingReaderTitleRef.current?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const focused = document.activeElement as HTMLElement | null;
      if (!focused || !focusable.includes(focused)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && focused === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && focused === last) {
        event.preventDefault();
        first.focus();
      }
      return;
    }

    if ((event.target as HTMLElement).closest("textarea, input, select, [contenteditable]")) return;
    const scrollArea = findingReaderScrollRef.current;
    if (!scrollArea) return;

    const pageDistance = Math.max(120, scrollArea.clientHeight * 0.82);
    const scrollCommands: Partial<Record<string, () => void>> = {
      ArrowDown: () => scrollArea.scrollBy({ top: 48, behavior: "auto" }),
      ArrowUp: () => scrollArea.scrollBy({ top: -48, behavior: "auto" }),
      PageDown: () => scrollArea.scrollBy({ top: pageDistance, behavior: "auto" }),
      PageUp: () => scrollArea.scrollBy({ top: -pageDistance, behavior: "auto" }),
      Home: () => scrollArea.scrollTo({ top: 0, behavior: "auto" }),
      End: () => scrollArea.scrollTo({ top: scrollArea.scrollHeight, behavior: "auto" }),
    };
    const scroll = scrollCommands[event.key];
    if (scroll) {
      event.preventDefault();
      scroll();
    }
  }, [closeFindingReader]);

  const renderFindingDetails = (index: number) => {
    if (index === 0) {
      return (
        <div className="finding-detail finding-detail-method">
          <p>
            这段 Prompt 用来请 AI 先理解你想做的事，把背景、期待与边界整理成一份简报，等你确认后再着手推进。
          </p>
          <p>
            念头不必一开始就很完整。研究里的疑问、生活中的计划，或一次突如其来的灵感，都可以成为对话的开端。
          </p>
          <MethodPrompt language={promptLanguage} onLanguageChange={setPromptLanguage} active={!findingReaderClosing && readerSwap !== "out"} />
          <p className="finding-poem">
            <span>愿初生的灵感，</span>
            <span>在想象里舒展翅膀；</span>
            <span>从一个念头出发，</span>
            <span>飞向未曾设想的远方。</span>
          </p>
        </div>
      );
    }

    if (index === 1) {
      return (
        <div className="finding-detail finding-detail-harness">
          <p>
            有些想法，需要一段安静的时间，才会显出自己的轮廓。把注意力留给热爱的事，也是在照看那些尚未成形的可能。
          </p>
          <section className="finding-harness-concept" aria-labelledby="finding-harness-word">
            <h3 id="finding-harness-word" className="finding-harness-word" lang="en">Harness Self</h3>
            <p className="finding-harness-anchor"><span>让注意力的去向，</span><span>更多由自己决定。</span></p>
            <p className="finding-harness-meaning">在这页手记里，我想用它说的是：把心思留给在意的事，也让暂时不急的声音等一等。</p>
          </section>
          <p className="finding-harness-rhythm">
            <span>投入与停歇，</span><span>都可以有从容的节奏。</span>
          </p>
          <p className="finding-poem finding-harness-closing">
            <span>愿求索有回响，</span>
            <span>停歇有晴朗；</span>
            <span>愿那些值得长久追问的问题，</span>
            <span><span className="finding-harness-phrase">总能遇见你</span><span className="finding-harness-phrase">清醒、从容的目光。</span></span>
          </p>
        </div>
      );
    }

    return (
      <div className="finding-detail finding-detail-question">
        <p className="finding-question" aria-label={FINDING_QUESTION_TEXT}>
          <FindingQuestionReveal />
        </p>
        <p
          className="finding-question-line"
          style={{ "--finding-line-delay": `${FINDING_QUESTION_AFTER_DELAY_MS}ms` } as CSSProperties}
        >
          不必现在回答。让它陪你走一段路，
        </p>
        <p
          className="finding-question-line finding-question-closing"
          style={{ "--finding-line-delay": `${FINDING_QUESTION_CLOSING_DELAY_MS}ms` } as CSSProperties}
        >
          也许沿途的经历，会带来新的线索。
        </p>
        <InspirationNote note={inspiration} />
      </div>
    );
  };

  const renderMeta = (eyebrow: string, delay: number) => (
    <SceneMeta
      eyebrow={eyebrow}
      delay={delay}
      page={current + 1}
      musicState={musicState}
      onToggleMusic={toggleMusic}
      suppressMusicControl={suppressMusicControl}
    />
  );

  // Reentry mounts a fresh keyed scene; ordinary rerenders keep its CSS reading clock.
  // Reading progress and question drafts do not decide whether a ritual can replay.
  const renderScene = () => {
    if (current === 0) {
      return (
        <section key="cover" className={`scene cover-scene ${phaseClass}`} aria-labelledby="cover-title">
          <div className="cover-copy">
            <div className="cover-core">
              {renderMeta("Field Note · 11 / 13", 200)}
              <div className="cover-message-group">
                <div className="cover-heading-group">
                  <h1
                    className="cover-title"
                    id="cover-title"
                    ref={headingRef as React.RefObject<HTMLHeadingElement>}
                    tabIndex={-1}
                  >
                    <CharacterReveal text="未知风光" baseDelay={1000} step={450} fadeDuration={1400} />
                  </h1>
                  <Reveal delay={4200} className="copy-secondary subtitle">A Tiny Birthday Field Note</Reveal>
                </div>
                <Reveal delay={6000} className="intro-copy">今天，有一份小小的生日手记，想与你分享。</Reveal>
              </div>
              <div className="scene-actions delayed-action" style={{ "--action-delay": "8000ms" } as CSSProperties}>
                <button className="button button-primary cover-primary-button" type="button" onClick={openNotebook}>
                  翻开手记
                </button>
                {reading.shortcut && <button className="button cover-revisit" type="button" onClick={revisitFindings}>{reading.shortcut}</button>}
                {reading.preview && <p className="cover-preview-note">预览模式 · 刷新后重置本次阅读</p>}
              </div>
            </div>
          </div>
          <div className="cover-art cover-art-ambient art-frame enter-art mobile-art" aria-hidden="true">
            {imageAvailable(IMAGE_ASSETS[0]) && (
              <img src={IMAGE_ASSETS[0]} alt="" loading="eager" decoding="sync" onError={imageError} />
            )}
          </div>
        </section>
      );
    }

    if (current === 1) {
      return (
        <section
          key="light"
          className={`scene light-scene ${phaseClass} light-stage is-${lightStage}`}
          aria-label="点亮这一天"
          onPointerEnter={(event) => {
            if (event.pointerType !== "mouse") return;
            lightPointerBounds.current = event.currentTarget.getBoundingClientRect();
          }}
          onPointerMove={(event) => {
            if (event.pointerType !== "mouse" || lightPointerFrame.current !== null) return;
            const target = event.currentTarget;
            const clientX = event.clientX;
            const clientY = event.clientY;
            lightPointerFrame.current = window.requestAnimationFrame(() => {
              const bounds = lightPointerBounds.current ?? target.getBoundingClientRect();
              const horizontal = ((clientX - bounds.left) / bounds.width - 0.5) * 8;
              const vertical = ((clientY - bounds.top) / bounds.height - 0.5) * 6;
              target.style.setProperty("--light-shift-x", `${horizontal.toFixed(2)}px`);
              target.style.setProperty("--light-shift-y", `${vertical.toFixed(2)}px`);
              lightPointerFrame.current = null;
            });
          }}
          onPointerLeave={(event) => {
            if (lightPointerFrame.current !== null) window.cancelAnimationFrame(lightPointerFrame.current);
            lightPointerFrame.current = null;
            lightPointerBounds.current = null;
            event.currentTarget.style.setProperty("--light-shift-x", "0px");
            event.currentTarget.style.setProperty("--light-shift-y", "0px");
          }}
          style={{
            "--light-choreo-duration": `${lightDuration}ms`,
            "--light-shift-x": "0px",
            "--light-shift-y": "0px",
            "--light-ripple-duration": `${Math.round(lightDuration * 0.34)}ms`,
            "--light-ripple-one-delay": `${Math.round(lightDuration * 0.02)}ms`,
            "--light-ripple-two-delay": `${Math.round(lightDuration * 0.12)}ms`,
            "--light-ripple-three-delay": `${Math.round(lightDuration * 0.22)}ms`,
            "--light-ripple-four-delay": `${Math.round(lightDuration * 0.31)}ms`,
            "--light-wash-delay": `${Math.round(lightDuration * 0.44)}ms`,
            "--light-wash-duration": `${Math.round(lightDuration * 0.46)}ms`,
            "--light-depart-duration": `${Math.min(LIGHT_DEPARTURE_MS, Math.round(lightDuration * 0.38))}ms`,
          } as CSSProperties}
        >
          <span className="light-wash" aria-hidden="true" />
          <span className="light-ambient light-ambient-one" aria-hidden="true" />
          <span className="light-ambient light-ambient-two" aria-hidden="true" />
          <div className="light-inner">
            {renderMeta("A Light for Today", 180)}
            <div className="orb-stage enter-orb">
              <span className="ripple ripple-one" aria-hidden="true" />
              <span className="ripple ripple-two" aria-hidden="true" />
              <span className="ripple ripple-three" aria-hidden="true" />
              <span className="ripple ripple-four" aria-hidden="true" />
              <span className="light-kinetic-field" aria-hidden="true">
                <span className="light-track light-track-one">
                  <span className="light-track-line"><span className="light-track-beacon" /></span>
                </span>
                <span className="light-track light-track-two">
                  <span className="light-track-line"><span className="light-track-beacon" /></span>
                </span>
                <span className="light-track light-track-three">
                  <span className="light-track-line"><span className="light-track-beacon" /></span>
                </span>
                <span className="light-thread light-thread-one" />
                <span className="light-thread light-thread-two" />
                <span className="light-thread light-thread-three" />
                <span className="light-thread light-thread-four" />
                <span className="light-node-map">
                  {Array.from({ length: 10 }, (_, index) => <span className="light-node" key={index} />)}
                </span>
              </span>
              <div
                className="date-orb"
                ref={headingRef as React.RefObject<HTMLDivElement>}
                tabIndex={-1}
              >
                <span className="date-mark" aria-label="十一月十三日">11·13</span>
              </div>
            </div>
            <div className="light-actions" aria-hidden="true" />
          </div>
        </section>
      );
    }

    if (current === 2) {
      return (
        <section
          key="letter"
          className={`scene letter-scene ${phaseClass}`}
          aria-labelledby="letter-title"
          style={{ "--letter-sync-adjustment": `${letterSyncAdjustmentMs}ms` } as CSSProperties}
        >
          <div className="letter-copy">
            <div className="letter-heading-group">
              {renderMeta("A Small Note", 240)}
              <div className="letter-line enter-line line-early" aria-hidden="true" />
              <p className="letter-lead">
                <span id="letter-title" ref={headingRef} tabIndex={-1} className="focus-heading">
                  <CharacterReveal text="生日快乐，Charlotte。" baseDelay={LETTER_GREETING_DELAY_MS} />
                </span>
              </p>
            </div>
            <div className="letter-message-group">
              <p className="letter-body" aria-label="愿新的一岁里，你依然拥有追问世界的好奇，也常有抬头看风景的轻松。">
                <CharacterReveal text="愿新的一岁里，" baseDelay={10200} unfoldDuration={3600} />
                <CharacterReveal text="你依然拥有追问世界的好奇，" baseDelay={14900} unfoldDuration={4100} />
                <CharacterReveal text="也常有抬头看风景的轻松。" baseDelay={19900} unfoldDuration={4400} />
              </p>
              <p className="letter-body letter-closing" aria-label="愿研究顺利，生活明亮；愿细碎的欢喜，落满日常。">
                <span className="letter-sentence">
                  <CharacterReveal text="愿研究顺利，" baseDelay={25400} unfoldDuration={4400} fadeDuration={3200} />
                  <CharacterReveal text="生活明亮；" baseDelay={30400} unfoldDuration={4250} fadeDuration={3200} />
                </span>
                <span className="letter-sentence">
                  {/* Start the soft fade before the melody entries near 51.15s and 56.97s. */}
                  <CharacterReveal text="愿细碎的欢喜，" baseDelay={35150} unfoldDuration={5150} fadeDuration={3400} />
                  <CharacterReveal text="落满日常。" baseDelay={40950} unfoldDuration={4450} fadeDuration={3200} />
                </span>
              </p>
            </div>
            <div className="letter-footer-group">
              <div className="letter-line enter-line line-late" aria-hidden="true" />
              <div className="scene-actions delayed-action" style={{ "--action-delay": "48920ms" } as CSSProperties}>
                <BackButton
                  onClick={restartJourney}
                  label="← 回到封面"
                  ariaLabel="回到封面并结束本轮配乐"
                />
                <button className="button button-primary" type="button" onClick={() => moveTo(3)}>
                  继续翻阅
                </button>
              </div>
            </div>
          </div>
        </section>
      );
    }

    if (current === 3) {
      const activeFindingData = activeFinding === null ? null : findings[activeFinding];

      return (
        <section
          key="discoveries"
          className={`scene discoveries-scene ${phaseClass}`}
          aria-labelledby="discoveries-title"
        >
          <div className="discoveries-art art-frame enter-art mobile-art" aria-hidden="true">
            {imageAvailable(IMAGE_ASSETS[1]) && (
              <img src={IMAGE_ASSETS[1]} alt="" decoding="sync" onError={imageError} />
            )}
          </div>
          <div
            className="discoveries-copy"
            inert={activeFinding !== null}
            aria-hidden={activeFinding !== null || undefined}
          >
            {renderMeta("For the Days Ahead", 220)}
            <h2
              className="section-title"
              id="discoveries-title"
              ref={headingRef as React.RefObject<HTMLHeadingElement>}
              tabIndex={-1}
            >
              <CharacterReveal text="想与你分享的三件小东西" baseDelay={1050} wrapAfter={6} />
            </h2>
            <p className="discoveries-intro">
              <Reveal delay={2950}>
                一个开始，一段时间，一个问题。
              </Reveal>
            </p>
            <div className="findings-list" aria-label="想与你分享的三件小东西" data-keyboard-nav-block>
              {findings.map((finding, index) => {
                const toggleId = `finding-toggle-${index + 1}`;
                const summaryId = `finding-summary-${index + 1}`;

                return (
                  <article
                    className="finding-note"
                    data-kind={finding.kind}
                    key={finding.title}
                    style={{ "--finding-delay": `${3900 + index * 650}ms` } as CSSProperties}
                  >
                    <h3 className="finding-heading">
                      <button
                        className="finding-toggle"
                        data-selected={activeFinding === index || undefined}
                        id={toggleId}
                        type="button"
                        ref={(element) => {
                          findingButtonRefs.current[index] = element;
                        }}
                        aria-haspopup="dialog"
                        aria-label={`${finding.title}，展开阅读`}
                        aria-describedby={summaryId}
                        onClick={() => openFindingReader(index)}
                      >
                        <span className="finding-index">{String(index + 1).padStart(2, "0")}</span>
                        <span className="finding-heading-copy">
                          <span className="finding-title">{finding.title}</span>
                          <span className="finding-summary" id={summaryId}>{finding.summary}</span>
                        </span>
                        <span className="finding-open-label" aria-hidden="true">
                          <span className="finding-indicator">→</span>
                        </span>
                      </button>
                    </h3>
                  </article>
                );
              })}
            </div>
            <div
              className="scene-actions discoveries-actions delayed-action"
              style={{ "--action-delay": "6200ms" } as CSSProperties}
            >
              <BackButton onClick={() => moveTo(current - 1)} />
              <button className="button button-primary" type="button" onClick={() => moveTo(4)}>
                再往前一点
              </button>
            </div>
          </div>
          {activeFindingData && activeFinding !== null && (
            <div
              className={`finding-reader-layer ${findingReaderVisible && !findingReaderClosing ? "is-open" : ""} ${findingReaderClosing ? "is-closing" : ""}`}
              data-state={findingReaderClosing ? "closing" : findingReaderVisible ? "open" : "opening"}
              data-swap={readerSwap}
            >
              <section
                className="finding-reader"
                data-kind={activeFindingData.kind}
                ref={findingReaderRef}
                role="dialog"
                aria-modal="true"
                aria-busy={findingReaderClosing || readerSwap !== "idle"}
                aria-labelledby="finding-reader-title"
                aria-describedby="finding-reader-summary"
                data-keyboard-nav-block
                onKeyDown={handleFindingReaderKeyDown}
              >
                <header className="finding-reader-header">
                  <div className="finding-reader-toolbar">
                  <button
                    className="finding-reader-back"
                    type="button"
                    aria-disabled={findingReaderClosing}
                    onClick={() => closeFindingReader()}
                  >
                    ← 返回三件内容
                  </button>
                  <MusicControl state={musicState} onToggleMusic={toggleMusic} />
                  </div>
                  <div className="finding-reader-heading">
                    <span className="finding-reader-index">
                      {String(activeFinding + 1).padStart(2, "0")}
                    </span>
                    <h2 id="finding-reader-title" ref={findingReaderTitleRef} tabIndex={-1}>
                      {activeFinding === 0 ? <><span className="reader-title-unit">让 AI 先问清楚，</span><span className="reader-title-unit">再开始</span></> : activeFinding === 1 ? <><span className="reader-title-unit">把注意力，</span><span className="reader-title-unit">留给热爱的事</span></> : activeFindingData.title}
                    </h2>
                    <p id="finding-reader-summary">{activeFindingData.summary}</p>
                  </div>
                </header>
                <div
                  className="finding-reader-scroll"
                  inert={readerSwap === "out" || findingReaderClosing}
                  ref={findingReaderScrollRef}
                  role="document"
                  aria-label={`${activeFindingData.title}正文`}
                  tabIndex={0}
                >
                  {renderFindingDetails(activeFinding)}
                  <nav className="finding-reader-next" aria-label="继续翻阅小礼物">
                    <button
                      className="finding-text-action"
                      type="button"
                      aria-disabled={findingReaderClosing || readerSwap !== "idle"}
                      onClick={() => {
                        if (findingReaderClosing || swapBusy.current) return;
                        if (activeFinding < 2) openFindingReader(activeFinding + 1);
                        else moveTo(4);
                      }}
                    >
                      {activeFinding < 2 ? `下一件：${findings[activeFinding + 1].title} →` : "去下一页 →"}
                    </button>
                  </nav>
                </div>
              </section>
            </div>
          )}
        </section>
      );
    }

    return (
      <section key="finale" className={`scene finale-scene ${phaseClass}`} aria-labelledby="finale-title">
        <div className="finale-visual art-frame enter-art mobile-art" aria-hidden="true">
          {imageAvailable(IMAGE_ASSETS[2]) && (
            <img src={IMAGE_ASSETS[2]} alt="" decoding="sync" onError={imageError} />
          )}
        </div>
        <div className="finale-copy">
          <div className="finale-core" data-started={finaleStarted}>
            {renderMeta("Unseen Horizons", 220)}
            <div className="finale-message-group" ref={finaleMessageRef}>
              <h2
                className="section-title"
                id="finale-title"
                ref={headingRef as React.RefObject<HTMLHeadingElement>}
                tabIndex={-1}
              >
              <CharacterReveal text="不知远方还藏着怎样的风光" baseDelay={1350} />
              </h2>
              <p className="finale-wish">
                <Reveal delay={5400}>愿你一路保有好奇，</Reveal>
                <Reveal delay={7800}>
                  也常有惊喜。<span className="finale-smile" role="img" aria-label="笑脸">
                    <span className="finale-smile-mark" aria-hidden="true">：）</span>
                  </span>
                </Reveal>
              </p>
              <Reveal delay={10800} className="copy-secondary signature">Happy Birthday · XCJ · 2026</Reveal>
              <Reveal delay={12400} className="postcard-entry">
                <button className="postcard-open" type="button" onClick={() => setPostcardOpen(true)}>保存这份祝福</button>
              </Reveal>
            </div>
            <div className="scene-actions delayed-action" style={{ "--action-delay": "12800ms" } as CSSProperties}>
              <BackButton onClick={() => moveTo(current - 1)} />
              <button className="button" type="button" onClick={restartJourney}>
                重新翻阅
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  };

  if (!assetsReady) {
    return (
      <main className="experience opening-experience" aria-busy="true">
        <div className="opening-mark" role="status">
          <span className="opening-dot" aria-hidden="true" />
          <span>正在展开这份小手记</span>
        </div>
      </main>
    );
  }

  return (
    <main
      className="experience is-ready"
      onPointerDownCapture={() => {
        inputMode.current = "pointer";
      }}
    >
      <p className="sr-only" aria-live="polite" aria-atomic="true">{pageStatus}</p>
      <audio
        ref={audioRef}
        src={BGM_SOURCE}
        preload="auto"
        onEnded={handleMusicEnded}
        onTimeUpdate={syncLightToMusic}
        onError={() => {
          if (resetInProgress.current) return;
          pauseInProgress.current = false;
          setMusicState("error");
        }}
        onWaiting={() => {
          if (resetInProgress.current) return;
          if (musicState === "playing") setMusicState("loading");
        }}
        onPlaying={(event) => {
          if (
            !resetInProgress.current
            && !pauseInProgress.current
            && !event.currentTarget.paused
          ) setMusicState("playing");
        }}
      />
      <div className="stage-shell" aria-busy={phase !== "idle"} data-direction={direction > 0 ? "forward" : "backward"}>
        <div
          className={`stage is-${phase} ${current === 3 && activeFinding !== null ? "is-reading" : ""} ${findingReaderClosing ? "is-reader-closing" : ""}`}
          data-transition-profile={transitionProfile}
          data-page={current + 1}
          inert={phase !== "idle"}
        >
          <div className="persistent-visuals" aria-hidden="true">
            <div className={`visual-panel ${current === 0 ? "is-active" : ""}`}>
              <div className="cover-art cover-art-ambient art-frame persistent-art">
                {imageAvailable(IMAGE_ASSETS[0]) && (
                  <img src={IMAGE_ASSETS[0]} alt="" loading="eager" decoding="sync" onError={imageError} />
                )}
              </div>
            </div>
            <div className={`visual-panel ${current === 3 ? "is-active" : ""}`}>
              <div className="discoveries-art art-frame persistent-art">
                {imageAvailable(IMAGE_ASSETS[1]) && (
                  <img src={IMAGE_ASSETS[1]} alt="" decoding="sync" onError={imageError} />
                )}
              </div>
            </div>
            <div className={`visual-panel ${current === 4 ? "is-active" : ""}`}>
              <div className="finale-visual art-frame persistent-art">
                {imageAvailable(IMAGE_ASSETS[2]) && (
                  <img src={IMAGE_ASSETS[2]} alt="" decoding="sync" onError={imageError} />
                )}
              </div>
            </div>
          </div>
          {renderScene()}
        </div>
      </div>

      {postcardOpen && <PostcardPreview onClose={() => setPostcardOpen(false)} />}

      <noscript>
        <style>{`.stage-shell{display:none!important}.noscript-note{display:block!important}`}</style>
        <article className="noscript-note">
          <p>Field Note · 11 / 13</p><h1>未知风光</h1><p>今天，有一份小小的生日手记，想与你分享。</p><hr />
          <h2>点亮这一天</h2><hr />
          <p>生日快乐，Charlotte。</p><p>愿研究顺利，生活明亮；愿细碎的欢喜，落满日常。</p><hr />
          <h2>想与你分享的三件小东西</h2>{findings.map((finding) => <p key={finding.title}>{finding.title}：{finding.summary}</p>)}<hr />
          <h2>不知远方还藏着怎样的风光</h2><p>愿你一路保有好奇，也常有惊喜。 ：）</p><p>Happy Birthday · XCJ · 2026</p>
        </article>
      </noscript>
    </main>
  );
}
