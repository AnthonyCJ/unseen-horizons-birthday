"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { SoftReveal } from "./SoftMotion";

export function KeepsakeImage({ src, alt, width, height, ready = true, hidden = false, className = "", onLoad, onError }: {
  src: string; alt: string; width: number; height: number; ready?: boolean; hidden?: boolean;
  className?: string; onLoad?: () => void; onError?: () => void;
}) {
  const [zoomed, setZoomed] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  useEffect(() => { stage.current?.scrollTo({ top: 0, left: 0, behavior: "auto" }); }, [src, zoomed]);
  return <div className="keepsake-image-view" hidden={hidden}>
    <div className="keepsake-view-actions">
      <p className="keepsake-view-caption">{zoomed ? "已放大 · 可滚动查看" : "完整图片"}</p>
      <button type="button" className="keepsake-control keepsake-zoom" disabled={!ready} aria-pressed={zoomed}
        onClick={() => setZoomed((value) => !value)}>
        <svg className="keepsake-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5M7.5 10.5h6" />{!zoomed && <path d="M10.5 7.5v6" />}</svg>
        <span>{zoomed ? "看完整图片" : "放大细看"}</span>
      </button>
    </div>
    <div ref={stage} className={`keepsake-stage ${zoomed ? "is-zoomed" : ""}`} tabIndex={ready ? 0 : -1}
      role="region" aria-label={zoomed ? "放大图片，可滚动查看" : "完整图片预览"}>
      {/* A native image retains the browser's image menu and touch save actions. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img key={src} src={src} alt={alt} width={width} height={height} className={className}
        style={{ "--keepsake-ratio": width / height, "--keepsake-native-width": `${width}px` } as CSSProperties}
        onLoad={onLoad} onError={onError} />
    </div>
  </div>;
}

export function KeepsakeSaveHelp({ question = false }: { question?: boolean }) {
  const [open, setOpen] = useState(false);
  return <div className="keepsake-save-help">
    <button type="button" className="keepsake-help-toggle" aria-expanded={open} onClick={() => setOpen(!open)}><span aria-hidden="true">{open ? "▾" : "▸"}</span>保存遇到困难？</button>
    <SoftReveal show={open}><p>{question
      ? "请在浏览器下载记录中核对页号与总张数。缺少图片时，翻到该张重试，也可长按图片使用浏览器保存功能。生成失败时可以重试或选择清晰文字版；完整原文也可以复制保留。"
      : "先查看浏览器的下载记录。也可以打开原图，使用浏览器的保存菜单；手机若支持，可长按图片保存。是否进入相册取决于设备。"}</p></SoftReveal>
  </div>;
}
