"use client";

import { useEffect, useRef, useState } from "react";
import { loadPostcard, POSTCARD_FILENAME, POSTCARD_SOURCE } from "../lib/postcard.mjs";
import { useSoftDismiss } from "./SoftMotion";

export default function PostcardPreview({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const [preview, setPreview] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState<"idle" | "pending" | "requested" | "error">("idle");

  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    return () => {
      requestRef.current?.abort();
      dialog?.close();
      trigger?.focus({ preventScroll: true });
    };
  }, []);

  const { closing, close } = useSoftDismiss(dialogRef, () => dialogRef.current?.close());

  const save = async () => {
    if (saving === "pending") return;
    const controller = new AbortController();
    requestRef.current = controller;
    setSaving("pending");
    try {
      const blob = await loadPostcard(fetch, controller.signal);
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = POSTCARD_FILENAME;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
      setSaving("requested");
    } catch {
      if (!controller.signal.aborted) setSaving("error");
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className={`postcard-dialog soft-dialog ${closing ? "is-closing" : ""}`}
      tabIndex={-1}
      onCancel={(event) => { event.preventDefault(); close(); }}
      aria-labelledby="postcard-preview-title"
      aria-describedby="postcard-help"
      onClose={onClose}
      data-keyboard-nav-block
      onKeyDown={(event) => event.stopPropagation()}
    >
      <header className="postcard-toolbar">
        <h2 id="postcard-preview-title">留一张明信片</h2>
        <button className="button button-quiet" type="button" onClick={close} autoFocus>
          关闭预览
        </button>
      </header>
      <div className="postcard-image-wrap" aria-busy={preview === "loading"}>
        <img
          className="postcard-image"
          src={`${POSTCARD_SOURCE}${attempt ? `?retry=${attempt}` : ""}`}
          width={1800}
          height={1200}
          alt="生日来信明信片。左侧是一张带白边的蓝天花海插画，女孩望向远方，照片下题字：未知风光。右侧手写祝福：生日快乐，Charlotte。愿你一路保有好奇，也常有惊喜。句尾有一个微笑，下方落款XCJ。右上角生日日期标记：2026年11月13日。"
          onLoad={() => setPreview("ready")}
          onError={() => setPreview("error")}
          hidden={preview === "error"}
        />
        {preview === "loading" && <p className="postcard-loading" role="status">正在展开明信片…</p>}
        {preview === "error" && (
          <div className="postcard-error" role="status">
            <p>明信片暂时没能加载，请再试一次。</p>
            <button className="button" type="button" onClick={() => { setPreview("loading"); setAttempt((value) => value + 1); }}>重新加载</button>
          </div>
        )}
      </div>
      <footer className="postcard-save-row">
        <div>
          <p id="postcard-help">保存这一张，留作小小的纪念。</p>
          <p className="postcard-save-hint">手机也可以打开原图，长按保存。</p>
          <p className="postcard-save-status" role="status" aria-live="polite">
            {saving === "pending" ? "正在准备图片…" : saving === "requested" ? "已发起保存，请查看浏览器的下载记录。" : saving === "error" ? "暂时未能保存，请重试，或打开原图保存。" : ""}
          </p>
        </div>
        <div className="postcard-save-actions">
          <a className="button button-quiet" href={POSTCARD_SOURCE} target="_blank" rel="noreferrer">打开原图</a>
          <button className="button button-primary" type="button" disabled={preview !== "ready" || saving === "pending"} onClick={() => void save()}>
            {saving === "pending" ? "正在准备…" : saving === "error" ? "重试保存" : "保存图片"}
          </button>
        </div>
      </footer>
    </dialog>
  );
}
