"use client";

import { Fragment, useCallback, useLayoutEffect, useRef, useState } from "react";
import { METHOD_PROMPTS, PROMPT_VERSION, type PromptLanguage } from "../lib/clarifying-prompt.mjs";
import { createPromptDownload } from "../lib/prompt-download.mjs";
import { SoftResize, SoftReveal } from "./SoftMotion";

type Panel = "guide" | "prompt";
type CopyStatus = "idle" | "copying" | "success" | "error";
type ActionLocation = "top" | Panel;
type SaveResult = { status: "requested" | "error"; location: ActionLocation; filename: string; attempt: number };

export default function MethodPrompt({ language, onLanguageChange, active }: {
  language: PromptLanguage;
  onLanguageChange: (language: PromptLanguage) => void;
  active: boolean;
}) {
  const [languagePhase, setLanguagePhase] = useState<"idle" | "out" | "in">("idle");
  const languageBusy = useRef(false);
  const cancelLanguage = useRef<(() => void) | null>(null);
  const languageFocus = useRef<HTMLDivElement>(null);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  const [saveResult, setSaveResult] = useState<SaveResult | null>(null);
  const [savePulse, setSavePulse] = useState(false);
  const [saveHelp, setSaveHelp] = useState(false);
  const [manualCopy, setManualCopy] = useState(false);
  const [languageNotice, setLanguageNotice] = useState("");
  const content = METHOD_PROMPTS[language];
  const request = useRef(0);
  const busy = useRef(false);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const guideTrigger = useRef<HTMLButtonElement>(null);
  const promptTrigger = useRef<HTMLButtonElement>(null);
  const manualText = useRef<HTMLTextAreaElement>(null);
  const manualSelect = useRef<HTMLButtonElement>(null);
  const pendingFrame = useRef<number | null>(null);

  const cancelPending = useCallback(() => {
    request.current += 1;
    busy.current = false;
    if (feedbackTimer.current !== null) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = null;
    if (pendingFrame.current !== null) cancelAnimationFrame(pendingFrame.current);
    pendingFrame.current = null;
  }, []);

  // Closing the reader invalidates asynchronous feedback, not an initiated download.
  useLayoutEffect(() => cancelPending, [active, cancelPending]);
  useLayoutEffect(() => () => { cancelLanguage.current?.(); }, [active]);

  const showManualText = () => {
    setPanel("prompt");
    setManualCopy(true);
    setSaveResult((result) => result ? { ...result, location: "top" } : null);
    if (pendingFrame.current !== null) cancelAnimationFrame(pendingFrame.current);
    pendingFrame.current = requestAnimationFrame(() => {
      pendingFrame.current = null;
      manualSelect.current?.focus({ preventScroll: true });
      manualText.current?.scrollIntoView({ block: "nearest", behavior: "auto" });
    });
  };

  const focusTrigger = (target: Panel) => {
    if (pendingFrame.current !== null) cancelAnimationFrame(pendingFrame.current);
    pendingFrame.current = requestAnimationFrame(() => {
      pendingFrame.current = null;
      const button = target === "guide" ? guideTrigger.current : promptTrigger.current;
      button?.focus({ preventScroll: true });
      button?.scrollIntoView({ block: "nearest", behavior: "auto" });
    });
  };

  const commitLanguage = (next: PromptLanguage) => {
    if (next === language || busy.current || !active) return;
    cancelPending();
    setCopyStatus("idle");
    setSaveResult(null);
    setSavePulse(false);
    setSaveHelp(false);
    setManualCopy(false);
    onLanguageChange(next);
    setLanguageNotice(`已切换为${METHOD_PROMPTS[next].name}，Prompt、使用指引及复制和保存目标已同步。`);
  };

  const changeLanguage = (next: PromptLanguage) => {
    if (next === language || busy.current || languageBusy.current || !active) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) { commitLanguage(next); return; }
    let committed = false;
    let timer: ReturnType<typeof setTimeout>;
    const finish = () => {
      clearTimeout(timer);
      media.removeEventListener("change", changed);
      cancelLanguage.current = null;
      languageBusy.current = false;
      setLanguagePhase("idle");
      pendingFrame.current = requestAnimationFrame(() => {
        pendingFrame.current = null;
        if (document.activeElement === languageFocus.current) {
          languageFocus.current?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')?.focus({ preventScroll: true });
        }
      });
    };
    const commit = () => {
      if (committed) return;
      committed = true;
      commitLanguage(next);
    };
    const changed = () => { if (media.matches) { commit(); finish(); } };
    languageBusy.current = true;
    languageFocus.current?.focus({ preventScroll: true });
    setLanguagePhase("out");
    cancelLanguage.current = finish;
    media.addEventListener("change", changed);
    timer = setTimeout(() => {
      commit();
      setLanguagePhase("in");
      timer = setTimeout(finish, 260);
    }, 140);
  };

  const copyPrompt = async () => {
    if (busy.current || languageBusy.current || !active) return;
    cancelPending();
    busy.current = true;
    const token = request.current;
    const text = content.prompt;
    setSaveResult(null);
    setSavePulse(false);
    setSaveHelp(false);
    setLanguageNotice("");
    setCopyStatus("copying");
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(text);
      if (token !== request.current) return;
      busy.current = false;
      setCopyStatus("success");
      feedbackTimer.current = setTimeout(() => {
        feedbackTimer.current = null;
        if (token === request.current) setCopyStatus("idle");
      }, 2200);
    } catch {
      if (token !== request.current) return;
      busy.current = false;
      showManualText();
      setCopyStatus("error");
    }
  };

  const savePrompt = (location: ActionLocation) => {
    if (busy.current || languageBusy.current || !active) return;
    cancelPending();
    busy.current = true;
    const token = request.current;
    setCopyStatus("idle");
    setSavePulse(false);
    setSaveHelp(false);
    setLanguageNotice("");
    let url: string | null = null;
    let anchor: HTMLAnchorElement | null = null;
    try {
      const { blob, filename } = createPromptDownload(language);
      url = URL.createObjectURL(blob);
      anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.hidden = true;
      document.body.append(anchor);
      anchor.click();
      setSaveResult({ status: "requested", location, filename, attempt: token });
      setSavePulse(true);
      feedbackTimer.current = setTimeout(() => {
        feedbackTimer.current = null;
        if (token === request.current) setSavePulse(false);
      }, 2200);
    } catch {
      setSaveResult({ status: "error", location, filename: "", attempt: token });
    } finally {
      anchor?.remove();
      // Give the browser time to consume the Blob even if the reader closes.
      if (url !== null) {
        const downloadUrl = url;
        window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 30000);
      }
      busy.current = false;
    }
  };

  const setReadingPanel = (next: Panel | null, trigger: Panel) => {
    setPanel(next);
    setSaveResult((result) => result && result.location !== "top" ? { ...result, location: "top" } : result);
    focusTrigger(trigger);
  };

  const saveMessage = !active || !saveResult ? "" : saveResult.status === "requested"
    ? `已发起${content.name} TXT 下载，请查看浏览器下载记录。`
    : "暂时未能发起下载。可以重试，或复制原文留存。";
  const saveFeedback = (location: ActionLocation) => <SoftReveal show={active && saveResult?.location === location}>{active && saveResult?.location === location ? (
    <div className="method-save-feedback">
      <p>{saveMessage}</p>
      {saveResult.status === "requested" ? <>
        <p className="method-saved-filename">{saveResult.filename}</p>
        <button className="finding-text-action" type="button" disabled={!active}
          aria-expanded={saveHelp} aria-controls={`method-save-help-${location}`}
          onClick={() => setSaveHelp(!saveHelp)}>{saveHelp ? "收起保存帮助 ↑" : "没有找到文件？"}</button>
        <SoftReveal show={saveHelp}><div id={`method-save-help-${location}`} className="method-save-help">
          <p>先查看浏览器的下载记录。iPhone 可在「文件」中查找；Android 可查看「下载内容」。若仍无法取用，可复制原文，粘贴到常用的笔记应用。</p>
          <button className="finding-text-action" type="button" disabled={!active} onClick={showManualText}>查看原文</button>
        </div></SoftReveal>
      </> : <button className="finding-text-action" type="button" disabled={!active} onClick={showManualText}>查看原文</button>}
    </div>
  ) : null}</SoftReveal>;

  const copyLabel = copyStatus === "success" ? `已复制${content.name}`
    : copyStatus === "copying" ? "正在复制…" : content.copyLabel;
  const copyButton = () => (
    <button className={`prompt-action prompt-copy-action ${copyStatus === "success" ? "is-success" : ""}`}
      type="button" disabled={!active || copyStatus === "copying" || languagePhase !== "idle"} onClick={() => void copyPrompt()}
      aria-label={copyLabel} aria-describedby="method-copy-status">
      <span className={`prompt-label-stack ${copyStatus === "success" ? "is-alternate" : ""}`} aria-hidden="true">
        <span>{copyStatus === "copying" ? "正在复制…" : content.copyLabel}</span><span>已复制{content.name}</span>
      </span>
    </button>
  );
  const saveDefaultLabel = `保存${language === "zh" ? "中文" : "英文"} Prompt`;
  const saveLabel = saveResult?.status === "error" ? `重试保存${content.name}` : savePulse ? `已发起${content.name}下载` : saveDefaultLabel;
  const actionPair = (location: ActionLocation) => (
    <div className="method-action-pair">
      {copyButton()}
      <button className="prompt-action prompt-save-action" type="button" disabled={!active || copyStatus === "copying" || languagePhase !== "idle"}
        onClick={() => savePrompt(location)} aria-label={saveLabel} aria-describedby="method-save-status">
        <span className={`prompt-label-stack ${savePulse || saveResult?.status === "error" ? "is-alternate" : ""}`} aria-hidden="true">
          <span>{saveDefaultLabel}</span><span>{saveResult?.status === "error" ? "重试保存" : "已发起下载"}</span>
        </span>
      </button>
    </div>
  );
  const bottomActions = (target: Panel) => (
    <>
      <div className="method-bottom-actions">
        {actionPair(target)}
        <button className="finding-text-action" type="button" disabled={!active}
          onClick={() => setReadingPanel(null, target)}>收起{target === "guide" ? "指引" : "全文"} ↑</button>
      </div>
      {saveFeedback(target)}
    </>
  );

  return (
    <SoftResize><aside className={`prompt-tool method-prompt language-${languagePhase}`} aria-labelledby="method-prompt-title">
      <div className="method-caption"><h4 id="method-prompt-title">协作 Prompt</h4><span>v{PROMPT_VERSION}</span></div>
      <div className="method-controls">
        <div ref={languageFocus} className="method-languages" role="group" aria-label="Prompt 语言" tabIndex={-1}>
          {(["zh", "en"] as const).map((item) => <button key={item} className="method-language" type="button"
            lang={METHOD_PROMPTS[item].lang} aria-pressed={language === item} disabled={!active || copyStatus === "copying" || languagePhase !== "idle"}
            onClick={() => changeLanguage(item)}>{item === "zh" ? "中文" : "English"}</button>)}
        </div>
        {actionPair("top")}
      </div>
      <div className="method-quick-use">
        <p className="prompt-usage" lang={content.lang}>{content.quick}</p>
        <p className="prompt-usage method-save-hint">保存为 TXT 文本，留待以后使用。</p>
      </div>
      {saveFeedback("top")}
      <p className={copyStatus === "error" ? "prompt-feedback method-copy-feedback" : "sr-only"} id="method-copy-status" role="status" aria-live="polite" aria-atomic="true">
        {!active ? "" : copyStatus === "error" ? `未能自动复制${content.name}。请手动复制原文。`
          : copyStatus === "success" ? `已复制${content.name}，可粘贴到 AI 新对话。` : ""}
      </p>
      <div className="method-folds">
        <section className="method-fold">
          <button className="method-fold-toggle" type="button" id="method-guide-trigger" ref={guideTrigger}
            aria-controls="method-guide-panel" aria-expanded={panel === "guide"} disabled={!active}
            onClick={() => setReadingPanel(panel === "guide" ? null : "guide", "guide")}>
            <span className="method-fold-name">使用指引 <span className="method-fold-meta">{content.guideLabel}</span></span>
            <span className="method-fold-mark" aria-hidden="true">{panel === "guide" ? "−" : "＋"}</span>
          </button>
          <div className={`prompt-drawer ${panel === "guide" ? "is-open" : ""}`} aria-hidden={panel !== "guide"} inert={panel !== "guide"}>
            <div className="prompt-drawer-inner">
              <div id="method-guide-panel" role="region" aria-labelledby="method-guide-trigger" className="method-reading">
                <article className="method-guide" lang={content.lang}>
                  <h5>{content.guide.title}</h5><p className="method-guide-scope">{content.guide.scope}</p>
                  <p>{content.guide.intro}</p>
                  <ol>{content.guide.steps.map((step) => <li key={step.title}><div>
                    <strong className="method-step-name">{step.title}</strong>
                    {step.body.split(content.confirmation).map((part, index) => <Fragment key={index}>
                      {index > 0 && <strong>{content.confirmation}</strong>}{part}
                    </Fragment>)}
                  </div></li>)}</ol>
                  <p className="method-guide-footer">{content.guide.footer}</p>
                </article>
                {bottomActions("guide")}
              </div>
            </div>
          </div>
        </section>
        <section className="method-fold">
          <button className="method-fold-toggle" type="button" id="method-prompt-trigger" ref={promptTrigger}
            aria-controls="method-prompt-panel" aria-expanded={panel === "prompt"} disabled={!active}
            onClick={() => setReadingPanel(panel === "prompt" ? null : "prompt", "prompt")}>
            <span className="method-fold-name">Prompt 全文 <span className="method-fold-meta">{content.promptLabel}</span></span>
            <span className="method-fold-mark" aria-hidden="true">{panel === "prompt" ? "−" : "＋"}</span>
          </button>
          <div className={`prompt-drawer ${panel === "prompt" ? "is-open" : ""}`} aria-hidden={panel !== "prompt"} inert={panel !== "prompt"}>
            <div className="prompt-drawer-inner">
              <div id="method-prompt-panel" role="region" aria-labelledby="method-prompt-trigger" className="method-reading">
                {manualCopy ? <div className="method-manual">
                  <label htmlFor="method-manual-text">可在下方全选，再手动复制原文。</label>
                  <textarea id="method-manual-text" readOnly spellCheck={false} value={content.prompt} lang={content.lang} ref={manualText} rows={8} />
                  <button className="finding-text-action" type="button" ref={manualSelect} disabled={!active}
                    onClick={() => { manualText.current?.focus(); manualText.current?.select(); }}>全选原文</button>
                </div> : <pre className="prompt-text" lang={content.lang} tabIndex={panel === "prompt" ? 0 : -1}><code>{content.prompt}</code></pre>}
                {bottomActions("prompt")}
              </div>
            </div>
          </div>
        </section>
      </div>
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">{active ? languageNotice : ""}</span>
      <span className="sr-only" id="method-save-status" role="status" aria-live="polite" aria-atomic="true">
        <span key={saveResult?.attempt}>{saveMessage}</span>
      </span>
    </aside></SoftResize>
  );
}
