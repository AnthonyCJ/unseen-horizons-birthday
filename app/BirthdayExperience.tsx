"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode, SyntheticEvent } from "react";

const PUBLIC_BASE_PATH = "/unseen-horizons-birthday";
const BGM_SOURCE = `${PUBLIC_BASE_PATH}/assets/sky-castle-ocarina.mp3`;
const OCARINA_ENTRY_SECONDS = 20.6;
const LETTER_GREETING_DELAY_MS = 5000;
const LETTER_SCENE_TARGET_SECONDS = OCARINA_ENTRY_SECONDS - LETTER_GREETING_DELAY_MS / 1000;
const LIGHT_MIN_DURATION_MS = 4400;
const LIGHT_MAX_DURATION_MS = 14500;
const LIGHT_INITIAL_DURATION_MS = 13900;
const LIGHT_DEPARTURE_MS = 1400;
const LIGHT_DEPARTURE_SECONDS = LETTER_SCENE_TARGET_SECONDS - LIGHT_DEPARTURE_MS / 1000;
const STANDARD_VOLUME = 0.841;
const FOCUS_VOLUME = 0.668;
const FINALE_VOLUME = 1;
const FOCUS_FADE_DURATION_MS = 3400;
const STANDARD_FADE_DURATION_MS = 2800;
const FINALE_LIFT_DELAY_MS = 10400;
const FINALE_LIFT_DURATION_MS = 5000;
const STANDARD_TRANSITION = { exit: 320, paper: 180, enter: 1000 } as const;
const ARTWORK_TRANSITION = { exit: 480, paper: 120, enter: 980 } as const;
const IMAGE_ASSETS = [
  `${PUBLIC_BASE_PATH}/assets/healing-002.jpg`,
  `${PUBLIC_BASE_PATH}/assets/healing-004.jpg`,
  `${PUBLIC_BASE_PATH}/assets/healing-008.jpg`,
] as const;

const screens = ["封面", "点亮", "祝福", "小发现", "远方"] as const;

const findings = [
  { title: "一个观察", detail: "把熟悉的事多看一眼，有时会出现一个此前没有留意到的角度。" },
  { title: "一件新鲜事", detail: "偶然碰见的小事，也许会在很久以后长出意外的联系。" },
  { title: "一个开放问题", detail: "没有标准答案，暂时把问题留在这里，也很好。" },
] as const;

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
  step = 44,
}: {
  text: string;
  baseDelay?: number;
  step?: number;
}) {
  return (
    <span className="character-reveal" aria-label={text}>
      {Array.from(text).map((character, index) => (
        <span
          aria-hidden="true"
          className="character"
          key={`${character}-${index}`}
          style={{ "--char-delay": `${baseDelay + index * step}ms` } as CSSProperties}
        >
          {character === " " ? "\u00a0" : character}
        </span>
      ))}
    </span>
  );
}

