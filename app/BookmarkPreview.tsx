"use client";

import { useEffect, useRef, useState } from "react";
import { BOOKMARK_FILENAME, BOOKMARK_SOURCE, loadBookmark } from "../lib/bookmark.mjs";
import { KeepsakeImage, KeepsakeSaveHelp } from "./KeepsakeImage";
import { usePreviewHistory } from "./usePreviewHistory";

export default function BookmarkPreview({ onClose }: { onClose: () => void }) {
  const title = useRef<HTMLHeadingElement>(null);
  const request = useRef<AbortController | null>(null);
  const history = usePreviewHistory(onClose);
  const { enter } = history;
  const [preview, setPreview] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState<"idle" | "pending" | "requested" | "error">("idle");
  useEffect(() => {
    enter();
    title.current?.focus({ preventScroll: true });
    return () => { request.current?.abort(); };
  }, [enter]);

  const save = async () => {
    if (saving === "pending" || preview !== "ready") return;
    const controller = new AbortController();
    request.current = controller;
    setSaving("pending");
    let url = "";
    let anchor: HTMLAnchorElement | null = null;
    try {
      const blob = await loadBookmark(fetch, controller.signal);
      if (controller.signal.aborted) return;
      url = URL.createObjectURL(blob);
      anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = BOOKMARK_FILENAME;
      document.body.append(anchor);
      anchor.click();
      setSaving("requested");
    } catch { if (!controller.signal.aborted) setSaving("error"); }
    finally {
      anchor?.remove();
      if (url) window.setTimeout(() => URL.revokeObjectURL(url), 30000);
    }
  };

  return <div className="bookmark-preview keepsake-surface" data-keyboard-nav-block onKeyDown={(event) => {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); history.leave(); }
    else if (event.key !== "Tab") event.stopPropagation();
  }}>
    <header className="bookmark-preview-header keepsake-header">
      <h2 ref={title} id="bookmark-preview-title" className="keepsake-title" tabIndex={-1}>鸢尾书签</h2>
      <button type="button" className="keepsake-control keepsake-back" onClick={history.leave}><span aria-hidden="true">←</span>返回这页体会</button>
    </header>
    <div className="bookmark-preview-body keepsake-body">
      <div aria-busy={preview === "loading"}>
        <KeepsakeImage src={`${BOOKMARK_SOURCE}${attempt ? `?retry=${attempt}` : ""}`} width={1080} height={2880}
          alt="深紫暖金鸢尾书签。求索有回响，停歇有晴朗；愿那些值得长久追问的问题，总能遇见你清醒、从容的目光。For Charlotte，11 · 13。"
          ready={preview === "ready"} hidden={preview === "error"} onLoad={() => setPreview("ready")} onError={() => setPreview("error")} />
        {preview === "loading" && <p role="status">正在展开书签…</p>}
        {preview === "error" && <div role="status"><p>书签暂时没能加载，请再试一次。</p>
          <button className="keepsake-control" type="button" onClick={() => { setPreview("loading"); setAttempt((value) => value + 1); }}>重新加载</button></div>}
      </div>
      <footer className="bookmark-preview-footer keepsake-footer">
        <p className="keepsake-save-copy">保存这一枚，留待以后翻阅。</p>
        <div className="keepsake-save-actions">
          <button className="keepsake-control keepsake-primary" type="button" disabled={preview !== "ready" || saving === "pending"} onClick={() => void save()}>
            {saving === "pending" ? "正在准备…" : saving === "error" ? "重试保存" : "保存书签图片"}</button>
          <a className="keepsake-original" href={BOOKMARK_SOURCE} target="_blank" rel="noreferrer" aria-label="打开原图（新标签）">打开原图 <span aria-hidden="true">↗</span></a>
        </div>
        <p role="status" aria-live="polite" className="keepsake-save-status">{saving === "pending" ? "正在准备图片…"
          : saving === "requested" ? "已发起保存，请查看浏览器下载记录。"
          : saving === "error" ? "暂时未能发起保存。可以重试，或打开原图保存。" : ""}</p>
        <KeepsakeSaveHelp />
      </footer>
    </div>
  </div>;
}
