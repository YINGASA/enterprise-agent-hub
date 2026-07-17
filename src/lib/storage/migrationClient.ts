import { CONVERSATION_STORAGE_KEY, loadConversationStore } from "@/lib/conversation/storage";
import { readUserKnowledgeDocumentsWithStatus } from "@/lib/knowledge/storage";
import type { Conversation, ImportedKnowledgeDocument } from "@/types";

export const STORAGE_MIGRATION_MARKER_KEY = "enterprise-agent-hub:server-storage-migration:v1";

export type StorageMigrationPayload = {
  migrationId: string;
  conversations: Conversation[];
  knowledgeDocuments: ImportedKnowledgeDocument[];
};

export type StorageMigrationCounts = {
  imported: number;
  skipped: number;
  conflicted: number;
  failed: number;
};

export type StorageMigrationResult = StorageMigrationCounts & {
  migrationId: string;
  status: "completed" | "failed" | "conflict";
  idempotent?: boolean;
};

export type StorageMigrationMarker = StorageMigrationCounts & {
  version: 1;
  migrationId: string;
  completedAt: string;
};

type FetchLike = typeof fetch;

export class StorageMigrationClientError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) {
    super(message);
    this.name = "StorageMigrationClientError";
  }
}

function getBrowserLocalStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage ?? null;
  } catch {
    return null;
  }
}

function safeCount(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function sanitizeCounts(value: unknown): StorageMigrationCounts | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  const imported = safeCount(item.imported);
  const skipped = safeCount(item.skipped);
  const conflicted = safeCount(item.conflicted);
  const failed = safeCount(item.failed);
  return imported === null || skipped === null || conflicted === null || failed === null
    ? null
    : { imported, skipped, conflicted, failed };
}

export function sanitizeStorageMigrationResult(value: unknown): StorageMigrationResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  const counts = sanitizeCounts(value);
  if (!counts || typeof item.migrationId !== "string" || !item.migrationId.trim() || item.migrationId.length > 128) return null;
  if (item.status !== "completed" && item.status !== "failed" && item.status !== "conflict") return null;
  if (item.idempotent !== undefined && typeof item.idempotent !== "boolean") return null;
  return {
    ...counts,
    migrationId: item.migrationId,
    status: item.status,
    idempotent: item.idempotent as boolean | undefined,
  };
}

function stableHash(value: string) {
  let left = 0x811c9dc5;
  let right = 0x9e3779b9;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    left = Math.imul(left ^ code, 0x01000193);
    right = Math.imul(right ^ code, 0x85ebca6b);
  }
  return `${(left >>> 0).toString(16).padStart(8, "0")}${(right >>> 0).toString(16).padStart(8, "0")}`;
}

/**
 * Builds an idempotency key from the sanitized local payload. The digest is
 * deterministic and never sent to logs; no message or knowledge body is put
 * into the identifier itself.
 */
export function createStorageMigrationId(conversations: readonly Conversation[], knowledgeDocuments: readonly ImportedKnowledgeDocument[]) {
  return `local-v1-${stableHash(JSON.stringify({ conversations, knowledgeDocuments }))}`;
}

/** Collects only the existing V2.1-compatible browser data; it never deletes it. */
export function collectLocalStorageMigration(): StorageMigrationPayload {
  const storage = getBrowserLocalStorage();
  if (!storage) return { migrationId: createStorageMigrationId([], []), conversations: [], knowledgeDocuments: [] };

  try {
    // Access can be denied even when the localStorage getter exists.
    storage.getItem(CONVERSATION_STORAGE_KEY);
    const loadedConversations = loadConversationStore().data.conversations;
    const onlyGeneratedStarter = loadedConversations.length === 1
      && loadedConversations[0]!.messages.length === 0
      && !loadedConversations[0]!.conversationSummary
      && loadedConversations[0]!.titleSource === "auto";
    const conversations = onlyGeneratedStarter ? [] : loadedConversations;
    const knowledgeDocuments = readUserKnowledgeDocumentsWithStatus().data;
    return {
      migrationId: createStorageMigrationId(conversations, knowledgeDocuments),
      conversations,
      knowledgeDocuments,
    };
  } catch {
    return { migrationId: createStorageMigrationId([], []), conversations: [], knowledgeDocuments: [] };
  }
}

