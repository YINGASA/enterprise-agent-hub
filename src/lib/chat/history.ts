import type { AgentApiResponse, ChatRunHistoryItem, ToolRunResult } from "@/types";
import { clearClientStorageList, readClientStorageList, writeClientStorageList, type ClientStorageListOptions } from "@/lib/clientStorage";

export const STORAGE_KEY = "enterprise-agent-hub:chat-run-history";
const MAX_HISTORY_ITEMS = 30;

type HistoryResult<T> = { ok: true; data: T } | { ok: false; error: string; data: T };

function isHistoryItem(item: unknown): item is ChatRunHistoryItem {
  if (!item || typeof item !== "object") return false;
  const value = item as Partial<ChatRunHistoryItem>;
  return typeof value.id === "string" && typeof value.question === "string" && value.question.length <= 2_000 && typeof value.finalAnswer === "string" && value.finalAnswer.length <= 12_000 && typeof value.responseMode === "string" && typeof value.scenario === "string" && typeof value.intent === "string" && typeof value.createdAt === "string" && Number.isFinite(Date.parse(value.createdAt));
}

function compactDateStamp(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function makeId() {
  return "chat-" + compactDateStamp(new Date()) + "-" + Math.random().toString(36).slice(2, 8);
}

const storageOptions: ClientStorageListOptions<ChatRunHistoryItem> = { key: STORAGE_KEY, version: 1, maxItems: MAX_HISTORY_ITEMS, sanitize: (item) => isHistoryItem(item) ? item : null };
function readRawHistory() { return readClientStorageList(storageOptions); }
function writeRawHistory(items: ChatRunHistoryItem[]) { return writeClientStorageList(storageOptions, items); }

function fallbackReason(result: AgentApiResponse) {
  if (result.api.fallbackReason) return result.api.fallbackReason;
  if (result.api.errorType) return result.api.errorType;
  if (result.route.intent === "general_chat") return "general_chat";
  return undefined;
}

function isFallback(result: AgentApiResponse) {
  return result.api.responseMode === "fallback" || result.api.responseMode === "real_text_fallback" || result.route.intent === "general_chat";
}

export function createChatRunHistoryItem(result: AgentApiResponse): ChatRunHistoryItem {
  const retrievalMetadata = result.ragAnswer?.retrievalMetadata;
  const toolsUsed = result.structuredOutput.toolsUsed.length
    ? result.structuredOutput.toolsUsed
    : result.toolResults.map((item: ToolRunResult) => item.tool);

  return {
    id: makeId(),
    createdAt: new Date().toISOString(),
    question: result.question,
    finalAnswer: result.finalAnswer,
    responseMode: result.api.responseMode,
    scenario: result.route.scenario,
    intent: result.route.intent,
    confidence: result.route.confidence,
    riskLevel: result.structuredOutput.riskLevel,
    needsClarification: Boolean(result.structuredOutput.needsClarification),
    fallback: isFallback(result),
    fallbackReason: fallbackReason(result),
    toolsUsed,
    sourcesCount: result.ragAnswer?.sources.length ?? 0,
    retrievalConfidence: result.ragAnswer?.retrievalConfidence ?? retrievalMetadata?.retrievalConfidence,
    retrieverMode: retrievalMetadata?.retrieverMode,
    rerankReason: retrievalMetadata?.rerankReason,
    durationMs: result.steps.reduce((sum, step) => sum + step.durationMs, 0) + (result.api.llmDurationMs ?? 0),
    resultSnapshot: {
      route: result.route,
      ragAnswer: { retrievalMetadata: retrievalMetadata, sources: result.ragAnswer?.sources.map((source) => ({ title: source.title, category: source.category, score: source.score })) },
      toolResults: result.toolResults.map((tool) => ({ tool: tool.tool, status: tool.status })),
      steps: result.steps.map((step) => ({ type: step.type, name: step.name, status: step.status, durationMs: step.durationMs })),
    },
  };
}

export function loadChatHistory(): HistoryResult<ChatRunHistoryItem[]> {
  const result = readRawHistory();
  return result.ok ? { ok: true, data: result.data } : { ok: false, error: result.error ?? "读取聊天历史失败。", data: result.data };
}

export function saveChatRun(result: AgentApiResponse): HistoryResult<ChatRunHistoryItem[]> {
  try {
    const item = createChatRunHistoryItem(result);
    const next = [item, ...readRawHistory().data.filter((historyItem) => historyItem.id !== item.id)];
    const saved = writeRawHistory(next);
    return saved.ok ? { ok: true, data: saved.data } : { ok: false, error: saved.error ?? "保存聊天历史失败。", data: saved.data };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to save chat history.", data: [] };
  }
}

export function deleteChatRun(id: string): HistoryResult<ChatRunHistoryItem[]> {
  try {
    const saved = writeRawHistory(readRawHistory().data.filter((item) => item.id !== id));
    return saved.ok ? { ok: true, data: saved.data } : { ok: false, error: saved.error ?? "删除聊天历史失败。", data: saved.data };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to delete chat history.", data: [] };
  }
}

export function clearChatHistory(): HistoryResult<ChatRunHistoryItem[]> {
  try {
    const saved = clearClientStorageList(storageOptions);
    return saved.ok ? { ok: true, data: saved.data } : { ok: false, error: saved.error ?? "清空聊天历史失败。", data: saved.data };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to clear chat history.", data: [] };
  }
}

function listOrNone(values?: string[]) {
  return values && values.length ? values.join(", ") : "None";
}

function sourcesMarkdown(run: ChatRunHistoryItem) {
  const snapshot = run.resultSnapshot as AgentApiResponse | undefined;
  const sources = snapshot?.ragAnswer?.sources ?? [];
  if (!sources.length) return "- No sources.";
  return sources.map((source) => `- ${source.title} (${source.category}) score=${source.score ?? "N/A"}`).join("\n");
}

function toolsMarkdown(run: ChatRunHistoryItem) {
  const snapshot = run.resultSnapshot as AgentApiResponse | undefined;
  const tools = snapshot?.toolResults ?? [];
  if (!tools.length) return "- No tool calls.";
  return tools.map((tool) => `- ${tool.tool}: ${tool.status}`).join("\n");
}

function traceMarkdown(run: ChatRunHistoryItem) {
  const snapshot = run.resultSnapshot as AgentApiResponse | undefined;
  const steps = snapshot?.steps ?? [];
  if (!steps.length) return "- No trace steps.";
  return steps.map((step) => `- ${step.type} / ${step.name}: ${step.status}, ${step.durationMs}ms`).join("\n");
}

export function exportChatRunAsMarkdown(run: ChatRunHistoryItem) {
  return `# Enterprise Agent Hub Chat Run Report

- Run Time: ${run.createdAt}
- Question: ${run.question}
- Response Mode: ${run.responseMode}
- Scenario: ${run.scenario}
- Intent: ${run.intent}
- Confidence: ${typeof run.confidence === "number" ? Math.round(run.confidence * 100) + "%" : "N/A"}
- Risk Level: ${run.riskLevel ?? "N/A"}
- Retriever Mode: ${run.retrieverMode ?? "N/A"}
- Retrieval Confidence: ${run.retrievalConfidence ?? "N/A"}
- Tools Used: ${listOrNone(run.toolsUsed)}
- Sources Count: ${run.sourcesCount ?? 0}
- Needs Clarification: ${run.needsClarification ? "Yes" : "No"}
- Fallback: ${run.fallback ? "Yes" : "No"}

## Final Answer

${run.finalAnswer}

## Sources

${sourcesMarkdown(run)}

## Tool Calls

${toolsMarkdown(run)}

## Trace Summary

${traceMarkdown(run)}

## Notes

This report is generated locally from Enterprise Agent Hub Chat Workspace.
`;
}

export function exportChatRunAsJson(run: ChatRunHistoryItem) {
  return JSON.stringify(run, null, 2);
}

export function getChatRunReportFileName(extension: "md" | "json", date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
  return `chat-run-report-${stamp}.${extension}`;
}

export function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
