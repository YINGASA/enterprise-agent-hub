import type { EvaluationRunHistoryItem, EvaluationRunResponse } from "@/types";

const STORAGE_KEY = "enterprise-agent-hub:evaluation-history";
const MAX_HISTORY_ITEMS = 20;

type HistoryResult<T> = { ok: true; data: T } | { ok: false; error: string; data: T };

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

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
    resultSnapshot: result,
  };
}

function readRawHistory(): EvaluationRunHistoryItem[] {
  if (!canUseStorage()) return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((item): item is EvaluationRunHistoryItem => Boolean(item && typeof item === "object" && "id" in item));
}

function writeRawHistory(items: EvaluationRunHistoryItem[]) {
  if (!canUseStorage()) throw new Error("localStorage is not available in this browser.");
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_HISTORY_ITEMS)));
}

export function loadEvaluationHistory(): HistoryResult<EvaluationRunHistoryItem[]> {
  try {
    return { ok: true, data: readRawHistory().slice(0, MAX_HISTORY_ITEMS) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to read evaluation history.", data: [] };
  }
}

export function saveEvaluationRun(result: EvaluationRunResponse): HistoryResult<EvaluationRunHistoryItem[]> {
  try {
    const item = createEvaluationHistoryItem(result);
    const next = [item, ...readRawHistory().filter((historyItem) => historyItem.id !== item.id)].slice(0, MAX_HISTORY_ITEMS);
    writeRawHistory(next);
    return { ok: true, data: next };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to save evaluation history.", data: [] };
  }
}

export function deleteEvaluationRun(id: string): HistoryResult<EvaluationRunHistoryItem[]> {
  try {
    const next = readRawHistory().filter((item) => item.id !== id);
    writeRawHistory(next);
    return { ok: true, data: next };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to delete evaluation history.", data: [] };
  }
}

export function clearEvaluationHistory(): HistoryResult<EvaluationRunHistoryItem[]> {
  try {
    writeRawHistory([]);
    return { ok: true, data: [] };
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
