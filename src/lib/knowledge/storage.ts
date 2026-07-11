import { agentRequestLimits, knowledgeStorageLimits } from "@/lib/ops/securityLimits";
import { clearKnowledgeDerivedCache, invalidateKnowledgeDerived } from "@/lib/knowledge/derived";
import type { ImportedKnowledgeDocument, KnowledgeDocument, RagTestDiagnostic, RagTestHistoryItem } from "@/types";

export const USER_KNOWLEDGE_STORAGE_KEY = "enterprise-agent-hub:user-knowledge-documents";
export const RAG_TEST_HISTORY_STORAGE_KEY = "enterprise-agent-hub:rag-test-history";
const LEGACY_USER_KNOWLEDGE_STORAGE_KEY = "enterprise-agent-hub-user-documents";

export type StorageResult<T> = { ok: true; data: T; notice?: string } | { ok: false; data: T; error: string; notice?: string };
export type KnowledgeStorageEnvelope = { version: 2; documents: ImportedKnowledgeDocument[]; updatedAt: string };
export type KnowledgeBackup = { version: 2; exportedAt: string; documents: ImportedKnowledgeDocument[] };
export type KnowledgeBackupPreview = {
  ok: boolean;
  documents: ImportedKnowledgeDocument[];
  counts: { incoming: number; new: number; duplicate: number; conflict: number; invalid: number };
  errors: string[];
};

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function isValidDate(value: unknown): value is string {
  return typeof value === "string" && Boolean(value.trim()) && Number.isFinite(Date.parse(value));
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function dateOrFallback(value: unknown, fallback: string) {
  return isValidDate(value) ? value.trim() : fallback;
}

function isStringArray(value: unknown, maxItems: number, maxLength: number) {
  return Array.isArray(value) && value.length <= maxItems && value.every((item): item is string => typeof item === "string" && item.trim().length > 0 && item.length <= maxLength);
}

export function getKnowledgeDocumentFingerprint(document: Pick<KnowledgeDocument, "title" | "content">) {
  const normalized = `${document.title}\n${document.content}`.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
  let hash = 2166136261;
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function sanitizeImportedKnowledgeDocument(value: unknown): ImportedKnowledgeDocument | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Partial<KnowledgeDocument>;
  const sourceType = item.sourceType === "user_upload" || item.sourceType === "user_paste" ? item.sourceType : null;
  if (!sourceType || typeof item.id !== "string" || !item.id.trim() || item.id.length > agentRequestLimits.documentIdChars) return null;
  if (typeof item.title !== "string" || !item.title.trim() || item.title.length > agentRequestLimits.documentTitleChars) return null;
  if (typeof item.content !== "string" || !item.content.trim() || item.content.length > agentRequestLimits.documentContentChars) return null;
  if (item.category !== undefined && (typeof item.category !== "string" || item.category.length > agentRequestLimits.documentCategoryChars)) return null;
  if (item.summary !== undefined && (typeof item.summary !== "string" || item.summary.length > agentRequestLimits.documentSummaryChars)) return null;
  if (item.tags !== undefined && !isStringArray(item.tags, agentRequestLimits.documentTags, agentRequestLimits.documentTagChars)) return null;
  if (item.suggestedQuestions !== undefined && !isStringArray(item.suggestedQuestions, agentRequestLimits.documentSuggestedQuestions, agentRequestLimits.documentSuggestedQuestionChars)) return null;
  if (item.enabled !== undefined && typeof item.enabled !== "boolean") return null;

  const now = new Date().toISOString();
  const importedAt = dateOrFallback(item.importedAt, dateOrFallback(item.createdAt, now));
  const createdAt = dateOrFallback(item.createdAt, importedAt);
  return {
    id: item.id.trim(),
    packId: typeof item.packId === "string" && item.packId.length <= 80 ? item.packId : undefined,
    title: item.title.trim(),
    category: asString(item.category, "用户导入"),
    tags: Array.isArray(item.tags) ? item.tags.map((tag) => tag.trim()) : [],
    summary: asString(item.summary, item.content.slice(0, 120)),
    content: item.content,
    createdAt,
    updatedAt: dateOrFallback(item.updatedAt, importedAt),
    source: sourceType === "user_upload" ? "local file" : "pasted text",
    owner: "用户导入",
    isDefault: false,
    sourceType,
    originalFileName: typeof item.originalFileName === "string" && item.originalFileName.length <= 240 ? item.originalFileName : undefined,
    importedAt,
    enabled: item.enabled !== false,
    suggestedQuestions: Array.isArray(item.suggestedQuestions) ? item.suggestedQuestions.map((question) => question.trim()) : [],
  };
}

function validateDocuments(values: unknown[], strictCapacity = true) {
  const documents: ImportedKnowledgeDocument[] = [];
  let invalid = 0;
  for (const value of values) {
    const document = sanitizeImportedKnowledgeDocument(value);
    if (document) documents.push(document);
    else invalid += 1;
  }
  if (strictCapacity && documents.length > agentRequestLimits.userDocuments) return { documents: [], invalid: invalid + documents.length, error: `用户文档最多保存 ${agentRequestLimits.userDocuments} 篇。` };
  return { documents, invalid };
}

function createEnvelope(documents: ImportedKnowledgeDocument[]): KnowledgeStorageEnvelope {
  return { version: 2, documents, updatedAt: new Date().toISOString() };
}

function parseStoredEnvelope(raw: string) {
  const parsed = JSON.parse(raw) as unknown;
  const legacyDocuments = Array.isArray(parsed) ? parsed : parsed && typeof parsed === "object" ? (parsed as { documents?: unknown }).documents : undefined;
  if (!Array.isArray(legacyDocuments)) throw new Error("知识库数据格式不正确。");
  const version = Array.isArray(parsed) ? undefined : (parsed as { version?: unknown }).version;
  if (version !== undefined && version !== 1 && version !== knowledgeStorageLimits.schemaVersion) throw new Error("知识库版本不受支持。");
  const validated = validateDocuments(legacyDocuments);
  if (validated.error) throw new Error(validated.error);
  const updatedAt = !Array.isArray(parsed) && parsed && typeof parsed === "object" ? dateOrFallback((parsed as { updatedAt?: unknown }).updatedAt, new Date().toISOString()) : new Date().toISOString();
  return { envelope: { version: 2 as const, documents: validated.documents, updatedAt }, migrated: version !== knowledgeStorageLimits.schemaVersion, invalid: validated.invalid };
}

function writeEnvelope(envelope: KnowledgeStorageEnvelope): StorageResult<ImportedKnowledgeDocument[]> {
  if (!canUseStorage()) return { ok: false, data: envelope.documents, error: "当前浏览器不支持 localStorage，文档无法持久化。" };
  try {
    window.localStorage.setItem(USER_KNOWLEDGE_STORAGE_KEY, JSON.stringify(envelope));
    return { ok: true, data: envelope.documents };
  } catch {
    return { ok: false, data: envelope.documents, error: "用户知识库保存失败，请检查浏览器存储空间。" };
  }
}

export function readUserKnowledgeDocuments() {
  return readUserKnowledgeDocumentsWithStatus().data;
}

export function readUserKnowledgeDocumentsWithStatus(): StorageResult<ImportedKnowledgeDocument[]> {
  if (!canUseStorage()) return { ok: true, data: [] };
  try {
    const raw = window.localStorage.getItem(USER_KNOWLEDGE_STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_USER_KNOWLEDGE_STORAGE_KEY);
    if (!raw) return { ok: true, data: [] };
    const parsed = parseStoredEnvelope(raw);
    if (parsed.migrated) writeEnvelope(parsed.envelope);
    const notice = parsed.invalid ? `已跳过 ${parsed.invalid} 条无效知识文档。` : parsed.migrated ? "已将旧版知识库数据迁移到 V2 存储结构。" : undefined;
    return { ok: true, data: parsed.envelope.documents, notice };
  } catch {
    return { ok: false, data: [], error: "知识库本地数据损坏或无法读取，已安全恢复为空状态。" };
  }
}

export function writeUserKnowledgeDocuments(documents: ImportedKnowledgeDocument[]): StorageResult<ImportedKnowledgeDocument[]> {
  const validated = validateDocuments(documents);
  if (validated.error) return { ok: false, data: documents, error: validated.error };
  if (validated.invalid) return { ok: false, data: validated.documents, error: `存在 ${validated.invalid} 条不符合规则的文档，未保存。` };
  return writeEnvelope(createEnvelope(validated.documents));
}

export function updateUserDocumentEnabled(documents: ImportedKnowledgeDocument[], documentId: string, enabled: boolean) {
  const result = writeUserKnowledgeDocuments(documents.map((document) => document.id === documentId ? { ...document, enabled, updatedAt: new Date().toISOString() } : document));
  if (result.ok) invalidateKnowledgeDerived(documentId);
  return result;
}

export function deleteUserKnowledgeDocument(documents: ImportedKnowledgeDocument[], documentId: string) {
  const result = writeUserKnowledgeDocuments(documents.filter((document) => document.id !== documentId));
  if (result.ok) invalidateKnowledgeDerived(documentId);
  return result;
}

export function clearUserKnowledgeDocuments() {
  const result = writeEnvelope(createEnvelope([]));
  if (result.ok) clearKnowledgeDerivedCache();
  return result;
}

function backupDocument(document: ImportedKnowledgeDocument): ImportedKnowledgeDocument {
  return {
    id: document.id, title: document.title, category: document.category, tags: document.tags ?? [], summary: document.summary,
    content: document.content, createdAt: document.createdAt, updatedAt: document.updatedAt, sourceType: document.sourceType,
    originalFileName: document.originalFileName, importedAt: document.importedAt, enabled: document.enabled !== false, isDefault: false,
  };
}

export function createKnowledgeBackup(documents: ImportedKnowledgeDocument[]): KnowledgeBackup {
  return { version: 2, exportedAt: new Date().toISOString(), documents: documents.map(backupDocument) };
}

export function previewKnowledgeBackup(raw: string, existingDocuments: ImportedKnowledgeDocument[], mode: "merge" | "replace" = "merge"): KnowledgeBackupPreview {
  const empty = { incoming: 0, new: 0, duplicate: 0, conflict: 0, invalid: 0 };
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { ok: false, documents: [], counts: empty, errors: ["备份文件不是有效的 JSON 对象。"] };
    const backup = parsed as Partial<KnowledgeBackup>;
    if (backup.version !== knowledgeStorageLimits.backupVersion || !Array.isArray(backup.documents)) return { ok: false, documents: [], counts: empty, errors: ["备份版本不受支持。"] };
    const validated = validateDocuments(backup.documents, false);
    const existingById = new Map(existingDocuments.map((document) => [document.id, document]));
    const existingFingerprints = new Set(existingDocuments.map(getKnowledgeDocumentFingerprint));
    const seen = new Set<string>();
    let duplicate = 0;
    let conflict = 0;
    const documents = validated.documents.filter((document) => {
      if (seen.has(document.id)) { duplicate += 1; return false; }
      seen.add(document.id);
      if (mode === "replace") return true;
      const sameId = existingById.get(document.id);
      if (sameId && getKnowledgeDocumentFingerprint(sameId) !== getKnowledgeDocumentFingerprint(document)) { conflict += 1; return false; }
      if (sameId || existingFingerprints.has(getKnowledgeDocumentFingerprint(document))) { duplicate += 1; return false; }
      return true;
    });
    const errors: string[] = [];
    if (validated.invalid) errors.push(`已识别 ${validated.invalid} 条非法记录。`);
    if ((mode === "merge" ? existingDocuments.length + documents.length : documents.length) > agentRequestLimits.userDocuments) errors.push(`恢复后将超过 ${agentRequestLimits.userDocuments} 篇用户文档上限。`);
    return { ok: errors.length === 0, documents, counts: { incoming: backup.documents.length, new: documents.length, duplicate, conflict, invalid: validated.invalid }, errors };
  } catch {
    return { ok: false, documents: [], counts: empty, errors: ["备份 JSON 无法解析。"] };
  }
}

