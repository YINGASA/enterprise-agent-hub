"use client";

import { useState } from "react";

type ReportPreviewKind = "markdown" | "json";

type EvaluationReportPreviewProps = {
  kind: ReportPreviewKind;
  title: string;
  content: string;
  onClose: () => void;
  onDownload: () => void;
};

export function EvaluationReportPreview({ kind, title, content, onClose, onDownload }: EvaluationReportPreviewProps) {
  const [copyStatus, setCopyStatus] = useState("");

  async function handleCopy() {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      setCopyStatus("当前浏览器不支持复制，请手动选择内容。");
      return;
    }
    try {
      await navigator.clipboard.writeText(content);
      setCopyStatus("报告内容已复制。");
    } catch {
      setCopyStatus("复制失败，请手动选择内容。");
    }
  }

  return (
    <section role="region" aria-label="评测报告预览" className="app-panel p-4 sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="font-semibold text-ink-900">评测报告预览</h2>
          <p className="mt-1 text-sm text-ink-500">{title}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={handleCopy} className="app-button-secondary">复制内容</button>
          <button type="button" onClick={onDownload} className="app-button-secondary">下载{kind === "markdown" ? " Markdown" : " JSON"}</button>
          <button type="button" onClick={onClose} className="app-button-tertiary">关闭预览</button>
        </div>
      </div>
      <p aria-live="polite" className="mt-2 min-h-5 text-xs text-ink-500">{copyStatus}</p>
      <pre className="mt-4 max-h-[520px] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-950 p-4 text-xs leading-6 text-slate-100">
        {content}
      </pre>
    </section>
  );
}
