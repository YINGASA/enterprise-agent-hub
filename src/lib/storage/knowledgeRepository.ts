import { splitDocument } from "@/lib/rag";
import {
  deleteUserKnowledgeDocument,
  readUserKnowledgeDocumentsWithStatus,
  sanitizeImportedKnowledgeDocument,
  updateUserDocumentEnabled,
  writeUserKnowledgeDocuments,
} from "@/lib/knowledge/storage";
import { agentRequestLimits } from "@/lib/ops/securityLimits";
import type { ImportedKnowledgeDocument, KnowledgeChunk } from "@/types";

export type KnowledgeDocumentUpdate = Partial<Pick<
  ImportedKnowledgeDocument,
  "title" | "category" | "tags" | "summary" | "content" | "packId" | "originalFileName" | "enabled" | "suggestedQuestions"
>>;

export interface KnowledgeRepository {
  list(): Promise<ImportedKnowledgeDocument[]>;
  get(id: string): Promise<ImportedKnowledgeDocument | null>;
  create(document: ImportedKnowledgeDocument): Promise<ImportedKnowledgeDocument>;
  update(id: string, update: KnowledgeDocumentUpdate): Promise<ImportedKnowledgeDocument>;
  remove(id: string): Promise<void>;
  listChunks(id: string): Promise<KnowledgeChunk[]>;
  replaceAll(documents: ImportedKnowledgeDocument[]): Promise<ImportedKnowledgeDocument[]>;
}

export class KnowledgeRepositoryError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) {
    super(message);
    this.name = "KnowledgeRepositoryError";
  }
}

function validStringArray(value: unknown, maximumItems: number, maximumChars: number) {
  return Array.isArray(value) && value.length <= maximumItems && value.every((item) => typeof item === "string" && item.trim().length > 0 && item.length <= maximumChars);
}

export function sanitizeKnowledgeDocumentUpdate(value: unknown): KnowledgeDocumentUpdate | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const allowed = new Set(["title", "category", "tags", "summary", "content", "packId", "originalFileName", "enabled", "suggestedQuestions"]);
  if (Object.keys(input).some((key) => !allowed.has(key)) || Object.keys(input).length === 0) return null;
  if (input.title !== undefined && (typeof input.title !== "string" || !input.title.trim() || input.title.length > agentRequestLimits.documentTitleChars)) return null;
  if (input.category !== undefined && (typeof input.category !== "string" || input.category.length > agentRequestLimits.documentCategoryChars)) return null;
  if (input.content !== undefined && (typeof input.content !== "string" || !input.content.trim() || input.content.length > agentRequestLimits.documentContentChars)) return null;
  if (input.summary !== undefined && (typeof input.summary !== "string" || input.summary.length > agentRequestLimits.documentSummaryChars)) return null;
  if (input.packId !== undefined && (typeof input.packId !== "string" || input.packId.length > 80)) return null;
  if (input.originalFileName !== undefined && (typeof input.originalFileName !== "string" || input.originalFileName.length > 240)) return null;
  if (input.enabled !== undefined && typeof input.enabled !== "boolean") return null;
  if (input.tags !== undefined && !validStringArray(input.tags, agentRequestLimits.documentTags, agentRequestLimits.documentTagChars)) return null;
  if (input.suggestedQuestions !== undefined && !validStringArray(input.suggestedQuestions, agentRequestLimits.documentSuggestedQuestions, agentRequestLimits.documentSuggestedQuestionChars)) return null;
  const result: KnowledgeDocumentUpdate = {};
  if (typeof input.title === "string") result.title = input.title.trim();
  if (typeof input.category === "string") result.category = input.category.trim();
  if (Array.isArray(input.tags)) result.tags = input.tags.map((tag) => String(tag).trim());
  if (typeof input.summary === "string") result.summary = input.summary.trim();
  if (typeof input.content === "string") result.content = input.content.trim();
  if (typeof input.packId === "string") result.packId = input.packId.trim();
  if (typeof input.originalFileName === "string") result.originalFileName = input.originalFileName.trim();
  if (typeof input.enabled === "boolean") result.enabled = input.enabled;
  if (Array.isArray(input.suggestedQuestions)) result.suggestedQuestions = input.suggestedQuestions.map((question) => String(question).trim());
  return result;
}

function requireValidDocument(value: unknown) {
  const document = sanitizeImportedKnowledgeDocument(value);
  if (!document) throw new KnowledgeRepositoryError("知识文档不符合存储规则。", 400, "invalid_knowledge_document");
  return document;
}

/** Local compatibility adapter. It preserves the V2.1 localStorage contract. */
export class LocalKnowledgeRepository implements KnowledgeRepository {
  async list() {
    const result = readUserKnowledgeDocumentsWithStatus();
    if (!result.ok) throw new KnowledgeRepositoryError(result.error, 503, "local_storage_unavailable");
    return result.data;
  }

  async get(id: string) {
    return (await this.list()).find((document) => document.id === id) ?? null;
  }

