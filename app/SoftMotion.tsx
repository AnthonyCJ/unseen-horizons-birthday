"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";

export function motionDelay(ms: number) {
  return new Promise<void>((resolve) => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches || ms === 0) { resolve(); return; }
    const done = () => {
      window.clearTimeout(timer);
      media.removeEventListener("change", changed);
      resolve();
    };
    const changed = () => { if (media.matches) done(); };
    const timer = window.setTimeout(done, ms);
    media.addEventListener("change", changed);
  });
}

/** Keep the native modal and its image alive until the visible exit finishes. */
export function useSoftDismiss(ref: RefObject<HTMLDialogElement | null>, finish: () => void) {
  const [closing, setClosing] = useState(false);
  const busy = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(finish);
  const locked = useRef<Array<{ element: HTMLElement; inert: boolean }>>([]);

  useLayoutEffect(() => { latest.current = finish; }, [finish]);
  const unlock = useCallback(() => {
    locked.current.forEach(({ element, inert }) => { element.inert = inert; });
    locked.current = [];
  }, []);
  const done = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    unlock();
    busy.current = false;
    setClosing(false);
    latest.current();
  }, [unlock]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const changed = () => { if (media.matches && busy.current) done(); };
    media.addEventListener("change", changed);
    return () => {
      if (timer.current !== null) clearTimeout(timer.current);
      unlock();
      media.removeEventListener("change", changed);
    };
  }, [done, unlock]);

  const close = useCallback(() => {
    if (busy.current || !ref.current?.open) return;
    busy.current = true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { done(); return; }
    ref.current.focus({ preventScroll: true });
    locked.current = Array.from(ref.current.children).map((element) => ({
      element: element as HTMLElement, inert: (element as HTMLElement).inert,
    }));
    locked.current.forEach(({ element }) => { element.inert = true; });
    setClosing(true);
    timer.current = setTimeout(done, 360);
  }, [done, ref]);

  return { closing, close };
}

export function SoftReveal({ show, children }: { show: boolean; children: ReactNode }) {
  // Retain the last visible body for the exit; hidden controls remain inert.
  const [lastVisible, setLastVisible] = useState(children);
  if (show && children !== lastVisible) setLastVisible(children);
  return <div className={`soft-reveal ${show ? "is-shown" : ""}`} aria-hidden={!show} inert={!show}>
    <div className="soft-reveal-inner">{show ? children : lastVisible}</div>
  </div>;
}

export function SoftResize({ children }: { children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const frame = outer.current, body = inner.current;
    if (!frame || !body || typeof ResizeObserver === "undefined") return;
    let previous = body.getBoundingClientRect().height;
    let animation: Animation | null = null;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const stop = () => { animation?.cancel(); animation = null; };
    const changed = () => { if (media.matches) stop(); };
    const observer = new ResizeObserver(() => {
      const next = body.getBoundingClientRect().height;
      if (Math.abs(next - previous) < 1) return;
      const start = animation ? frame.getBoundingClientRect().height : previous;
      stop();
      previous = next;
      if (!media.matches && typeof frame.animate === "function") {
        animation = frame.animate([{ height: `${start}px` }, { height: `${next}px` }], {
          duration: 360, easing: "cubic-bezier(.22,1,.36,1)",
        });
        animation.onfinish = () => { animation = null; };
      }
    });
    observer.observe(body);
    media.addEventListener("change", changed);
    return () => { observer.disconnect(); stop(); media.removeEventListener("change", changed); };
  }, []);
  return <div ref={outer} className="soft-resize"><div ref={inner}>{children}</div></div>;
}
