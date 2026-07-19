import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveRequestWorkspace: vi.fn(),
  repositoryWorkspaces: [] as string[],
  preview: vi.fn(),
  confirmJob: vi.fn(),
  getJob: vi.fn(),
  listRecoverableJobs: vi.fn(),
  processNext: vi.fn(),
  retryFailed: vi.fn(),
  cancel: vi.fn(),
}));

vi.mock("@/lib/server-storage/workspace", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/server-storage/workspace")>(),
  resolveRequestWorkspace: mocks.resolveRequestWorkspace,
}));

vi.mock("@/lib/server-storage/knowledgeImportRepository", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/server-storage/knowledgeImportRepository")>(),
  PrismaKnowledgeImportRepository: class {
    constructor(workspaceId: string) {
      mocks.repositoryWorkspaces.push(workspaceId);
    }
    preview = mocks.preview;
    confirmJob = mocks.confirmJob;
    getJob = mocks.getJob;
    listRecoverableJobs = mocks.listRecoverableJobs;
    processNext = mocks.processNext;
    retryFailed = mocks.retryFailed;
    cancel = mocks.cancel;
  },
}));

import { POST as previewImport } from "@/app/api/storage/knowledge/import/preview/route";
import { GET as listImportJobs, POST as confirmImport } from "@/app/api/storage/knowledge/import/jobs/route";
import { GET as getImportJob } from "@/app/api/storage/knowledge/import/jobs/[id]/route";
import { POST as processImport } from "@/app/api/storage/knowledge/import/jobs/[id]/process/route";
import { POST as retryImport } from "@/app/api/storage/knowledge/import/jobs/[id]/retry/route";
import { POST as cancelImport } from "@/app/api/storage/knowledge/import/jobs/[id]/cancel/route";
import { KnowledgeRepositoryError } from "@/lib/storage/knowledgeRepository";

const now = "2026-07-17T00:00:00.000Z";
const job = {
  id: "job-1",
  status: "preview_ready",
  totalItems: 1,
  completedItems: 0,
  failedItems: 0,
  skippedItems: 0,
  conflictedItems: 0,
  revision: 0,
  createdAt: now,
  updatedAt: now,
  items: [],
};
const context = { params: Promise.resolve({ id: "job-1" }) };

function jsonRequest(path: string, method: string, body: unknown, origin = true) {
  const headers = new Headers({ "content-type": "application/json" });
  if (origin) headers.set("origin", "http://test.local");
  return new Request(`http://test.local${path}`, { method, headers, body: JSON.stringify(body) });
}

function previewRequest(options: {
  origin?: boolean;
  fileName?: string;
  files?: number;
  workspaceId?: string;
  idempotencyKey?: string;
  omitContentLength?: boolean;
} = {}) {
  const form = new FormData();
  for (let index = 0; index < (options.files ?? 1); index += 1) {
    form.append("files", new File([`企业制度 ${index}`], options.fileName ?? `policy-${index}.txt`, { type: "text/plain" }));
  }
  if (options.workspaceId) form.append("workspaceId", options.workspaceId);
  if (options.idempotencyKey) form.append("idempotencyKey", options.idempotencyKey);
  const headers = new Headers();
  if (options.origin !== false) headers.set("origin", "http://test.local");
  if (!options.omitContentLength) headers.set("content-length", "1024");
  return new Request("http://test.local/api/storage/knowledge/import/preview", { method: "POST", headers, body: form });
}

function confirmationBody(extra: Record<string, unknown> = {}) {
  return {
    jobId: "job-1",
    expectedRevision: 0,
    items: [{
      itemId: "item-1",
      expectedRevision: 0,
      conflictResolution: "import_as_new",
      metadata: {
        title: "退款制度",
        category: "售后",
        tags: ["退款"],
        sourceType: "user_upload",
        enabled: true,
        suggestedQuestions: [],
        metadata: {},
      },
    }],
    ...extra,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.repositoryWorkspaces.length = 0;
  mocks.resolveRequestWorkspace.mockResolvedValue({ workspaceId: "ws-1", setCookie: "workspace=signed; HttpOnly" });
  mocks.preview.mockResolvedValue(job);
  mocks.confirmJob.mockResolvedValue({ ...job, status: "pending", revision: 1 });
  mocks.getJob.mockResolvedValue(job);
  mocks.listRecoverableJobs.mockResolvedValue([job]);
  mocks.processNext.mockResolvedValue({ ...job, status: "completed", completedItems: 1, revision: 2 });
  mocks.retryFailed.mockResolvedValue({ ...job, status: "pending", revision: 3 });
  mocks.cancel.mockResolvedValue({ ...job, status: "cancelled", revision: 3 });
});

