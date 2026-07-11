import type { EvaluationRunHistoryItem, EvaluationRunResponse } from "@/types";
import { clearClientStorageList, readClientStorageList, writeClientStorageList, type ClientStorageListOptions } from "@/lib/clientStorage";

export const STORAGE_KEY = "enterprise-agent-hub:evaluation-history";
const MAX_HISTORY_ITEMS = 20;

type HistoryResult<T> = { ok: true; data: T } | { ok: false; error: string; data: T };


function compactDateStamp(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function makeId() {
  return "eval-" + compactDateStamp(new Date()) + "-" + Math.random().toString(36).slice(2, 8);
}

export function createEvaluationHistoryItem(result: EvaluationRunResponse): EvaluationRunHistoryItem {
  const failedCount = result.results.filter((item) => !item.passed).length;
  const failureSummary = failedCount === 0 ? "All cases passed." : `${failedCount} failed case(s). Check failureBuckets and resultSnapshot for details.`;
  return {
    id: makeId(),
    createdAt: new Date().toISOString(),
    mode: result.mode,
    suite: result.selectedSuite,
    caseCount: result.summary.caseCount,
    passed: result.summary.passed,
    passRate: result.summary.passRate,
    scenarioAccuracy: result.summary.scenarioAccuracy,
    intentAccuracy: result.summary.intentAccuracy,
    toolHitRate: result.summary.toolHitRate,
    ragUsageAccuracy: result.summary.ragUsageAccuracy,
    citationRate: result.summary.citationRate,
    keywordHitRate: result.summary.keywordHitRate,
    fallbackRate: result.summary.fallbackRate,
    averageRagScore: result.summary.averageRagScore,
    failureSummary,
    failureBuckets: result.summary.failureBuckets,
    resultSnapshot: { summary: result.summary, selectedSuite: result.selectedSuite, mode: result.mode, startedAt: result.startedAt, finishedAt: result.finishedAt },
  };
}

function sanitizeHistoryItem(value: unknown): EvaluationRunHistoryItem | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<EvaluationRunHistoryItem>;
  if (typeof item.id !== "string" || typeof item.createdAt !== "string" || !Number.isFinite(Date.parse(item.createdAt)) || (item.mode !== "mock" && item.mode !== "real") || typeof item.suite !== "string" || typeof item.caseCount !== "number" || typeof item.passed !== "number" || typeof item.passRate !== "number" || item.caseCount < 0 || item.passed < 0 || item.passed > item.caseCount || item.passRate < 0 || item.passRate > 100) return null;
  return { ...item, id: item.id.slice(0, 128), suite: item.suite.slice(0, 48), resultSnapshot: undefined } as EvaluationRunHistoryItem;
}
const storageOptions: ClientStorageListOptions<EvaluationRunHistoryItem> = { key: STORAGE_KEY, version: 1, maxItems: MAX_HISTORY_ITEMS, sanitize: sanitizeHistoryItem };
function readRawHistory() { return readClientStorageList(storageOptions); }
function writeRawHistory(items: EvaluationRunHistoryItem[]) { return writeClientStorageList(storageOptions, items); }

export function loadEvaluationHistory(): HistoryResult<EvaluationRunHistoryItem[]> {
  try {
    const loaded = readRawHistory();
    return loaded.ok ? { ok: true, data: loaded.data } : { ok: false, error: loaded.error ?? "读取评测历史失败。", data: loaded.data };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to read evaluation history.", data: [] };
  }
}

export function saveEvaluationRun(result: EvaluationRunResponse): HistoryResult<EvaluationRunHistoryItem[]> {
  try {
    const item = createEvaluationHistoryItem(result);
    const saved = writeRawHistory([item, ...readRawHistory().data.filter((historyItem) => historyItem.id !== item.id)]);
    return saved.ok ? { ok: true, data: saved.data } : { ok: false, error: saved.error ?? "保存评测历史失败。", data: saved.data };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to save evaluation history.", data: [] };
  }
}

export function deleteEvaluationRun(id: string): HistoryResult<EvaluationRunHistoryItem[]> {
  try {
    const saved = writeRawHistory(readRawHistory().data.filter((item) => item.id !== id));
    return saved.ok ? { ok: true, data: saved.data } : { ok: false, error: saved.error ?? "删除评测历史失败。", data: saved.data };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to delete evaluation history.", data: [] };
  }
}

export function clearEvaluationHistory(): HistoryResult<EvaluationRunHistoryItem[]> {
  try {
    const saved = clearClientStorageList(storageOptions);
    return saved.ok ? { ok: true, data: saved.data } : { ok: false, error: saved.error ?? "清空评测历史失败。", data: saved.data };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to clear evaluation history.", data: [] };
  }
}

function formatPercent(value?: number) {
  return typeof value === "number" ? `${value}%` : "N/A";
}

function formatNumber(value?: number) {
  return typeof value === "number" ? String(value) : "N/A";
}

export function exportEvaluationAsMarkdown(run: EvaluationRunHistoryItem) {
  const failureBuckets = run.failureBuckets ?? {};
  const bucketLines = Object.keys(failureBuckets).length
    ? Object.entries(failureBuckets).map(([key, value]) => `- ${key}: ${value}`).join("\n")
    : "- No failure buckets.";

  return `# Enterprise Agent Hub Evaluation Report

- Run Time: ${run.createdAt}
- Mode: ${run.mode}
- Suite: ${run.suite}
- Total Cases: ${run.caseCount}
- Passed: ${run.passed}
- Pass Rate: ${formatPercent(run.passRate)}
- Scenario Accuracy: ${formatPercent(run.scenarioAccuracy)}
- Intent Accuracy: ${formatPercent(run.intentAccuracy)}
- Tool Hit Rate: ${formatPercent(run.toolHitRate)}
- RAG Usage Accuracy: ${formatPercent(run.ragUsageAccuracy)}
- Citation Rate: ${formatPercent(run.citationRate)}
- Keyword Hit Rate: ${formatPercent(run.keywordHitRate)}
- Fallback Rate: ${formatPercent(run.fallbackRate)}
- Average RAG Score: ${formatNumber(run.averageRagScore)}

## Failure Summary

${run.failureSummary ?? "No failure summary."}

## Failure Buckets

${bucketLines}

## Notes

This report is generated locally from Enterprise Agent Hub Evaluation Dashboard.
`;
}

export function exportEvaluationAsJson(run: EvaluationRunHistoryItem) {
  return JSON.stringify(run, null, 2);
}

export function getEvaluationReportFileName(extension: "md" | "json", date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
  return `evaluation-report-${stamp}.${extension}`;
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