  async create(input: ImportedKnowledgeDocument) {
    const document = requireValidDocument(input);
    const documents = await this.list();
    if (documents.some((item) => item.id === document.id)) {
      throw new KnowledgeRepositoryError("知识文档 ID 已存在。", 409, "knowledge_document_conflict");
    }
    const result = writeUserKnowledgeDocuments([document, ...documents]);
    if (!result.ok) throw new KnowledgeRepositoryError(result.error, 503, "local_storage_unavailable");
    return document;
  }

  async update(id: string, update: KnowledgeDocumentUpdate) {
    const documents = await this.list();
    const current = documents.find((document) => document.id === id);
    if (!current) throw new KnowledgeRepositoryError("知识文档不存在。", 404, "knowledge_document_not_found");
    const safeUpdate = sanitizeKnowledgeDocumentUpdate(update);
    if (!safeUpdate) throw new KnowledgeRepositoryError("知识文档更新不符合规则。", 400, "invalid_knowledge_update");
    const next = requireValidDocument({ ...current, ...safeUpdate, id, updatedAt: new Date().toISOString() });
    const result = safeUpdate.enabled !== undefined && Object.keys(safeUpdate).length === 1
      ? updateUserDocumentEnabled(documents, id, safeUpdate.enabled)
      : writeUserKnowledgeDocuments(documents.map((document) => document.id === id ? next : document));
    if (!result.ok) throw new KnowledgeRepositoryError(result.error, 503, "local_storage_unavailable");
    return next;
  }

  async remove(id: string) {
    const documents = await this.list();
    if (!documents.some((document) => document.id === id)) {
      throw new KnowledgeRepositoryError("知识文档不存在。", 404, "knowledge_document_not_found");
    }
    const result = deleteUserKnowledgeDocument(documents, id);
    if (!result.ok) throw new KnowledgeRepositoryError(result.error, 503, "local_storage_unavailable");
  }

  async listChunks(id: string) {
    const document = await this.get(id);
    if (!document) throw new KnowledgeRepositoryError("知识文档不存在。", 404, "knowledge_document_not_found");
    return splitDocument(document);
  }

  async replaceAll(input: ImportedKnowledgeDocument[]) {
    const documents = input.map(requireValidDocument);
    if (new Set(documents.map((document) => document.id)).size !== documents.length) {
      throw new KnowledgeRepositoryError("知识库备份包含重复文档标识。", 400, "invalid_knowledge_document");
    }
    const result = writeUserKnowledgeDocuments(documents);
    if (!result.ok) throw new KnowledgeRepositoryError(result.error, 503, "local_storage_unavailable");
    return result.data;
  }
}

type FetchLike = typeof fetch;
const defaultBrowserFetch: FetchLike = (...args) => globalThis.fetch(...args);

async function readServerResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null) as { error?: string; message?: string } | null;
  if (!response.ok) {
    throw new KnowledgeRepositoryError(body?.message ?? "服务端知识存储暂不可用。", response.status, body?.error ?? "server_storage_error");
  }
  if (!body || typeof body !== "object") throw new KnowledgeRepositoryError("服务端知识存储返回了无效响应。", 502, "invalid_server_response");
  return body as T;
}

/** Browser adapter for the workspace-scoped REST API. */
export class ServerKnowledgeRepository implements KnowledgeRepository {
  constructor(private readonly request: FetchLike = defaultBrowserFetch, private readonly baseUrl = "/api/storage/knowledge") {}

  private async fetch(path: string, init?: RequestInit) {
    try {
      return await this.request(path, { credentials: "same-origin", ...init });
    } catch (error) {
      if (error instanceof KnowledgeRepositoryError) throw error;
      throw new KnowledgeRepositoryError("服务端知识存储暂不可用。", 503, "server_storage_unavailable");
    }
  }

  async list() {
    const response = await this.fetch(this.baseUrl);
    return (await readServerResponse<{ documents: ImportedKnowledgeDocument[] }>(response)).documents;
  }

  async get(id: string) {
    const response = await this.fetch(`${this.baseUrl}/${encodeURIComponent(id)}`);
    if (response.status === 404) return null;
    return (await readServerResponse<{ document: ImportedKnowledgeDocument }>(response)).document;
  }

  async create(document: ImportedKnowledgeDocument) {
    const response = await this.fetch(this.baseUrl, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ document }),
    });
    return (await readServerResponse<{ document: ImportedKnowledgeDocument }>(response)).document;
  }

  async update(id: string, update: KnowledgeDocumentUpdate) {
    const response = await this.fetch(`${this.baseUrl}/${encodeURIComponent(id)}`, {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ update }),
    });
    return (await readServerResponse<{ document: ImportedKnowledgeDocument }>(response)).document;
  }

  async remove(id: string) {
    const response = await this.fetch(`${this.baseUrl}/${encodeURIComponent(id)}`, { method: "DELETE" });
    await readServerResponse<{ ok: true }>(response);
  }

  async listChunks(id: string) {
    const response = await this.fetch(`${this.baseUrl}/${encodeURIComponent(id)}/chunks`);
    return (await readServerResponse<{ chunks: KnowledgeChunk[] }>(response)).chunks;
  }

  async replaceAll(documents: ImportedKnowledgeDocument[]) {
    const response = await this.fetch(`${this.baseUrl}/restore`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ documents }),
    });
    return (await readServerResponse<{ documents: ImportedKnowledgeDocument[] }>(response)).documents;
  }
}
