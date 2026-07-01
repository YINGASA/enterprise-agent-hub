"use client";

import { useState } from "react";

type ReportPreviewKind = "markdown" | "json";

type ChatRunReportPreviewProps = {
  kind: ReportPreviewKind;
  title: string;
  content: string;
  onClose: () => void;
  onDownload: () => void;
};

const text = {
  title: "\u8fd0\u884c\u62a5\u544a\u9884\u89c8",
  copy: "\u590d\u5236\u5185\u5bb9",
  copied: "\u5df2\u590d\u5236",
  copyFailed: "\u590d\u5236\u5931\u8d25\uff0c\u8bf7\u624b\u52a8\u9009\u62e9\u5185\u5bb9\u590d\u5236\u3002",
  download: "\u4e0b\u8f7d",
  close: "\u5173\u95ed\u9884\u89c8",
};

export function ChatRunReportPreview({ kind, title, content, onClose, onDownload }: ChatRunReportPreviewProps) {
  const [copyMessage, setCopyMessage] = useState("");

  async function handleCopy() {
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard) throw new Error("Clipboard is not available.");
      await navigator.clipboard.writeText(content);
      setCopyMessage(text.copied);
    } catch {
      setCopyMessage(text.copyFailed);
    }
  }

  return (
    <section className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="font-semibold text-ink-900">{text.title}</h2>
          <p className="mt-1 text-sm text-ink-500">{title}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={handleCopy} className="min-h-10 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-brand-50 hover:text-brand-700">{text.copy}</button>
          <button type="button" onClick={onDownload} className="min-h-10 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-brand-50 hover:text-brand-700">{text.download}{kind === "markdown" ? " Markdown" : " JSON"}</button>
          <button type="button" onClick={onClose} className="min-h-10 rounded-md bg-slate-100 px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-slate-200">{text.close}</button>
        </div>
      </div>
      {copyMessage ? <p className="mt-3 rounded-md bg-brand-50 p-3 text-sm text-brand-700">{copyMessage}</p> : null}
      <pre className="mt-4 max-h-[520px] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-950 p-4 text-xs leading-6 text-slate-100">
        {content}
      </pre>
    </section>
  );
}
