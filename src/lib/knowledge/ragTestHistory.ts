import type { RagTestDiagnostic, RagTestHistoryItem } from "@/types";

export const RAG_TEST_HISTORY_STORAGE_KEY = "enterprise-agent-hub:rag-test-history";
const HISTORY_VERSION = 1 as const;
const HISTORY_LIMIT = 50;

type HistoryResult = { ok: true; data: RagTestHistoryItem[] } | { ok: false; data: RagTestHistoryItem[]; error: string };

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function asHistoryItem(value: unknown): RagTestHistoryItem | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<RagTestHistoryItem>;
  if (item.version !== HISTORY_VERSION || typeof item.id !== "string" || typeof item.question !== "string" || typeof item.testedAt !== "string") return null;
  if (item.confidence !== "high" && item.confidence !== "medium" && item.confidence !== "low") return null;
  if (typeof item.hit !== "boolean" || typeof item.candidateCount !== "number") return null;
  return {
    version: HISTORY_VERSION,
    id: item.id,
    question: item.question.slice(0, 2_000),
    documentId: typeof item.documentId === "string" ? item.documentId : undefined,
    testedAt: item.testedAt,
    hit: item.hit,
    topSourceId: typeof item.topSourceId === "string" ? item.topSourceId : undefined,
    confidence: item.confidence,
    candidateCount: item.candidateCount,
  };
}

export function loadRagTestHistory(): HistoryResult {
  if (!canUseStorage()) return { ok: true, data: [] };
  try {
    const raw = window.localStorage.getItem(RAG_TEST_HISTORY_STORAGE_KEY);
    if (!raw) return { ok: true, data: [] };
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return { ok: true, data: [] };
    return { ok: true, data: parsed.map(asHistoryItem).filter((item): item is RagTestHistoryItem => Boolean(item)).slice(0, HISTORY_LIMIT) };
  } catch {
    return { ok: false, data: [], error: "RAG 测试历史读取失败，已安全恢复为空状态。" };
  }
}

export function saveRagTestHistoryItem(diagnostic: RagTestDiagnostic): HistoryResult {
  const current = loadRagTestHistory();
  const item: RagTestHistoryItem = {
    version: HISTORY_VERSION,
    id: `rag-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    question: diagnostic.question.slice(0, 2_000),
    documentId: diagnostic.currentDocumentId,
    testedAt: new Date().toISOString(),
    hit: diagnostic.currentDocumentId ? Boolean(diagnostic.hitCurrentDocument) : diagnostic.reliableSourceCount > 0,
    topSourceId: diagnostic.sources[0]?.sourceId,
    confidence: diagnostic.retrievalConfidence,
    candidateCount: diagnostic.candidateCount,
  };
  const next = [item, ...current.data].slice(0, HISTORY_LIMIT);
  if (!canUseStorage()) return { ok: false, data: next, error: "当前浏览器不支持 localStorage。" };
  try {
    window.localStorage.setItem(RAG_TEST_HISTORY_STORAGE_KEY, JSON.stringify(next));
    return { ok: true, data: next };
  } catch {
    return { ok: false, data: next, error: "RAG 测试历史保存失败。" };
  }
}
