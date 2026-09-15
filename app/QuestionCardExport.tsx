"use client";

import { useEffect, useRef, useState } from "react";
import { prepareQuestionCards, renderQuestionPage } from "../lib/question-card.mjs";
import type { CardPlan } from "../lib/question-card.mjs";
import { questionFontCoverage } from "../lib/question-fonts.mjs";
import { motionDelay, SoftReveal, useSoftDismiss } from "./SoftMotion";

type PreviewSession = { controller: AbortController; text: string; plan: CardPlan | null; urls: Map<number, string>; busy: boolean };
function dispose(session: PreviewSession | null) {
  if (!session) return;
  session.controller.abort();
  session.urls.forEach((url) => URL.revokeObjectURL(url));
  session.urls.clear();
}

export default function QuestionCardExport({ text, disabled = false }: { text: string; disabled?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const copyArea = useRef<HTMLTextAreaElement>(null);
  const session = useRef<PreviewSession | null>(null);
  const copyRequest = useRef(0);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [url, setUrl] = useState("");
  const [page, setPage] = useState(0);
  const [pendingPage, setPendingPage] = useState<number | null>(null);
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"handwriting" | "plain">("handwriting");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [manualCopy, setManualCopy] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "pending" | "copied" | "manual">("idle");

  useEffect(() => {
    const element = dialog.current;
    return () => { clearTimeout(copyTimer.current); dispose(session.current); session.current = null; element?.close(); };
  }, [text]);

  useEffect(() => { if (manualCopy) { copyArea.current?.focus(); copyArea.current?.select(); } }, [manualCopy]);
  const current = (active: PreviewSession) => session.current === active && !active.controller.signal.aborted;
  const finishClose = () => {
    clearTimeout(copyTimer.current);
    dispose(session.current);
    session.current = null;
    setBusy(false);
    setUrl("");
    dialog.current?.close();
    trigger.current?.focus({ preventScroll: true });
  };
  const { closing, close } = useSoftDismiss(dialog, finishClose);

  const showPage = async (active: PreviewSession, index: number) => {
    if (!active.plan || !current(active) || active.busy) return;
    active.busy = true;
    if (dialog.current?.open) dialog.current.focus({ preventScroll: true });
    setPendingPage(index);
    setBusy(true);
    setError("");
    setStatus("");
    // Retain at most the current page and immediate neighbours, never all blobs.
    for (const [key, value] of active.urls) {
      if (Math.abs(key - index) > 1) { URL.revokeObjectURL(value); active.urls.delete(key); }
    }
    try {
      let nextUrl = active.urls.get(index);
      if (!nextUrl) {
        const blob = await renderQuestionPage(active.plan, index, { signal: active.controller.signal });
        if (!current(active)) return;
        nextUrl = URL.createObjectURL(blob);
        active.urls.set(index, nextUrl);
      }
      const readyImage = new Image();
      readyImage.src = nextUrl;
      await Promise.all([readyImage.decode(), motionDelay(url ? 180 : 0)]);
      if (current(active)) {
        setUrl(nextUrl);
        setPage(index);
        setPendingPage(null);
      }
    } catch (reason) {
      if (current(active)) setError(reason instanceof Error ? reason.message : "图片还没生成好，文字仍在这里。可以重试或先复制文字。");
    } finally {
      active.busy = false;
      if (current(active)) setBusy(false);
    }
  };

  const prepare = async (nextMode: "handwriting" | "plain" = "handwriting") => {
    if (disabled || session.current?.busy) return;
    dispose(session.current);
    const active: PreviewSession = { controller: new AbortController(), text, plan: null, urls: new Map(), busy: true };
    session.current = active;
    setBusy(true);
    setUrl("");
    setError("");
    setStatus("");
    setManualCopy(false);
    clearTimeout(copyTimer.current);
    setCopyState("idle");
    setPage(0);
    setPendingPage(null);
    setCount(0);
    setMode(nextMode);
    dialog.current?.showModal();
    try {
      active.plan = await prepareQuestionCards(text, { mode: nextMode, signal: active.controller.signal });
      if (!current(active)) return;
      setCount(active.plan.pages.length);
      active.busy = false;
      await showPage(active, 0);
    } catch (reason) {
      if (current(active)) setError(reason instanceof Error ? reason.message : "问题签暂时没有准备好，文字仍在这里。可以重试或先复制文字。");
    } finally {
      active.busy = false;
      if (current(active)) setBusy(false);
    }
  };

  const copy = async () => {
    const active = session.current;
    if (!active || !current(active)) return;
    const request = ++copyRequest.current;
    clearTimeout(copyTimer.current);
    setCopyState("pending");
    const stillCurrent = () => current(active) && copyRequest.current === request;
    try {
      await navigator.clipboard.writeText(active.text);
      if (!stillCurrent()) return;
      setManualCopy(false);
      setCopyState("copied");
      copyTimer.current = setTimeout(() => { if (stillCurrent()) setCopyState("idle"); }, 3000);
    } catch {
      if (!stillCurrent()) return;
      setManualCopy(true);
      setCopyState("manual");
      copyArea.current?.focus();
      copyArea.current?.select();
    }
  };
  const download = () => {
    if (!url || busy || error) return;
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `Charlotte-question-2026${count > 1 ? `-${page + 1}` : ""}${mode === "plain" ? "-text" : ""}.png`;
    document.body.append(anchor);
    try { anchor.click(); setStatus("已发起图片下载；也可以长按图片，使用浏览器的保存功能。"); }
    catch { setStatus("下载暂时没有启动。可以长按图片，使用浏览器的保存功能，或先复制文字。"); }
    finally { anchor.remove(); }
  };
  const retry = () => {
    const active = session.current;
    if (active?.plan) void showPage(active, pendingPage ?? page);
    else void prepare(mode);
  };
  return (
    <div className="question-export">
      <div className="question-export-actions">
        <button ref={trigger} type="button" className="question-primary-action" disabled={disabled} aria-haspopup="dialog" aria-describedby="question-export-hint" onClick={() => { if (!dialog.current?.open) void prepare(); }}>
          <span aria-hidden="true" className="question-card-icon">↗</span>带走这张问题签
        </button>
      </div>
      <p id="question-export-hint" className="inspiration-hint">留白也可以。先看看问题签，再决定是否保存。</p>
      <dialog ref={dialog} className={`question-export-dialog soft-dialog ${closing ? "is-closing" : ""}`} tabIndex={-1}
        aria-labelledby="question-export-title" data-keyboard-nav-block="true"
        onCancel={(event) => { event.preventDefault(); close(); }} onKeyDown={(event) => event.stopPropagation()}>
        <header>
          <button className="finding-reader-back" type="button" onClick={close}><span aria-hidden="true">← </span>返回填写</button>
          <h3 id="question-export-title">你的问题签{mode === "plain" ? " · 清晰文字版" : ""}</h3>
        </header>
        <div className="question-export-preview" aria-busy={busy}>
          {busy && <p className="question-export-working" role="status">{count ? `正在准备第 ${(pendingPage ?? page) + 1} 张……` : "正在把这一刻写进纸签……"}</p>}
          {error && <div className="question-export-error"><p role="alert">{error}</p><div className="question-export-actions">
            <button type="button" className="prompt-action" onClick={retry}>重试{count ? "这一张" : "生成"}</button>
            {mode !== "plain" && <button type="button" className="prompt-action" onClick={() => void prepare("plain")}>先用清晰文字版</button>}
          </div></div>}
          {/* Native PNG previews retain long-press saving on touch devices. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {url && <img key={url} className={busy ? "is-changing" : "is-settled"} src={url} alt={`问题签图片，第 ${page + 1} 页，共 ${count} 页`} width={1200} height={1600} />}
        </div>
        <footer>
          {count > 1 && <div className="question-export-pages">
            <button type="button" className="prompt-action" disabled={busy || page === 0} onClick={() => { if (session.current) void showPage(session.current, page - 1); }}>上一张</button>
            <span aria-live="polite">{page + 1} / {count}</span>
            <button type="button" className="prompt-action" disabled={busy || page === count - 1} onClick={() => { if (session.current) void showPage(session.current, page + 1); }}>下一张</button>
          </div>}
          <div className="question-export-actions">
            <button className="question-primary-action" type="button" disabled={!url || busy || !!error} onClick={download}>{count > 1 ? `保存第 ${page + 1} 张图片` : "保存图片"}</button>
            {text.length > 0 && <button className="question-copy-button" type="button" data-copied={copyState === "copied"} onClick={() => void copy()}>
              {copyState === "copied" ? <><span aria-hidden="true">✓ </span>已复制</> : copyState === "pending" ? "正在复制…" : "复制文字"}
            </button>}
          </div>
          {text.length > 0 && <p className="question-copy-feedback" role="status" aria-live="polite" aria-atomic="true">
            {copyState === "copied" ? "文字已复制，可以粘贴到备忘录。" : copyState === "manual" ? "请在下方选中文字，使用系统的复制操作。" : ""}
          </p>}
          <p className="inspiration-hint">{count > 1 ? "文字已完整分页，请逐张查看和保存。" : "可以保存图片，也可以长按图片使用浏览器的保存功能。"}</p>
          {questionFontCoverage(text).fallback && <p className="inspiration-hint">部分字符使用设备字形；若显示不完整，可复制原文保留。</p>}
          <p role="status" className="inspiration-status">{status}</p>
          <SoftReveal show={manualCopy}>{manualCopy && <textarea ref={copyArea} className="question-copy-text" readOnly aria-label="可复制的完整原文" value={text} />}</SoftReveal>
        </footer>
      </dialog>
    </div>
  );
}
