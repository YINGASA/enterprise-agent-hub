import { describe, expect, it, vi } from "vitest";
import { ServerKnowledgeImportRepository } from "@/lib/storage/knowledgeImportRepository";
import type { KnowledgeImportJob } from "@/types";

const at = "2026-07-17T00:00:00.000Z";

function job(overrides: Partial<KnowledgeImportJob> = {}): KnowledgeImportJob {
  return {
    id: "job-1", status: "preview_ready", totalItems: 1, completedItems: 0, failedItems: 0,
    skippedItems: 0, conflictedItems: 0, revision: 1, createdAt: at, updatedAt: at,
    items: [{
      id: "item-1", importJobId: "job-1", itemIndex: 0, originalFileName: "policy.txt", normalizedTitle: "policy",
      mimeType: "text/plain", sizeBytes: 12, status: "preview_ready", duplicateType: "none",
      extractedCharacterCount: 12, estimatedChunkCount: 1, checksumStatus: "computed", qualityLevel: "usable",
      qualityLabel: "可用", warnings: [], metadata: { title: "制度", category: "制度", tags: [], sourceType: "user_upload", enabled: true, suggestedQuestions: [], metadata: {} },
      chunkPreview: [], retryCount: 0, revision: 0, createdAt: at, updatedAt: at,
    }],
    ...overrides,
  };
}

describe("ServerKnowledgeImportRepository", () => {
  it("sends preview files as FormData without a workspace identifier", async () => {
    const request = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => Response.json({ job: job() }));
    const repository = new ServerKnowledgeImportRepository(request as typeof fetch);
    const file = new File(["policy text"], "policy.txt", { type: "text/plain" });

    await repository.preview({ files: [file], knowledgePackId: "pack-1", idempotencyKey: "knowledge-import-batch-1" });

    expect(request).toHaveBeenCalledTimes(1);
    const [url, init] = request.mock.calls[0]!;
    expect(url).toBe("/api/storage/knowledge/import/preview");
    expect(init).toMatchObject({ method: "POST", credentials: "same-origin", cache: "no-store" });
    expect(init?.body).toBeInstanceOf(FormData);
    const form = init?.body as FormData;
    expect(form.getAll("files")).toHaveLength(1);
    expect(form.get("knowledgePackId")).toBe("pack-1");
    expect(form.get("idempotencyKey")).toBe("knowledge-import-batch-1");
    expect(Array.from(form.keys())).not.toContain("workspaceId");
  });

  it("uses the confirm and job action REST contracts", async () => {
    const request = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => Response.json({ job: job({ status: "processing", revision: 2 }) }));
    const repository = new ServerKnowledgeImportRepository(request as typeof fetch);
    const item = job().items[0]!;

    await repository.createJob({
      jobId: "job-1", expectedRevision: 1, knowledgePackId: "pack-1",
      items: [{ itemId: item.id, expectedRevision: item.revision, metadata: item.metadata, conflictResolution: "import_as_new" }],
    });
    await repository.getJob("job-1");
    await repository.processNext("job-1", 2);
    await repository.retryFailed("job-1", 3);
    await repository.cancel("job-1", 4);

    expect(request.mock.calls.map(([url]) => url)).toEqual([
      "/api/storage/knowledge/import/jobs",
      "/api/storage/knowledge/import/jobs/job-1",
      "/api/storage/knowledge/import/jobs/job-1/process",
      "/api/storage/knowledge/import/jobs/job-1/retry",
      "/api/storage/knowledge/import/jobs/job-1/cancel",
    ]);
    expect(JSON.stringify(request.mock.calls)).not.toContain("workspaceId");
  });

  it("lists the bounded workspace recovery feed without sending ownership fields", async () => {
    const request = vi.fn(async () => Response.json({ jobs: [job({ status: "processing" }), job({ id: "job-2", status: "failed" })] }));
    const repository = new ServerKnowledgeImportRepository(request as typeof fetch);

    await expect(repository.listRecoverableJobs()).resolves.toMatchObject([
      { id: "job-1", status: "processing" },
      { id: "job-2", status: "failed" },
    ]);
    expect(request).toHaveBeenCalledWith("/api/storage/knowledge/import/jobs", expect.objectContaining({
      credentials: "same-origin",
      cache: "no-store",
    }));
    expect(JSON.stringify(request.mock.calls)).not.toContain("workspaceId");
  });

  it("rejects an oversized or malformed recovery feed", async () => {
    const oversized = new ServerKnowledgeImportRepository(vi.fn(async () => Response.json({
      jobs: Array.from({ length: 11 }, (_, index) => job({ id: `job-${index}` })),
    })) as typeof fetch);
    await expect(oversized.listRecoverableJobs()).rejects.toMatchObject({ status: 502, code: "invalid_server_response" });

    const malformed = new ServerKnowledgeImportRepository(vi.fn(async () => Response.json({ jobs: [{ id: "bad" }] })) as typeof fetch);
    await expect(malformed.listRecoverableJobs()).rejects.toMatchObject({ status: 502, code: "invalid_server_response" });
  });

  it("maps safe API errors and rejects malformed success responses", async () => {
    const unavailable = new ServerKnowledgeImportRepository(vi.fn(async () => Response.json({ error: "storage_unavailable", errorCode: "knowledge_import_database_unavailable", message: "服务端暂不可用" }, { status: 503 })) as typeof fetch);
    await expect(unavailable.getJob("job-1")).rejects.toMatchObject({ status: 503, code: "knowledge_import_database_unavailable", message: "服务端暂不可用" });

    const malformed = new ServerKnowledgeImportRepository(vi.fn(async () => Response.json({ job: { id: "bad" } })) as typeof fetch);
    await expect(malformed.getJob("job-1")).rejects.toMatchObject({ status: 502, code: "invalid_server_response" });
  });

  it("keeps legacy 404 lookup semantics explicit", async () => {
    const repository = new ServerKnowledgeImportRepository(vi.fn(async () => new Response(null, { status: 404 })) as typeof fetch);
    await expect(repository.getJob("missing")).resolves.toBeNull();
  });
});
