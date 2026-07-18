import { KnowledgeRepositoryError } from "@/lib/storage/knowledgeRepository";
import type { WorkspaceKnowledgePack, WorkspaceKnowledgePackStatus } from "@/types";

export const knowledgePackLimits = {
  idChars: 128,
  nameChars: 160,
  descriptionChars: 1_000,
  requestBodyChars: 8_000,
} as const;

const maximumDatabaseRevision = 2_147_483_646;

export type CreateKnowledgePackInput = {
  name: string;
  description?: string;
};

export type UpdateKnowledgePackInput = {
  expectedRevision: number;
  name?: string;
  description?: string | null;
  status?: WorkspaceKnowledgePackStatus;
};

export type DeleteKnowledgePackInput = {
  expectedRevision: number;
  deleteDocuments?: boolean;
  confirmation?: "DELETE_DOCUMENTS";
};

export type DeleteKnowledgePackResult = {
  detachedDocumentCount: number;
  deletedDocumentCount: number;
};

export interface KnowledgePackRepository {
  list(): Promise<WorkspaceKnowledgePack[]>;
  get(id: string): Promise<WorkspaceKnowledgePack | null>;
  create(input: CreateKnowledgePackInput): Promise<WorkspaceKnowledgePack>;
  update(id: string, input: UpdateKnowledgePackInput): Promise<WorkspaceKnowledgePack>;
  remove(id: string, input: DeleteKnowledgePackInput): Promise<DeleteKnowledgePackResult>;
}

export class KnowledgePackRepositoryError extends KnowledgeRepositoryError {
  constructor(message: string, status: number, code: string) {
    super(message, status, code);
    this.name = "KnowledgePackRepositoryError";
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function allowedKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>) {
  return Object.keys(value).every((key) => allowed.has(key));
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

function safeName(value: unknown): string | null {
  if (typeof value !== "string" || value.length > knowledgePackLimits.nameChars || hasControlCharacters(value)) return null;
  const normalized = value.normalize("NFKC").replace(/\s+/g, " ").trim();
  return normalized && normalized.length <= knowledgePackLimits.nameChars ? normalized : null;
}

function safeDescription(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string" || value.length > knowledgePackLimits.descriptionChars || hasControlCharacters(value)) return undefined;
  const normalized = value.normalize("NFKC").replace(/\s+/g, " ").trim();
  return normalized.length <= knowledgePackLimits.descriptionChars ? normalized || null : undefined;
}

export function normalizeKnowledgePackName(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

export function sanitizeCreateKnowledgePackInput(value: unknown): CreateKnowledgePackInput | null {
  if (!isPlainObject(value) || !allowedKeys(value, new Set(["name", "description"]))) return null;
  const name = safeName(value.name);
  const description = safeDescription(value.description);
  if (!name || (value.description !== undefined && description === undefined)) return null;
  return { name, ...(description ? { description } : {}) };
}

export function sanitizeUpdateKnowledgePackInput(value: unknown): UpdateKnowledgePackInput | null {
  if (!isPlainObject(value) || !allowedKeys(value, new Set(["expectedRevision", "name", "description", "status"]))) return null;
  if (!Number.isSafeInteger(value.expectedRevision) || (value.expectedRevision as number) < 0 || (value.expectedRevision as number) > maximumDatabaseRevision) return null;
  const hasUpdate = value.name !== undefined || value.description !== undefined || value.status !== undefined;
  if (!hasUpdate) return null;
  const name = value.name === undefined ? undefined : safeName(value.name);
  const description = safeDescription(value.description);
  const status = value.status;
  if (value.name !== undefined && !name) return null;
  if (value.description !== undefined && description === undefined) return null;
  if (status !== undefined && status !== "active" && status !== "archived") return null;
  return {
    expectedRevision: value.expectedRevision as number,
    ...(name ? { name } : {}),
    ...(value.description !== undefined ? { description: description ?? null } : {}),
    ...(status ? { status } : {}),
  };
}

export function sanitizeDeleteKnowledgePackInput(value: unknown): DeleteKnowledgePackInput | null {
  if (!isPlainObject(value) || !allowedKeys(value, new Set(["expectedRevision", "deleteDocuments", "confirmation"]))) return null;
  if (!Number.isSafeInteger(value.expectedRevision) || (value.expectedRevision as number) < 0 || (value.expectedRevision as number) > maximumDatabaseRevision) return null;
  if (value.deleteDocuments !== undefined && typeof value.deleteDocuments !== "boolean") return null;
  if (value.confirmation !== undefined && value.confirmation !== "DELETE_DOCUMENTS") return null;
  if (value.deleteDocuments === true && value.confirmation !== "DELETE_DOCUMENTS") return null;
  return {
    expectedRevision: value.expectedRevision as number,
    ...(value.deleteDocuments === true ? { deleteDocuments: true, confirmation: "DELETE_DOCUMENTS" } : {}),
  };
}

type FetchLike = typeof fetch;
const defaultBrowserFetch: FetchLike = (...args) => globalThis.fetch(...args);

async function readServerResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null) as { error?: string; message?: string } | null;
  if (!response.ok) {
    throw new KnowledgePackRepositoryError(body?.message ?? "企业知识包服务暂不可用。", response.status, body?.error ?? "knowledge_pack_error");
  }
  if (!body || typeof body !== "object") {
    throw new KnowledgePackRepositoryError("企业知识包服务返回了无效响应。", 502, "invalid_server_response");
  }
  return body as T;
}

/** Browser adapter for server-only enterprise knowledge packs. */
export class ServerKnowledgePackRepository implements KnowledgePackRepository {
  constructor(private readonly request: FetchLike = defaultBrowserFetch, private readonly baseUrl = "/api/storage/knowledge/packs") {}

  private async fetch(path: string, init?: RequestInit) {
    try {
      return await this.request(path, { credentials: "same-origin", ...init });
    } catch (error) {
      if (error instanceof KnowledgePackRepositoryError) throw error;
      throw new KnowledgePackRepositoryError("企业知识包服务暂不可用。", 503, "server_storage_unavailable");
    }
  }

  async list() {
    const response = await this.fetch(this.baseUrl);
    return (await readServerResponse<{ packs: WorkspaceKnowledgePack[] }>(response)).packs;
  }

  async get(id: string) {
    const response = await this.fetch(`${this.baseUrl}/${encodeURIComponent(id)}`);
    if (response.status === 404) return null;
    return (await readServerResponse<{ pack: WorkspaceKnowledgePack }>(response)).pack;
  }

  async create(input: CreateKnowledgePackInput) {
    const response = await this.fetch(this.baseUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    return (await readServerResponse<{ pack: WorkspaceKnowledgePack }>(response)).pack;
  }

  async update(id: string, input: UpdateKnowledgePackInput) {
    const response = await this.fetch(`${this.baseUrl}/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    return (await readServerResponse<{ pack: WorkspaceKnowledgePack }>(response)).pack;
  }

  async remove(id: string, input: DeleteKnowledgePackInput) {
    const response = await this.fetch(`${this.baseUrl}/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    return (await readServerResponse<{ result: DeleteKnowledgePackResult }>(response)).result;
  }
}