export function hasLocalStorageMigrationData(payload: Pick<StorageMigrationPayload, "conversations" | "knowledgeDocuments">) {
  return payload.conversations.length > 0 || payload.knowledgeDocuments.length > 0;
}

async function postMigration(
  url: "/api/storage/migration/preview" | "/api/storage/migration",
  payload: StorageMigrationPayload,
  confirmed: boolean,
  request: FetchLike,
) {
  let response: Response;
  try {
    response = await request(url, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(confirmed ? { ...payload, confirmed: true } : payload),
    });
  } catch {
    throw new StorageMigrationClientError("服务端存储暂不可用，请稍后重试。", 503, "storage_unavailable");
  }
  const body = await response.json().catch(() => null) as { result?: unknown; error?: unknown; message?: unknown } | null;
  if (!response.ok) {
    const message = typeof body?.message === "string" && body.message.length <= 240 ? body.message : "数据迁移请求失败。";
    const code = typeof body?.error === "string" && body.error.length <= 80 ? body.error : "migration_failed";
    throw new StorageMigrationClientError(message, response.status, code);
  }
  const result = sanitizeStorageMigrationResult(body?.result);
  if (!result || result.migrationId !== payload.migrationId) {
    throw new StorageMigrationClientError("服务端返回了无效的迁移结果。", 502, "invalid_migration_result");
  }
  return result;
}

export function previewLocalStorageMigration(payload: StorageMigrationPayload, request: FetchLike = fetch) {
  return postMigration("/api/storage/migration/preview", payload, false, request);
}

export async function executeLocalStorageMigration(payload: StorageMigrationPayload, confirmed: true, request: FetchLike = fetch) {
  if (confirmed !== true) throw new StorageMigrationClientError("执行迁移前需要明确确认。", 400, "migration_confirmation_required");
  const result = await postMigration("/api/storage/migration", payload, true, request);
  if (isStorageMigrationComplete(result)) writeStorageMigrationMarker(result);
  return result;
}

export function isStorageMigrationComplete(result: StorageMigrationResult) {
  return result.status === "completed" && result.failed === 0 && result.conflicted === 0;
}

export function writeStorageMigrationMarker(result: StorageMigrationResult, completedAt = new Date().toISOString()) {
  if (!isStorageMigrationComplete(result)) return false;
  const storage = getBrowserLocalStorage();
  if (!storage) return false;
  const marker: StorageMigrationMarker = {
    version: 1,
    migrationId: result.migrationId,
    completedAt,
    imported: result.imported,
    skipped: result.skipped,
    conflicted: result.conflicted,
    failed: result.failed,
  };
  try {
    storage.setItem(STORAGE_MIGRATION_MARKER_KEY, JSON.stringify(marker));
    return true;
  } catch {
    // The server transaction has already completed. A missing local marker may
    // offer migration again, but the stable migrationId keeps that retry safe.
    return false;
  }
}

export function readStorageMigrationMarker(): StorageMigrationMarker | null {
  const storage = getBrowserLocalStorage();
  if (!storage) return null;
  try {
    const value = JSON.parse(storage.getItem(STORAGE_MIGRATION_MARKER_KEY) ?? "null") as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const item = value as Record<string, unknown>;
    const counts = sanitizeCounts(value);
    if (!counts || item.version !== 1 || typeof item.migrationId !== "string" || !item.migrationId || item.migrationId.length > 128) return null;
    if (typeof item.completedAt !== "string" || item.completedAt.length > 128 || !Number.isFinite(Date.parse(item.completedAt))) return null;
    return { version: 1, migrationId: item.migrationId, completedAt: item.completedAt, ...counts };
  } catch {
    return null;
  }
}
