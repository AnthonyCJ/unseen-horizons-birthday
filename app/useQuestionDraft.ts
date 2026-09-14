"use client";

import { useEffect, useRef, useState } from "react";
import { createQuestionDraft } from "../lib/question-draft.mjs";
import type { QuestionDraftSnapshot } from "../lib/question-draft.mjs";
import { isPreviewVisit } from "../lib/gift-preview.mjs";

export function useQuestionDraft() {
  const controller = useRef<ReturnType<typeof createQuestionDraft> | null>(null);
  const [draft, setDraft] = useState<QuestionDraftSnapshot>({
    text: "", canUndo: false, storageAvailable: true, clearPending: false, recoveryText: null,
  });
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("");
  const [previewReset, setPreviewReset] = useState(0);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      controller.current = createQuestionDraft({
        preview: isPreviewVisit(window.location.search),
        // Accessing sessionStorage itself can throw in a restricted browser.
        storage: {
          getItem: (key) => window.sessionStorage.getItem(key),
          setItem: (key, value) => window.sessionStorage.setItem(key, value),
          removeItem: (key) => window.sessionStorage.removeItem(key),
        },
      });
      const restored = controller.current.read();
      setDraft(restored);
      setStatus(restored.recoveryText !== null ? "旧草稿未能直接恢复，可展开下方原文复制。" : restored.text ? "已恢复本次填写。" : "");
      setReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  // A best-effort reminder only when browser storage has failed. Normal
  // refreshes can restore the draft without interrupting the reading journey.
  useEffect(() => {
    if (draft.storageAvailable || !draft.text) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [draft.storageAvailable, draft.text]);

  const edit = (text: string) => {
    if (!controller.current) return false;
    try {
      setDraft(controller.current.edit(text));
      setStatus("");
      return true;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "此次输入未被接收，原有填写仍保留。");
      return false;
    }
  };
  const clear = () => {
    if (!controller.current) return;
    const cleared = controller.current.clear();
    setDraft(cleared);
    setPreviewReset((value) => value + 1);
    setStatus(cleared.clearPending
      ? "本页文字已清空，浏览器中的暂存未能清除。可以重试清空。"
      : "已清空本次填写。已下载的图片仍由你保管。");
  };
  const undoClear = () => {
    if (!controller.current) return;
    setDraft(controller.current.undoClear());
    setStatus("已撤销清空。");
  };
  return { ...draft, ready, status, previewReset, edit, clear, undoClear };
}
