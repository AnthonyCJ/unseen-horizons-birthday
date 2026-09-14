"use client";

import { useCallback, useLayoutEffect, useRef } from "react";

const REVEALS = ".scene-meta-unified, .character, .phrase-reveal, .enter-line, .finding-note, .delayed-action, .finding-question-character, .finding-question-line";

// Remember completed reveals in this mounted journey only. CSS remains the
// reading clock, so pausing or retrying audio cannot rewind the text.
export function useReadReveals(scope: string | null, enabled: boolean, reduced: boolean) {
  const ref = useRef<HTMLElement>(null);
  const memory = useRef(new Map<string, Set<number>>());
  const collecting = useRef(true);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root || !scope || !enabled) return;
    collecting.current = true;
    const completed = memory.current.get(scope) ?? new Set<number>();
    memory.current.set(scope, completed);
    const elements = Array.from(root.querySelectorAll<HTMLElement>(REVEALS));
    elements.forEach((element, index) => {
      if (completed.has(index)) element.classList.add("reading-recalled");
      if (reduced) completed.add(index);
    });
    const remember = (event: AnimationEvent) => {
      if (!collecting.current) return;
      const index = elements.indexOf(event.target as HTMLElement);
      if (index >= 0) completed.add(index);
    };
    root.addEventListener("animationend", remember);
    return () => root.removeEventListener("animationend", remember);
  }, [scope, enabled, reduced]);

  const reset = useCallback(() => {
    collecting.current = false;
    memory.current.clear();
  }, []);
  return { ref, reset };
}
