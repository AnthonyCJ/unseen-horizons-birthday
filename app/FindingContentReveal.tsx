"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

/** One reading sequence per mounted detail, independent of ordinary rerenders. */
export default function FindingContentReveal({ children, className, ready }: {
  children: ReactNode;
  className: string;
  ready: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const content = root.current;
    if (!content || !ready) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches || typeof content.animate !== "function") {
      content.dataset.revealState = "complete";
      return;
    }

    const easing = getComputedStyle(content).getPropertyValue("--text-reveal-ease").trim() || "ease-in-out";
    // Element animations keep their clock while the bookmark temporarily hides
    // the reader. A CSS animation would restart when display:none is removed.
    const animations = Array.from(content.querySelectorAll<HTMLElement>("[data-finding-reveal]"), element =>
      element.animate([{ opacity: 0 }, { opacity: 1 }], {
        delay: Number(element.dataset.findingReveal), duration: Number(element.dataset.findingDuration) || 1500, easing, fill: "backwards",
      }));
    content.dataset.revealState = "playing";
    let mounted = true;
    const finish = () => {
      if (mounted) content.dataset.revealState = "complete";
    };
    const changed = () => {
      if (!media.matches) return;
      animations.forEach(animation => animation.cancel());
      finish();
    };
    void Promise.all(animations.map(animation => animation.finished)).then(finish, () => {});
    media.addEventListener("change", changed);
    return () => {
      mounted = false;
      media.removeEventListener("change", changed);
      animations.forEach(animation => animation.cancel());
    };
  }, [ready]);

  return <div ref={root} className={`${className} finding-content-reveal`} data-reveal-state="pending">{children}</div>;
}