describe("knowledge import preview route", () => {
  it("accepts a bounded multipart batch and forwards only the resolved workspace", async () => {
    const response = await previewImport(previewRequest({ idempotencyKey: "batch-1" }));
    expect(response.status).toBe(201);
    expect(response.headers.get("set-cookie")).toContain("workspace=signed");
    expect(mocks.repositoryWorkspaces).toEqual(["ws-1"]);
    expect(mocks.preview).toHaveBeenCalledWith(expect.objectContaining({
      idempotencyKey: "batch-1",
      files: [expect.objectContaining({ fileName: "policy-0.txt", mimeType: "text/plain" })],
    }));
    const input = mocks.preview.mock.calls[0]?.[0];
    expect(input).not.toHaveProperty("workspaceId");
    expect(input.files[0].bytes).toBeInstanceOf(Uint8Array);
  });

  it("rejects a preview without the required idempotency key before repository access", async () => {
    const response = await previewImport(previewRequest());
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      errorCode: "invalid_idempotency_key",
    });
    expect(mocks.preview).not.toHaveBeenCalled();
  });

  it("requires same-origin writes and rejects workspace authority, unsafe names and oversized payloads", async () => {
    expect((await previewImport(previewRequest({ origin: false }))).status).toBe(403);
    expect((await previewImport(previewRequest({ workspaceId: "other" }))).status).toBe(400);
    expect((await previewImport(previewRequest({ fileName: "../secret.txt" }))).status).toBe(400);
    expect((await previewImport(previewRequest({ files: 11 }))).status).toBe(400);
    expect((await previewImport(previewRequest({ omitContentLength: true }))).status).toBe(400);

    const oversized = new Request("http://test.local/api/storage/knowledge/import/preview", {
      method: "POST",
      headers: {
        origin: "http://test.local",
        "content-type": "multipart/form-data; boundary=safe-boundary",
        "content-length": String(26 * 1024 * 1024),
      },
      body: "--safe-boundary--\r\n",
    });
    expect((await previewImport(oversized)).status).toBe(413);
    expect(mocks.preview).not.toHaveBeenCalled();
  });

  it("returns 429 for a concurrent preview in the same workspace and always releases the slot", async () => {
    let finishFirst: ((value: typeof job) => void) | undefined;
    mocks.preview.mockImplementationOnce(() => new Promise<typeof job>((resolve) => {
      finishFirst = resolve;
    }));

    const firstResponse = previewImport(previewRequest({ idempotencyKey: "batch-concurrent-1" }));
    await vi.waitFor(() => expect(mocks.preview).toHaveBeenCalledTimes(1));
    const rejected = await previewImport(previewRequest({ idempotencyKey: "batch-concurrent-2" }));
    expect(rejected.status).toBe(429);
    await expect(rejected.json()).resolves.toMatchObject({
      ok: false,
      error: "rate_limited",
      errorCode: "knowledge_import_concurrency_limit",
    });
    expect(mocks.preview).toHaveBeenCalledTimes(1);

    finishFirst?.(job);
    expect((await firstResponse).status).toBe(201);
    mocks.preview.mockResolvedValueOnce(job);
    expect((await previewImport(previewRequest({ idempotencyKey: "batch-after-release" }))).status).toBe(201);
    expect(mocks.preview).toHaveBeenCalledTimes(2);
  });

  it("releases the preview slot when parsing or repository work fails", async () => {
    mocks.preview.mockRejectedValueOnce(new KnowledgeRepositoryError(
      "企业知识导入服务暂不可用，请稍后重试。",
      503,
      "server_storage_unavailable",
    ));
    expect((await previewImport(previewRequest({ idempotencyKey: "batch-failed" }))).status).toBe(503);

    mocks.preview.mockResolvedValueOnce(job);
    expect((await previewImport(previewRequest({ idempotencyKey: "batch-retry-after-failure" }))).status).toBe(201);
    expect(mocks.preview).toHaveBeenCalledTimes(2);
  });
});

