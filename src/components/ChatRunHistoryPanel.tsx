"use client";

import { useEffect, useMemo, useState } from "react";
import { ChatRunReportPreview } from "@/components/ChatRunReportPreview";
import {
  clearChatHistory,
  createChatRunHistoryItem,
  deleteChatRun,
  downloadTextFile,
  exportChatRunAsJson,
  exportChatRunAsMarkdown,
  getChatRunReportFileName,
  loadChatHistory,
  saveChatRun,
} from "@/lib/chat/history";
import type { AgentApiResponse, ChatRunHistoryItem } from "@/types";

type PreviewState = { kind: "markdown" | "json"; title: string; content: string; run: ChatRunHistoryItem } | null;

type ChatRunHistoryPanelProps = {
  currentResult: AgentApiResponse | null;
};

const text = {
  title: "Chat \u8fd0\u884c\u5386\u53f2",
  desc: "\u6700\u8fd1 30 \u6b21\u8fd0\u884c\u4f1a\u4fdd\u5b58\u5728\u5f53\u524d\u6d4f\u89c8\u5668\u672c\u5730\uff0c\u7528\u4e8e\u590d\u76d8 Router / RAG / Tools / LLM / Retriever Trace\u3002",
  save: "\u4fdd\u5b58\u672c\u6b21\u8fd0\u884c",
  exportMarkdown: "\u5bfc\u51fa Markdown",
  exportJson: "\u5bfc\u51fa JSON",
  previewMarkdown: "\u9884\u89c8 Markdown",
  previewJson: "\u9884\u89c8 JSON",
  details: "\u67e5\u770b\u8be6\u60c5",
  collapse: "\u6536\u8d77\u8be6\u60c5",
  clear: "\u6e05\u7a7a\u5386\u53f2",
  delete: "\u5220\u9664",
  empty: "\u6682\u65e0\u8fd0\u884c\u5386\u53f2\u3002\u8fd0\u884c Agent Pipeline \u540e\u70b9\u51fb\u4fdd\u5b58\u5373\u53ef\u7559\u5b58\u8bb0\u5f55\u3002",
  noCurrent: "\u8bf7\u5148\u8fd0\u884c\u4e00\u6b21 Agent Pipeline\u3002",
  saved: "\u5df2\u5c06\u672c\u6b21\u8fd0\u884c\u4fdd\u5b58\u5230\u6d4f\u89c8\u5668\u672c\u5730\u3002",
  deleted: "\u5df2\u5220\u9664\u4e00\u6761\u8fd0\u884c\u8bb0\u5f55\u3002",
  cleared: "\u5df2\u6e05\u7a7a Chat \u8fd0\u884c\u5386\u53f2\u3002",
  confirmClear: "\u786e\u8ba4\u6e05\u7a7a\u6240\u6709 Chat \u8fd0\u884c\u5386\u53f2\u5417\uff1f",
  markdownReport: "Markdown \u8fd0\u884c\u62a5\u544a",
  jsonReport: "JSON \u8fd0\u884c\u62a5\u544a",
};

