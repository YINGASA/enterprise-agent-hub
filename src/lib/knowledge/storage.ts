import type { ImportedKnowledgeDocument, KnowledgeDocument } from "@/types";

export const USER_KNOWLEDGE_STORAGE_KEY = "enterprise-agent-hub:user-knowledge-documents";
const LEGACY_USER_KNOWLEDGE_STORAGE_KEY = "enterprise-agent-hub-user-documents";

type StorageResult<T> = { ok: true; data: T } | { ok: false; data: T; error: string };

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function sanitizeImportedKnowledgeDocument(value: unknown): ImportedKnowledgeDocument | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<KnowledgeDocument>;
  const sourceType = item.sourceType === "user_upload" || item.sourceType === "user_paste" ? item.sourceType : null;
  if (!sourceType || !item.id || !item.title || !item.content) return null;

  const importedAt = asString(item.importedAt, item.createdAt ?? new Date().toISOString());
  const originalFileName = typeof item.originalFileName === "string" ? item.originalFileName : undefined;

  return {
    id: String(item.id),
    packId: typeof item.packId === "string" ? item.packId : undefined,
    title: String(item.title),
    category: asString(item.category, "用户导入"),
    tags: asStringArray(item.tags),
    summary: asString(item.summary, String(item.content).slice(0, 120)),
    content: String(item.content),
    createdAt: asString(item.createdAt, importedAt),
    updatedAt: asString(item.updatedAt, importedAt.slice(0, 10)),
    source: sourceType === "user_upload" ? "local file" : "pasted text",
    owner: "用户导入",
    isDefault: false,
    sourceType,
    originalFileName,
    importedAt,
    enabled: item.enabled !== false,
  };
}

function parseStoredDocuments(raw: string | null): ImportedKnowledgeDocument[] {
  if (!raw) return [];
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) return [];
  return parsed.map(sanitizeImportedKnowledgeDocument).filter((item): item is ImportedKnowledgeDocument => Boolean(item));
}

export function readUserKnowledgeDocuments(): ImportedKnowledgeDocument[] {
  return readUserKnowledgeDocumentsWithStatus().data;
}

export function readUserKnowledgeDocumentsWithStatus(): StorageResult<ImportedKnowledgeDocument[]> {
  if (!canUseStorage()) return { ok: true, data: [] };

  try {
    const raw = window.localStorage.getItem(USER_KNOWLEDGE_STORAGE_KEY);
    const documents = parseStoredDocuments(raw);
    if (raw) return { ok: true, data: documents };

    const legacyRaw = window.localStorage.getItem(LEGACY_USER_KNOWLEDGE_STORAGE_KEY);
    const legacyDocuments = parseStoredDocuments(legacyRaw);
    if (legacyDocuments.length) {
      window.localStorage.setItem(USER_KNOWLEDGE_STORAGE_KEY, JSON.stringify(legacyDocuments));
      return { ok: true, data: legacyDocuments };
    }

    return { ok: true, data: [] };
  } catch (error) {
    return {
      ok: false,
      data: [],
      error: error instanceof Error ? error.message : "用户知识库 localStorage 读取失败。",
    };
  }
}

export function writeUserKnowledgeDocuments(documents: ImportedKnowledgeDocument[]): StorageResult<ImportedKnowledgeDocument[]> {
  if (!canUseStorage()) return { ok: false, data: documents, error: "当前浏览器不支持 localStorage，文档只能保留在本次页面状态中。" };

  try {
    const sanitized = documents.map(sanitizeImportedKnowledgeDocument).filter((item): item is ImportedKnowledgeDocument => Boolean(item));
    window.localStorage.setItem(USER_KNOWLEDGE_STORAGE_KEY, JSON.stringify(sanitized));
    return { ok: true, data: sanitized };
  } catch (error) {
    return {
      ok: false,
      data: documents,
      error: error instanceof Error ? error.message : "用户知识库 localStorage 保存失败。",
    };
  }
}

export function clearUserKnowledgeDocuments(): StorageResult<ImportedKnowledgeDocument[]> {
  if (!canUseStorage()) return { ok: false, data: [], error: "当前浏览器不支持 localStorage。" };

  try {
    window.localStorage.removeItem(USER_KNOWLEDGE_STORAGE_KEY);
    return { ok: true, data: [] };
  } catch (error) {
    return {
      ok: false,
      data: [],
      error: error instanceof Error ? error.message : "用户知识库 localStorage 清空失败。",
    };
  }
}