function Reveal({
  children,
  delay,
  className = "",
}: {
  children: ReactNode;
  delay: number;
  className?: string;
}) {
  return (
    <span
      className={`phrase-reveal ${className}`}
      style={{ "--reveal-delay": `${delay}ms` } as CSSProperties}
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
  return (
    <div className="scene-meta">
      <Reveal delay={delay} className="eyebrow">{eyebrow}</Reveal>
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
  const reducedMotion = useReducedMotion();
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
  const lightPointerFrame = useRef<number | null>(null);
  const lightPointerBounds = useRef<DOMRect | null>(null);
  const decodedImages = useRef<HTMLImageElement[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
  }, []);

  useEffect(
    () => () => {
      clearTimers();
      if (volumeFrame.current !== null) window.cancelAnimationFrame(volumeFrame.current);
      if (lightPointerFrame.current !== null) window.cancelAnimationFrame(lightPointerFrame.current);
    },
    [clearTimers],
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

      setDirection(target > current ? 1 : -1);
      if (target <= 1) setLightStage("waiting");
      const nextProfile: TransitionProfile = current >= 3 || target >= 3 || target === 0
        ? "artwork"
        : "standard";
      const timing = nextProfile === "artwork" ? ARTWORK_TRANSITION : STANDARD_TRANSITION;
      setTransitionProfile(nextProfile);

      if (reducedMotion) {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
        setCurrent(target);
        return;
      }

      setPhase("exiting");
      timers.current.push(
        window.setTimeout(() => {
          setPhase("paper");
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
    [current, phase, reducedMotion],
  );

  const finishLightSequence = useCallback(() => {
    lightSyncActive.current = false;
    setCurrent(2);
    setLightStage("waiting");
    setPhase("entering");
    timers.current.push(window.setTimeout(() => setPhase("idle"), 1000));
  }, []);

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

    setLightDuration(duration);
    setLightStage("lighting");

    if (syncToMusic) {
      lightSyncActive.current = true;
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
  }, [finishLightSequence, lightStage, phase, reducedMotion]);

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
    const baseTarget = current === 3 ? FOCUS_VOLUME : STANDARD_VOLUME;
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
        current === 3 ? FOCUS_FADE_DURATION_MS : STANDARD_FADE_DURATION_MS,
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

    if (audioTime >= LETTER_SCENE_TARGET_SECONDS) {
      finishLightSequence();
      return;
    }

    if (audioTime >= LIGHT_DEPARTURE_SECONDS && lightStage === "lighting") {
      setLightStage("departing");
    }
  }, [finishLightSequence, lightStage]);

  const openNotebook = useCallback(() => {
    if (entryLock.current) return;
    entryLock.current = true;
    resetInProgress.current = false;
    if (musicState === "idle") playMusic(false, 2400);
    else if (musicState === "ended") playMusic(true, 2400);
    else if (musicState === "error") playMusic(false, 2400);
    moveTo(1);
  }, [moveTo, musicState, playMusic]);

  const restartJourney = useCallback(() => {
    if (phase !== "idle") return;
    resetInProgress.current = true;
    clearTimers();
    lightSyncActive.current = false;
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
  }, [clearTimers, fadeVolume, moveTo, phase, reducedMotion]);

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

  const pageStatus = `第 ${current + 1} 页，共 ${screens.length} 页：${screens[current]}`;
  const phaseClass = phase === "idle" ? "" : `is-${phase}`;
  const suppressMusicControl = phase !== "idle" || current === 1;

  const imageError = (event: SyntheticEvent<HTMLImageElement>) => {
    event.currentTarget.style.display = "none";
  };

  const imageAvailable = (source: string) => !failedAssets.has(source);

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

  const renderScene = () => {
    if (current === 0) {
      return (
        <section key="cover" className={`scene cover-scene ${phaseClass}`} aria-labelledby="cover-title">
          <div className="cover-copy">
            {renderMeta("Field Note · 11 / 13", 200)}
            <div className="cover-heading-group">
              <h1
                className="cover-title"
                id="cover-title"
                ref={headingRef as React.RefObject<HTMLHeadingElement>}
                tabIndex={-1}
              >
                <CharacterReveal text="未知风光" baseDelay={1000} step={180} />
              </h1>
              <Reveal delay={4600} className="copy-secondary subtitle">A Tiny Birthday Field Note</Reveal>
            </div>
            <Reveal delay={6100} className="intro-copy">今天适合打开一份小小的生日观察手记。</Reveal>
            <div className="scene-actions delayed-action" style={{ "--action-delay": "8000ms" } as CSSProperties}>
              <button className="button button-primary cover-primary-button" type="button" onClick={openNotebook}>
                翻开手记
              </button>
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
            {renderMeta("Observation 01", 180)}
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
        <section key="letter" className={`scene letter-scene ${phaseClass}`} aria-labelledby="letter-title">
          <div className="letter-copy">
            {renderMeta("A Small Note", 240)}
            <div className="letter-line enter-line line-early" aria-hidden="true" />
            <p className="letter-lead">
              <span id="letter-title" ref={headingRef} tabIndex={-1} className="focus-heading">
                <CharacterReveal text="生日快乐，Charlotte。" baseDelay={LETTER_GREETING_DELAY_MS} step={120} />
              </span>
            </p>
            <p className="letter-body" aria-label="愿新的一岁里，你依然拥有追问世界的好奇，也拥有偶尔从复杂问题中抬起头、看见沿途风景的轻松。">
              <Reveal delay={10200}>愿新的一岁里，</Reveal>
              <Reveal delay={12900}>你依然拥有追问世界的好奇，</Reveal>
              <Reveal delay={15700}>也拥有偶尔从复杂问题中抬起头、看见沿途风景的轻松。</Reveal>
            </p>
            <p className="letter-body" aria-label="愿研究顺利，生活明亮；愿每一次走向未知，都能遇见新的发现。">
              <Reveal delay={18800}>愿研究顺利，生活明亮；</Reveal>
              <Reveal delay={21400}>愿每一次走向未知，都能遇见新的发现。</Reveal>
            </p>
            <div className="letter-line enter-line line-late" aria-hidden="true" />
            <div className="scene-actions delayed-action" style={{ "--action-delay": "24800ms" } as CSSProperties}>
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
        </section>
      );
    }

    if (current === 3) {
      return (
        <section key="discoveries" className={`scene discoveries-scene ${phaseClass}`} aria-labelledby="discoveries-title">
          <div className="discoveries-art art-frame enter-art mobile-art" aria-hidden="true">
            {imageAvailable(IMAGE_ASSETS[1]) && (
              <img src={IMAGE_ASSETS[1]} alt="" decoding="sync" onError={imageError} />
            )}
          </div>
          <div className="discoveries-copy">
            {renderMeta("Three Small Findings", 220)}
            <h2
              className="section-title"
              id="discoveries-title"
              ref={headingRef as React.RefObject<HTMLHeadingElement>}
              tabIndex={-1}
            >
              <CharacterReveal text="今年遇见的几件小东西" baseDelay={1250} step={150} />
            </h2>
            <div className="findings-list" aria-label="三件小发现">
              {findings.map((finding, index) => (
                <article
                  className="finding-note"
                  key={finding.title}
                  style={{ "--finding-delay": `${4900 + index * 2600}ms` } as CSSProperties}
                >
                  <span className="finding-index">{String(index + 1).padStart(2, "0")}</span>
                  <div className="finding-copy">
                    <h3>{finding.title}</h3>
                    <p>{finding.detail}</p>
                  </div>
                </article>
              ))}
            </div>
            <div className="scene-actions delayed-action" style={{ "--action-delay": "13000ms" } as CSSProperties}>
              <BackButton onClick={() => moveTo(current - 1)} />
              <button className="button button-primary" type="button" onClick={() => moveTo(4)}>
                再往前一点
              </button>
            </div>
          </div>
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
          {renderMeta("Unseen Horizons", 220)}
          <h2
            className="section-title"
            id="finale-title"
            ref={headingRef as React.RefObject<HTMLHeadingElement>}
            tabIndex={-1}
          >
            <CharacterReveal text="不知远方还藏着怎样的风光" baseDelay={1350} step={150} />
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
          <div className="scene-actions delayed-action" style={{ "--action-delay": "12800ms" } as CSSProperties}>
            <BackButton onClick={() => moveTo(current - 1)} />
            <button className="button" type="button" onClick={restartJourney}>
              重新翻阅
            </button>
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
          className={`stage is-${phase}`}
          data-transition-profile={transitionProfile}
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

      <noscript>
        <style>{`.stage-shell{display:none!important}.noscript-note{display:block!important}`}</style>
        <article className="noscript-note">
          <p>Field Note · 11 / 13</p><h1>未知风光</h1><p>今天适合打开一份小小的生日观察手记。</p><hr />
          <h2>点亮这一天</h2><hr />
          <p>生日快乐，Charlotte。</p><p>愿研究顺利，生活明亮；愿每一次走向未知，都能遇见新的发现。</p><hr />
          <h2>今年遇见的几件小东西</h2>{findings.map((finding) => <p key={finding.title}>{finding.title}：{finding.detail}</p>)}<hr />
          <h2>不知远方还藏着怎样的风光</h2><p>愿你一路保有好奇，也常有惊喜。 ：）</p><p>Happy Birthday · XCJ · 2026</p>
        </article>
      </noscript>
    </main>
  );
}
