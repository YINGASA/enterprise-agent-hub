import { clearClientStorageList, readClientStorageList, writeClientStorageList, type ClientStorageListOptions, type ClientStorageResult } from "@/lib/clientStorage";
import { agentRequestLimits, knowledgeStorageLimits } from "@/lib/ops/securityLimits";
import type { RagTestDiagnostic, RagTestHistoryItem } from "@/types";

export const RAG_TEST_HISTORY_STORAGE_KEY = "enterprise-agent-hub:rag-test-history";

function validDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function sanitize(value: unknown): RagTestHistoryItem | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<RagTestHistoryItem>;
  if (item.version !== 1 || typeof item.id !== "string" || !item.id || typeof item.question !== "string" || !item.question.trim() || !validDate(item.testedAt) || typeof item.hit !== "boolean" || typeof item.candidateCount !== "number" || item.candidateCount < 0) return null;
  if (item.confidence !== "high" && item.confidence !== "medium" && item.confidence !== "low") return null;
  return { version: 1, id: item.id.slice(0, 128), question: item.question.slice(0, agentRequestLimits.questionChars), documentId: typeof item.documentId === "string" ? item.documentId.slice(0, 128) : undefined, testedAt: item.testedAt, hit: item.hit, topSourceId: typeof item.topSourceId === "string" ? item.topSourceId.slice(0, 128) : undefined, confidence: item.confidence, candidateCount: item.candidateCount };
}

const options: ClientStorageListOptions<RagTestHistoryItem> = { key: RAG_TEST_HISTORY_STORAGE_KEY, version: 1, maxItems: knowledgeStorageLimits.ragTestHistoryLimit, sanitize };
export type RagTestHistoryResult = { ok: true; data: RagTestHistoryItem[] } | { ok: false; data: RagTestHistoryItem[]; error: string };

function result(value: ClientStorageResult<RagTestHistoryItem>): RagTestHistoryResult {
  return value.ok ? { ok: true, data: value.data } : { ok: false, data: value.data, error: value.error ?? "RAG test history storage is unavailable." };
}

export function loadRagTestHistory(): RagTestHistoryResult {
  return result(readClientStorageList(options));
}

export function saveRagTestHistoryItem(diagnostic: RagTestDiagnostic): RagTestHistoryResult {
  const current = loadRagTestHistory();
  const item: RagTestHistoryItem = { version: 1, id: `rag-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, question: diagnostic.question.slice(0, agentRequestLimits.questionChars), documentId: diagnostic.currentDocumentId, testedAt: new Date().toISOString(), hit: diagnostic.currentDocumentId ? Boolean(diagnostic.hitCurrentDocument) : diagnostic.reliableSourceCount > 0, topSourceId: diagnostic.sources[0]?.sourceId, confidence: diagnostic.retrievalConfidence, candidateCount: diagnostic.candidateCount };
  return result(writeClientStorageList(options, [item, ...current.data]));
}

export function clearRagTestHistory(): RagTestHistoryResult {
  return result(clearClientStorageList(options));
}