function secondaryButtonClass() {
  return "min-h-10 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-brand-50 hover:text-brand-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-ink-400";
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function percent(value?: number) {
  return typeof value === "number" ? `${Math.round(value * 100)}%` : "N/A";
}

function yesNo(value?: boolean) {
  return value ? "\u662f" : "\u5426";
}

function scenarioLabel(value: string) {
  const labels: Record<string, string> = {
    enterprise: "\u4f01\u4e1a\u77e5\u8bc6\u5e93",
    ecommerce: "\u7535\u5546\u552e\u540e",
    recruitment: "\u62db\u8058\u6c42\u804c",
    ai_engineering: "AI \u5de5\u7a0b\u89c4\u8303",
    "ai-engineering": "AI \u5de5\u7a0b\u89c4\u8303",
    general: "\u901a\u7528\u515c\u5e95",
  };
  return labels[value] ?? value;
}

function intentLabel(value: string) {
  const labels: Record<string, string> = {
    knowledge_qa: "\u77e5\u8bc6\u5e93\u95ee\u7b54",
    policy_check: "\u89c4\u5219\u5224\u65ad",
    order_query: "\u8ba2\u5355\u67e5\u8be2",
    product_query: "\u5546\u54c1\u67e5\u8be2",
    after_sale_reply: "\u552e\u540e\u56de\u590d",
    jd_match: "JD \u5339\u914d",
    ticket_create: "\u5de5\u5355\u521b\u5efa",
    general_chat: "\u901a\u7528\u5bf9\u8bdd",
  };
  return labels[value] ?? value;
}

function modeLabel(value?: string) {
  const labels: Record<string, string> = {
    mock: "Mock \u6a21\u5f0f",
    real: "Real API",
    real_repaired: "Real API \u00b7 JSON \u4fee\u590d",
    real_text_fallback: "Real API \u00b7 \u6587\u672c\u515c\u5e95",
    fallback: "\u515c\u5e95\u6a21\u5f0f",
  };
  return value ? labels[value] ?? value : "N/A";
}

function retrieverLabel(value?: string) {
  const labels: Record<string, string> = {
    hybrid: "Hybrid \u68c0\u7d22",
    mock_embedding: "Mock Embedding \u68c0\u7d22",
    auto: "\u81ea\u52a8\u68c0\u7d22\u7b56\u7565",
  };
  return value ? labels[value] ?? value : "N/A";
}

function toolsText(value?: string[]) {
  return value && value.length ? value.join(" + ") : "\u672a\u8c03\u7528\u5de5\u5177";
}

function triggerMarkdownDownload(run: ChatRunHistoryItem) {
  downloadTextFile(getChatRunReportFileName("md"), exportChatRunAsMarkdown(run), "text/markdown;charset=utf-8");
}

function triggerJsonDownload(run: ChatRunHistoryItem) {
  downloadTextFile(getChatRunReportFileName("json"), exportChatRunAsJson(run), "application/json;charset=utf-8");
}

function snapshotPreview(run: ChatRunHistoryItem) {
  return JSON.stringify({
    route: (run.resultSnapshot as AgentApiResponse | undefined)?.route,
    ragMetadata: (run.resultSnapshot as AgentApiResponse | undefined)?.ragAnswer?.retrievalMetadata,
    tools: (run.resultSnapshot as AgentApiResponse | undefined)?.toolResults,
    api: (run.resultSnapshot as AgentApiResponse | undefined)?.api,
  }, null, 2);
}

export function ChatRunHistoryPanel({ currentResult }: ChatRunHistoryPanelProps) {
  const [history, setHistory] = useState<ChatRunHistoryItem[]>([]);
  const [message, setMessage] = useState("");
  const [clearConfirmationOpen, setClearConfirmationOpen] = useState(false);
  const [expandedId, setExpandedId] = useState("");
  const [preview, setPreview] = useState<PreviewState>(null);

  useEffect(() => {
    const loaded = loadChatHistory();
    setHistory(loaded.data);
    if (!loaded.ok) setMessage(loaded.error);
  }, []);

  const currentRun = useMemo(() => currentResult ? createChatRunHistoryItem(currentResult) : null, [currentResult]);

  function handleSave() {
    if (!currentResult) {
      setMessage(text.noCurrent);
      return;
    }
    const saved = saveChatRun(currentResult);
    setHistory(saved.data);
    setMessage(saved.ok ? text.saved : saved.error);
  }

  function handleDelete(id: string) {
    const next = deleteChatRun(id);
    setHistory(next.data);
    setExpandedId("");
    setMessage(next.ok ? text.deleted : next.error);
  }

  function handleClear() {
    const next = clearChatHistory();
    setHistory(next.data);
    setExpandedId("");
    setMessage(next.ok ? text.cleared : next.error);
    setClearConfirmationOpen(false);
  }

  function openMarkdownPreview(run: ChatRunHistoryItem) {
    setPreview({ kind: "markdown", title: text.markdownReport, content: exportChatRunAsMarkdown(run), run });
  }

  function openJsonPreview(run: ChatRunHistoryItem) {
    setPreview({ kind: "json", title: text.jsonReport, content: exportChatRunAsJson(run), run });
  }

  return (
    <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="font-semibold text-ink-900">{text.title}</h2>
          <p className="mt-1 text-sm leading-6 text-ink-500">{text.desc}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={handleSave} disabled={!currentResult} className={secondaryButtonClass()}>{text.save}</button>
          <button type="button" onClick={() => currentRun && openMarkdownPreview(currentRun)} disabled={!currentRun} className={secondaryButtonClass()}>{text.previewMarkdown}</button>
          <button type="button" onClick={() => currentRun && openJsonPreview(currentRun)} disabled={!currentRun} className={secondaryButtonClass()}>{text.previewJson}</button>
          <button type="button" onClick={() => currentRun && triggerMarkdownDownload(currentRun)} disabled={!currentRun} className={secondaryButtonClass()}>{text.exportMarkdown}</button>
          <button type="button" onClick={() => currentRun && triggerJsonDownload(currentRun)} disabled={!currentRun} className={secondaryButtonClass()}>{text.exportJson}</button>
          {history.length ? <button type="button" onClick={() => setClearConfirmationOpen(true)} className={secondaryButtonClass()}>{text.clear}</button> : null}
        </div>
      </div>

      {message ? <p className="rounded-md bg-brand-50 p-3 text-sm text-brand-700">{message}</p> : null}
      {preview ? <ChatRunReportPreview kind={preview.kind} title={preview.title} content={preview.content} onClose={() => setPreview(null)} onDownload={() => preview.kind === "markdown" ? triggerMarkdownDownload(preview.run) : triggerJsonDownload(preview.run)} /> : null}
      {clearConfirmationOpen ? <div role="alertdialog" aria-labelledby="chat-history-clear-title" aria-describedby="chat-history-clear-description" className="rounded-lg border border-rose-200 bg-rose-50 p-4"><p id="chat-history-clear-title" className="font-semibold text-rose-900">清空 Chat 运行历史？</p><p id="chat-history-clear-description" className="mt-1 text-sm text-rose-800">{text.confirmClear}</p><div className="mt-3 flex gap-2"><button type="button" autoFocus onClick={() => setClearConfirmationOpen(false)} className={secondaryButtonClass()}>取消</button><button type="button" onClick={handleClear} className="min-h-10 rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500">确认清空</button></div></div> : null}

      {history.length === 0 ? <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm text-ink-500">{text.empty}</p> : <div className="space-y-3">
        {history.map((item) => (
          <article key={item.id} className="rounded-md border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="break-words text-sm font-semibold text-ink-900">{formatDate(item.createdAt)} · {modeLabel(item.responseMode)} · {scenarioLabel(item.scenario)} / {intentLabel(item.intent)}</p>
                <p className="mt-1 line-clamp-2 break-words text-sm text-ink-600">{item.question}</p>
                <p className="mt-2 text-xs text-ink-500">{retrieverLabel(item.retrieverMode)} · {item.retrievalConfidence ?? "N/A"} · fallback {yesNo(item.fallback)} · clarify {yesNo(item.needsClarification)} · tools {item.toolsUsed?.length ?? 0} · sources {item.sourcesCount ?? 0}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setExpandedId(expandedId === item.id ? "" : item.id)} className={secondaryButtonClass()}>{expandedId === item.id ? text.collapse : text.details}</button>
                <button type="button" onClick={() => openMarkdownPreview(item)} className={secondaryButtonClass()}>{text.previewMarkdown}</button>
                <button type="button" onClick={() => openJsonPreview(item)} className={secondaryButtonClass()}>{text.previewJson}</button>
                <button type="button" onClick={() => triggerMarkdownDownload(item)} className={secondaryButtonClass()}>{text.exportMarkdown}</button>
                <button type="button" onClick={() => triggerJsonDownload(item)} className={secondaryButtonClass()}>{text.exportJson}</button>
                <button type="button" onClick={() => handleDelete(item.id)} className={secondaryButtonClass()}>{text.delete}</button>
              </div>
            </div>
            {expandedId === item.id ? <div className="mt-4 grid gap-3 text-sm text-ink-700 md:grid-cols-2 xl:grid-cols-3">
              <p>Question: {item.question}</p>
              <p>Response Mode: {modeLabel(item.responseMode)}</p>
              <p>Scenario / Intent: {scenarioLabel(item.scenario)} / {intentLabel(item.intent)}</p>
              <p>Confidence: {percent(item.confidence)}</p>
              <p>Risk Level: {item.riskLevel ?? "N/A"}</p>
              <p>Retriever Mode: {retrieverLabel(item.retrieverMode)}</p>
              <p>Retrieval Confidence: {item.retrievalConfidence ?? "N/A"}</p>
              <p>Rerank Reason: {item.rerankReason ?? "N/A"}</p>
              <p>Tools Used: {toolsText(item.toolsUsed)}</p>
              <p>Sources Count: {item.sourcesCount ?? 0}</p>
              <p>Needs Clarification: {yesNo(item.needsClarification)}</p>
              <p>Fallback: {yesNo(item.fallback)} {item.fallbackReason ? `(${item.fallbackReason})` : ""}</p>
              <p>Duration: {typeof item.durationMs === "number" ? item.durationMs + "ms" : "N/A"}</p>
              <p className="md:col-span-2 xl:col-span-3 whitespace-pre-wrap break-words rounded-md bg-white p-3 leading-6">{item.finalAnswer}</p>
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-md bg-slate-950 p-3 text-xs leading-6 text-slate-100 md:col-span-2 xl:col-span-3">{snapshotPreview(item)}</pre>
            </div> : null}
          </article>
        ))}
      </div>}
    </section>
  );
}
