"use client";

type ReportPreviewKind = "markdown" | "json";

type EvaluationReportPreviewProps = {
  kind: ReportPreviewKind;
  title: string;
  content: string;
  onClose: () => void;
  onDownload: () => void;
};

export function EvaluationReportPreview({ kind, title, content, onClose, onDownload }: EvaluationReportPreviewProps) {
  async function handleCopy() {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    await navigator.clipboard.writeText(content);
  }

  return (
    <section className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="font-semibold text-ink-900">评测报告预览</h2>
          <p className="mt-1 text-sm text-ink-500">{title}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={handleCopy} className="min-h-10 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-brand-50 hover:text-brand-700">复制内容</button>
          <button type="button" onClick={onDownload} className="min-h-10 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-brand-50 hover:text-brand-700">下载{kind === "markdown" ? " Markdown" : " JSON"}</button>
          <button type="button" onClick={onClose} className="min-h-10 rounded-md bg-slate-100 px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-slate-200">关闭预览</button>
        </div>
      </div>
      <pre className="mt-4 max-h-[520px] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-950 p-4 text-xs leading-6 text-slate-100">
        {content}
      </pre>
    </section>
  );
}