describe("knowledge import job routes", () => {
  it("lists only recent recoverable jobs from the cookie workspace", async () => {
    const response = await listImportJobs(new Request("http://test.local/api/storage/knowledge/import/jobs"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, jobs: [job] });
    expect(mocks.repositoryWorkspaces).toEqual(["ws-1"]);
    expect(mocks.listRecoverableJobs).toHaveBeenCalledTimes(1);
    expect(mocks.resolveRequestWorkspace).toHaveBeenCalledWith(expect.any(Request), { createIfMissing: false });

    vi.clearAllMocks();
    mocks.repositoryWorkspaces.length = 0;
    mocks.resolveRequestWorkspace.mockResolvedValueOnce(null);
    const emptyResponse = await listImportJobs(new Request("http://test.local/api/storage/knowledge/import/jobs"));
    expect(emptyResponse.status).toBe(200);
    await expect(emptyResponse.json()).resolves.toMatchObject({ ok: true, jobs: [] });
    expect(mocks.listRecoverableJobs).not.toHaveBeenCalled();
    expect(mocks.repositoryWorkspaces).toEqual([]);
  });

  it("confirms a sanitized preview using job and item revisions", async () => {
    const response = await confirmImport(jsonRequest("/api/storage/knowledge/import/jobs", "POST", confirmationBody()));
    expect(response.status).toBe(200);
    expect(mocks.confirmJob).toHaveBeenCalledWith("job-1", expect.objectContaining({
      expectedRevision: 0,
      items: [expect.objectContaining({ itemId: "item-1", expectedRevision: 0, conflictResolution: "import_as_new" })],
    }));
  });

  it("rejects unknown ownership fields and malformed metadata before repository access", async () => {
    expect((await confirmImport(jsonRequest("/api/storage/knowledge/import/jobs", "POST", confirmationBody({ workspaceId: "other" })))).status).toBe(400);
    expect((await confirmImport(jsonRequest("/api/storage/knowledge/import/jobs", "POST", {
      ...confirmationBody(),
      items: [{
        ...confirmationBody().items[0],
        metadata: { ...confirmationBody().items[0].metadata, constructor: { polluted: true } },
      }],
    }))).status).toBe(400);
    expect(mocks.confirmJob).not.toHaveBeenCalled();
  });

  it("gets only a job from the cookie workspace and returns 404 without a workspace", async () => {
    const response = await getImportJob(new Request("http://test.local/api/storage/knowledge/import/jobs/job-1"), context);
    expect(response.status).toBe(200);
    expect(mocks.repositoryWorkspaces).toEqual(["ws-1"]);
    expect(mocks.getJob).toHaveBeenCalledWith("job-1");
    expect(mocks.resolveRequestWorkspace).toHaveBeenCalledWith(expect.any(Request), { createIfMissing: false });

    mocks.resolveRequestWorkspace.mockResolvedValueOnce(null);
    expect((await getImportJob(new Request("http://test.local/api/storage/knowledge/import/jobs/job-1"), context)).status).toBe(404);
  });

  it("processes, retries and cancels through the same closed CAS action contract", async () => {
    expect((await processImport(jsonRequest("/process", "POST", { expectedRevision: 1 }), context)).status).toBe(200);
    expect((await retryImport(jsonRequest("/retry", "POST", { expectedRevision: 2 }), context)).status).toBe(200);
    expect((await cancelImport(jsonRequest("/cancel", "POST", { expectedRevision: 2 }), context)).status).toBe(200);
    expect(mocks.processNext).toHaveBeenCalledWith("job-1", 1, expect.any(AbortSignal));
    expect(mocks.retryFailed).toHaveBeenCalledWith("job-1", 2, expect.any(AbortSignal));
    expect(mocks.cancel).toHaveBeenCalledWith("job-1", 2, expect.any(AbortSignal));

    expect((await processImport(jsonRequest("/process", "POST", { expectedRevision: 1, workspaceId: "other" }), context)).status).toBe(400);
    expect((await retryImport(jsonRequest("/retry", "POST", { expectedRevision: -1 }), context)).status).toBe(400);
  });

  it("maps CAS conflicts to a safe 409 without exposing database or stack details", async () => {
    mocks.processNext.mockRejectedValueOnce(new KnowledgeRepositoryError(
      "导入任务已发生变化，请刷新后重试。",
      409,
      "knowledge_import_revision_conflict",
    ));
    const response = await processImport(jsonRequest("/process", "POST", { expectedRevision: 1 }), context);
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body).toMatchObject({ ok: false, error: "id_conflict", errorCode: "knowledge_import_revision_conflict" });
    expect(JSON.stringify(body)).not.toMatch(/stack|DATABASE_URL|workspaceId/u);
  });
});