export function applyKnowledgeBackup(existingDocuments: ImportedKnowledgeDocument[], preview: KnowledgeBackupPreview, mode: "merge" | "replace") {
  if (!preview.ok) return { ok: false as const, data: existingDocuments, error: preview.errors.join(" ") || "备份文件不合法。" };
  return writeUserKnowledgeDocuments(mode === "replace" ? preview.documents : [...preview.documents, ...existingDocuments]);
}

function sanitizeRagHistoryItem(value: unknown): RagTestHistoryItem | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<RagTestHistoryItem>;
  if (item.version !== 1 || typeof item.id !== "string" || typeof item.question !== "string" || !isValidDate(item.testedAt)) return null;
  if (item.confidence !== "high" && item.confidence !== "medium" && item.confidence !== "low") return null;
  if (typeof item.hit !== "boolean" || typeof item.candidateCount !== "number") return null;
  return { version: 1, id: item.id, question: item.question.slice(0, agentRequestLimits.questionChars), documentId: typeof item.documentId === "string" ? item.documentId : undefined, testedAt: item.testedAt as string, hit: item.hit, topSourceId: typeof item.topSourceId === "string" ? item.topSourceId : undefined, confidence: item.confidence, candidateCount: item.candidateCount };
}

export function loadRagTestHistory(): StorageResult<RagTestHistoryItem[]> {
  if (!canUseStorage()) return { ok: true, data: [] };
  try {
    const raw = window.localStorage.getItem(RAG_TEST_HISTORY_STORAGE_KEY);
    if (!raw) return { ok: true, data: [] };
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return { ok: true, data: [] };
    return { ok: true, data: parsed.map(sanitizeRagHistoryItem).filter((item): item is RagTestHistoryItem => Boolean(item)).slice(0, knowledgeStorageLimits.ragTestHistoryLimit) };
  } catch {
    return { ok: false, data: [], error: "RAG 测试历史读取失败，已安全恢复为空状态。" };
  }
}

export function saveRagTestHistoryItem(diagnostic: RagTestDiagnostic): StorageResult<RagTestHistoryItem[]> {
  const current = loadRagTestHistory();
  const item: RagTestHistoryItem = { version: 1, id: `rag-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, question: diagnostic.question.slice(0, agentRequestLimits.questionChars), documentId: diagnostic.currentDocumentId, testedAt: new Date().toISOString(), hit: diagnostic.currentDocumentId ? Boolean(diagnostic.hitCurrentDocument) : diagnostic.reliableSourceCount > 0, topSourceId: diagnostic.sources[0]?.sourceId, confidence: diagnostic.retrievalConfidence, candidateCount: diagnostic.candidateCount };
  const next = [item, ...current.data].slice(0, knowledgeStorageLimits.ragTestHistoryLimit);
  if (!canUseStorage()) return { ok: false, data: next, error: "当前浏览器不支持 localStorage。" };
  try {
    window.localStorage.setItem(RAG_TEST_HISTORY_STORAGE_KEY, JSON.stringify(next));
    return { ok: true, data: next };
  } catch {
    return { ok: false, data: next, error: "RAG 测试历史保存失败。" };
  }
}
