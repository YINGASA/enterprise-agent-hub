import type { ImportedKnowledgeDocument, KnowledgeDocument } from "@/types";

export const USER_KNOWLEDGE_STORAGE_KEY = "enterprise-agent-hub-user-documents";

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
    packId: item.packId,
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
  };
}

export function readUserKnowledgeDocuments(): ImportedKnowledgeDocument[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(USER_KNOWLEDGE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(sanitizeImportedKnowledgeDocument).filter((item): item is ImportedKnowledgeDocument => Boolean(item));
  } catch {
    return [];
  }
}

export function writeUserKnowledgeDocuments(documents: ImportedKnowledgeDocument[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(USER_KNOWLEDGE_STORAGE_KEY, JSON.stringify(documents));
}
