import type {
  KnowledgeImportJob,
  KnowledgeImportJobItemConfirmation,
} from "@/types";
import { knowledgeImportLimits } from "@/lib/knowledge/import-limits";

export type PreviewKnowledgeImportInput = {
  files: readonly File[];
  knowledgePackId?: string;
  idempotencyKey: string;
  signal?: AbortSignal;
};

export type CreateKnowledgeImportJobInput = {
  jobId: string;
  expectedRevision: number;
  knowledgePackId?: string;
  items: KnowledgeImportJobItemConfirmation[];
  signal?: AbortSignal;
};

export interface KnowledgeImportRepository {
  preview(input: PreviewKnowledgeImportInput): Promise<KnowledgeImportJob>;
  createJob(input: CreateKnowledgeImportJobInput): Promise<KnowledgeImportJob>;
  getJob(id: string, signal?: AbortSignal): Promise<KnowledgeImportJob | null>;
  listRecoverableJobs(signal?: AbortSignal): Promise<KnowledgeImportJob[]>;
  processNext(id: string, expectedRevision: number, signal?: AbortSignal): Promise<KnowledgeImportJob>;
  retryFailed(id: string, expectedRevision: number, signal?: AbortSignal): Promise<KnowledgeImportJob>;
  cancel(id: string, expectedRevision: number, signal?: AbortSignal): Promise<KnowledgeImportJob>;
}

export class KnowledgeImportRepositoryError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) {
    super(message);
    this.name = "KnowledgeImportRepositoryError";
  }
}

type FetchLike = typeof fetch;
const defaultBrowserFetch: FetchLike = (...args) => globalThis.fetch(...args);

function isJob(value: unknown): value is KnowledgeImportJob {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const job = value as Partial<KnowledgeImportJob>;
  return typeof job.id === "string"
    && job.id.length > 0
    && typeof job.status === "string"
    && Number.isInteger(job.revision)
    && Number.isInteger(job.totalItems)
    && Number.isInteger(job.completedItems)
    && Number.isInteger(job.failedItems)
    && Number.isInteger(job.skippedItems)
    && Number.isInteger(job.conflictedItems)
    && Array.isArray(job.items);
}

async function readJobResponse(response: Response): Promise<KnowledgeImportJob> {
  const body = await response.json().catch(() => null) as { error?: string; errorCode?: string; message?: string; job?: unknown } | null;
  if (!response.ok) {
    throw new KnowledgeImportRepositoryError(
      body?.message ?? "企业知识导入服务暂不可用。",
      response.status,
      body?.errorCode ?? body?.error ?? "knowledge_import_error",
    );
  }
  if (!isJob(body?.job)) {
    throw new KnowledgeImportRepositoryError("企业知识导入服务返回了无效响应。", 502, "invalid_server_response");
  }
  return body.job;
}

async function readJobsResponse(response: Response): Promise<KnowledgeImportJob[]> {
  const body = await response.json().catch(() => null) as {
    error?: string;
    errorCode?: string;
    message?: string;
    jobs?: unknown;
  } | null;
  if (!response.ok) {
    throw new KnowledgeImportRepositoryError(
      body?.message ?? "企业知识导入服务暂不可用。",
      response.status,
      body?.errorCode ?? body?.error ?? "knowledge_import_error",
    );
  }
  if (!Array.isArray(body?.jobs)
    || body.jobs.length > knowledgeImportLimits.maximumRecoverableJobs
    || body.jobs.some((job) => !isJob(job))) {
    throw new KnowledgeImportRepositoryError("企业知识导入服务返回了无效响应。", 502, "invalid_server_response");
  }
  return body.jobs as KnowledgeImportJob[];
}

/** Browser adapter for the workspace-scoped, server-only import workflow. */
export class ServerKnowledgeImportRepository implements KnowledgeImportRepository {
  constructor(
    private readonly request: FetchLike = defaultBrowserFetch,
    private readonly baseUrl = "/api/storage/knowledge/import",
  ) {}

  private async fetch(path: string, init?: RequestInit) {
    try {
      return await this.request(path, { credentials: "same-origin", cache: "no-store", ...init });
    } catch (error) {
      if (error instanceof KnowledgeImportRepositoryError) throw error;
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      throw new KnowledgeImportRepositoryError("企业知识导入服务暂不可用。", 503, "server_storage_unavailable");
    }
  }

  async preview({ files, knowledgePackId, idempotencyKey, signal }: PreviewKnowledgeImportInput) {
    const form = new FormData();
    files.forEach((file) => form.append("files", file, file.name));
    if (knowledgePackId) form.set("knowledgePackId", knowledgePackId);
    if (idempotencyKey) form.set("idempotencyKey", idempotencyKey);
    const response = await this.fetch(`${this.baseUrl}/preview`, { method: "POST", body: form, signal });
    return readJobResponse(response);
  }

  async createJob({ jobId, expectedRevision, knowledgePackId, items, signal }: CreateKnowledgeImportJobInput) {
    const response = await this.fetch(`${this.baseUrl}/jobs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jobId, expectedRevision, ...(knowledgePackId ? { knowledgePackId } : {}), items }),
      signal,
    });
    return readJobResponse(response);
  }

  async getJob(id: string, signal?: AbortSignal) {
    const response = await this.fetch(`${this.baseUrl}/jobs/${encodeURIComponent(id)}`, { signal });
    if (response.status === 404) return null;
    return readJobResponse(response);
  }

  async listRecoverableJobs(signal?: AbortSignal) {
    const response = await this.fetch(`${this.baseUrl}/jobs`, { signal });
    return readJobsResponse(response);
  }

  private async runAction(id: string, action: "process" | "retry" | "cancel", expectedRevision: number, signal?: AbortSignal) {
    const response = await this.fetch(`${this.baseUrl}/jobs/${encodeURIComponent(id)}/${action}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ expectedRevision }),
      signal,
    });
    return readJobResponse(response);
  }

  processNext(id: string, expectedRevision: number, signal?: AbortSignal) {
    return this.runAction(id, "process", expectedRevision, signal);
  }

  retryFailed(id: string, expectedRevision: number, signal?: AbortSignal) {
    return this.runAction(id, "retry", expectedRevision, signal);
  }

  cancel(id: string, expectedRevision: number, signal?: AbortSignal) {
    return this.runAction(id, "cancel", expectedRevision, signal);
  }
}
