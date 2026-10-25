"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

const key = "giftKeepsakePreview";

/** A same-URL history entry lets Back close a preview without changing the entrance hash. */
export function usePreviewHistory(dismiss: () => void) {
  const latest = useRef(dismiss);
  const entry = useRef<string | null>(null);
  const waiting = useRef(false);
  useLayoutEffect(() => { latest.current = dismiss; }, [dismiss]);

  useEffect(() => {
    const popped = () => {
      if (entry.current && window.history.state?.[key] !== entry.current) {
        entry.current = null;
        waiting.current = false;
        latest.current();
      }
    };
    window.addEventListener("popstate", popped);
    return () => {
      window.removeEventListener("popstate", popped);
      if (entry.current && window.history.state?.[key] === entry.current) {
        const state = { ...window.history.state };
        delete state[key];
        window.history.replaceState(state, "", window.location.href);
      }
      entry.current = null;
    };
  }, []);

  const enter = useCallback(() => {
    if (entry.current) return;
    const token = `keepsake-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      window.history.pushState({ ...window.history.state, [key]: token }, "", window.location.href);
      entry.current = token;
      waiting.current = false;
    } catch { entry.current = null; }
  }, []);

  const leave = useCallback(() => {
    if (waiting.current) return;
    if (entry.current && window.history.state?.[key] === entry.current) {
      waiting.current = true;
      window.history.back();
    } else {
      entry.current = null;
      latest.current();
    }
  }, []);

  return { enter, leave };
}
