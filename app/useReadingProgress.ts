"use client";

import { useEffect, useRef, useState } from "react";
import { EMPTY_READING_PROGRESS, readingShortcutLabel, updateReadingProgress } from "../lib/reading-progress.mjs";
import { isPreviewVisit } from "../lib/gift-preview.mjs";

export function useReadingProgress(current: number, activeFinding: number | null, readerVisible: boolean) {
  const memory = useRef({ ...EMPTY_READING_PROGRESS });
  const [shortcut, setShortcut] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const isPreview = isPreviewVisit(window.location.search);
      // Defer access to localStorage: even obtaining it can throw in a
      // restricted browser. The helper keeps a memory-only fallback.
      const storage = {
        getItem: (key: string) => window.localStorage.getItem(key),
        setItem: (key: string, value: string) => window.localStorage.setItem(key, value),
      };
      memory.current = updateReadingProgress({
        storage, preview: isPreview, current: memory.current,
        atOverview: current === 3,
        openedFinding: current === 3 && readerVisible ? activeFinding : null,
      });
      setPreview(isPreview);
      setShortcut(readingShortcutLabel(memory.current));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [current, activeFinding, readerVisible]);
  return { shortcut, preview };
}
