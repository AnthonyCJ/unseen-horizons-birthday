"use client";

import { useEffect, useRef, useState } from "react";
import { QUESTION_DRAFT_LIMIT, visibleLength, validateQuestionText } from "../lib/question-text.mjs";
import { loadQuestionFonts, questionFontCoverage } from "../lib/question-fonts.mjs";
import type { useQuestionDraft } from "./useQuestionDraft";
import QuestionCardExport from "./QuestionCardExport";
import { SoftReveal } from "./SoftMotion";

export default function InspirationNote({ note }: { note: ReturnType<typeof useQuestionDraft> }) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const composition = useRef(false);
  const selection = useRef({ start: 0, end: 0 });
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [composing, setComposing] = useState(false);
  const [compositionText, setCompositionText] = useState("");
  const [fontState, setFontState] = useState("loading");
  const [fontRetry, setFontRetry] = useState(0);
  const coverage = questionFontCoverage(note.text);
  const count = visibleLength(note.text);
  const needsChinese = coverage.needsChinese;

  useEffect(() => {
    if (!note.ready) return;
    const controller = new AbortController();
    const checkLoaded = () => {
      const loaded = [...document.fonts].filter((face) => face.status === "loaded").map((face) => face.family.replaceAll('"', ""));
      if (loaded.includes("QuestionKalam") && (!needsChinese || loaded.includes("QuestionMaoken"))) setFontState("ready");
    };
    window.addEventListener("question-handwriting-ready", checkLoaded);
    loadQuestionFonts(needsChinese ? "中文 Aa" : "Aa", { signal: controller.signal })
      .then(() => { if (!controller.signal.aborted) setFontState("ready"); })
      .catch(() => { if (!controller.signal.aborted) setFontState("error"); });
    return () => { controller.abort(); window.removeEventListener("question-handwriting-ready", checkLoaded); };
  }, [needsChinese, note.ready, fontRetry]);

  const commit = (element: HTMLTextAreaElement) => {
    if (!note.edit(element.value)) {
      element.value = note.text;
      element.setSelectionRange(selection.current.start, selection.current.end);
    }
  };
  const editAgain = (action: () => void) => { action(); textarea.current?.focus({ preventScroll: true }); };
  return (
    <section className="inspiration-note" aria-labelledby="inspiration-label">
      <div className="inspiration-paper">
        <label id="inspiration-label" htmlFor="inspiration-text">此刻的想法 <span>· 可以留白</span></label>
        <textarea ref={textarea} id="inspiration-text" value={composing ? compositionText : note.text}
          onBeforeInput={(event) => {
            if (!composition.current) selection.current = { start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd };
          }}
          onPaste={(event) => {
            if (composition.current) return;
            const element = event.currentTarget;
            const next = element.value.slice(0, element.selectionStart) + event.clipboardData.getData("text/plain") + element.value.slice(element.selectionEnd);
            try { validateQuestionText(next); }
            catch { event.preventDefault(); note.edit(next); }
          }}
          onCompositionStart={(event) => {
            composition.current = true;
            selection.current = { start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd };
            setCompositionText(event.currentTarget.value);
            setComposing(true);
          }}
          onCompositionEnd={(event) => { composition.current = false; setComposing(false); commit(event.currentTarget); }}
          onChange={(event) => {
            if (composition.current) setCompositionText(event.target.value);
            else commit(event.currentTarget);
          }}
          disabled={!note.ready} rows={4} placeholder="从一句话开始，也可以。"
          aria-describedby="inspiration-privacy inspiration-status inspiration-limit inspiration-storage inspiration-font" />
        <span id="inspiration-limit" className={count >= QUESTION_DRAFT_LIMIT * 0.9 ? "inspiration-caption" : "sr-only"}>
          {count.toLocaleString("en-US")} / 4,000{count === QUESTION_DRAFT_LIMIT ? "，已达到填写上限" : ""}
        </span>
        <span className="inspiration-paper-mark" aria-hidden="true">a little room for your thoughts</span>
      </div>
      <p id="inspiration-font" className="inspiration-status" role="status">
        {fontState === "error" ? <>字迹样式暂时没准备好，填写不受影响。<button type="button" className="finding-text-action" onClick={() => { setFontState("loading"); setFontRetry((value) => value + 1); }}>重试字迹</button></>
          : coverage.fallback ? "部分字符使用设备上的字形，请在图片预览中确认显示。" : ""}
      </p>
      <p id="inspiration-privacy" className="inspiration-hint">文字仅在当前浏览器临时保留，不会上传。想留住这一刻，可以保存成图片。</p>
      <p id="inspiration-storage" className="inspiration-status" role="status">{!note.storageAvailable
        ? "浏览器暂存不可用，刷新可能丢失本次修改或恢复旧草稿。请先保存图片或复制文字。" : ""}</p>
      <QuestionCardExport key={note.previewReset} text={note.text} disabled={!note.ready || composing} />
      <SoftReveal show={note.text.length > 0 || note.canUndo || note.clearPending}><div className="inspiration-actions">
        {(note.text.length > 0 || note.clearPending) && <button className="finding-text-action" type="button" disabled={composing} onClick={() => editAgain(note.clear)}>
          {note.clearPending ? "重试清空" : "清空本次填写"}
        </button>}
        {note.canUndo && <button className="finding-text-action" type="button" disabled={composing} onClick={() => editAgain(note.undoClear)}>撤销清空</button>}
      </div></SoftReveal>
      <p id="inspiration-status" className="inspiration-status" role="status">{note.status}</p>
      {note.recoveryText !== null && <div className="inspiration-recovery">
        <button type="button" className="finding-text-action" aria-expanded={recoveryOpen}
          aria-controls="inspiration-recovery-text" onClick={() => setRecoveryOpen(!recoveryOpen)}>查看未恢复的旧草稿</button>
        <SoftReveal show={recoveryOpen}><div id="inspiration-recovery-text">
        <p className="inspiration-hint">可选中并复制原文；继续填写不会关闭这份恢复内容。</p>
        <textarea aria-label="未恢复的旧草稿原文" readOnly value={note.recoveryText} onFocus={(event) => event.currentTarget.select()} />
        </div></SoftReveal>
      </div>}
    </section>
  );
}
