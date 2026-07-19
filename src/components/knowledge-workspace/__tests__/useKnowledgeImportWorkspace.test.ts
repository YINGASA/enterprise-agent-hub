import { describe, expect, it, vi } from "vitest";
import {
  buildKnowledgeImportConfirmations,
  continueKnowledgeImportJob,
  createKnowledgeImportIdempotencyKey,
  isTerminalKnowledgeImportJob,
  resolveKnowledgeImportRecovery,
  shouldContinueKnowledgeImportJob,
  validateKnowledgeImportFiles,
} from "@/components/knowledge-workspace/useKnowledgeImportWorkspace";
import type { KnowledgeImportRepository } from "@/lib/storage/knowledgeImportRepository";
import type { KnowledgeImportJob } from "@/types";

function file(name: string, size = 100, type = "text/plain") {
  return { name, size, type } as File;
}

function previewJob(): KnowledgeImportJob {
  const at = "2026-07-17T00:00:00.000Z";
  return {
    id: "job", status: "preview_ready", totalItems: 2, completedItems: 0, failedItems: 0, skippedItems: 0, conflictedItems: 1,
    revision: 1, createdAt: at, updatedAt: at,
    items: ["none", "exact_content"].map((duplicateType, index) => ({
      id: `item-${index}`, importJobId: "job", itemIndex: index, originalFileName: `file-${index}.txt`, normalizedTitle: `file-${index}`,
      mimeType: "text/plain", sizeBytes: 10, status: "preview_ready", duplicateType: duplicateType as "none" | "exact_content",
      extractedCharacterCount: 10, estimatedChunkCount: 1, checksumStatus: "computed", qualityLevel: "usable", qualityLabel: "可用",
      warnings: [], metadata: { title: `文档 ${index}`, category: "制度", tags: [], sourceType: "user_upload", enabled: true, suggestedQuestions: [], metadata: {} },
      chunkPreview: [], retryCount: 0, revision: index, createdAt: at, updatedAt: at,
    })),
  };
}

function repository(overrides: Partial<KnowledgeImportRepository> = {}): KnowledgeImportRepository {
  return {
    preview: vi.fn(),
    createJob: vi.fn(),
    getJob: vi.fn().mockResolvedValue(null),
    listRecoverableJobs: vi.fn().mockResolvedValue([]),
    processNext: vi.fn(),
    retryFailed: vi.fn(),
    cancel: vi.fn(),
    ...overrides,
  } as KnowledgeImportRepository;
}

describe("knowledge import workspace pure rules", () => {
  it("creates one stable, opaque idempotency key for a selected batch", () => {
    expect(createKnowledgeImportIdempotencyKey(() => "11111111-2222-4333-8444-555555555555"))
      .toBe("knowledge-import-11111111-2222-4333-8444-555555555555");
  });

  it("accepts the four enterprise formats within batch limits", () => {
    expect(validateKnowledgeImportFiles([
      file("a.txt"), file("b.md", 100, "text/markdown"), file("c.pdf", 100, "application/pdf"),
      file("d.docx", 100, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    ])).toMatchObject({ ok: true });
  });

  it("rejects empty, excessive, oversized, path-like and MIME-conflicting selections", () => {
    expect(validateKnowledgeImportFiles([])).toMatchObject({ ok: false });
    expect(validateKnowledgeImportFiles(Array.from({ length: 11 }, (_, index) => file(`${index}.txt`)))).toMatchObject({ ok: false });
    expect(validateKnowledgeImportFiles([file("large.txt", 5 * 1024 * 1024 + 1)])).toMatchObject({ ok: false });
    expect(validateKnowledgeImportFiles([file("../secret.txt")])).toMatchObject({ ok: false });
    expect(validateKnowledgeImportFiles([file("fake.pdf", 100, "text/plain")])).toMatchObject({ ok: false });
    expect(validateKnowledgeImportFiles([file("script.exe")])).toMatchObject({ ok: false });
  });

  it("uses import-as-new for clean items and safe skip for unresolved conflicts", () => {
    const confirmations = buildKnowledgeImportConfirmations(previewJob());
    expect(confirmations.map((item) => item.conflictResolution)).toEqual(["import_as_new", "skip"]);
    expect(confirmations[0]).toMatchObject({ itemId: "item-0", expectedRevision: 0 });
  });

  it("recognizes terminal and resumable job states deterministically", () => {
    expect(isTerminalKnowledgeImportJob({ status: "completed" })).toBe(true);
    expect(isTerminalKnowledgeImportJob({ status: "partial_failed" })).toBe(true);
    expect(isTerminalKnowledgeImportJob({ status: "processing" })).toBe(false);
    expect(isTerminalKnowledgeImportJob(null)).toBe(false);
    expect(shouldContinueKnowledgeImportJob({ status: "pending" })).toBe(true);
    expect(shouldContinueKnowledgeImportJob({ status: "processing" })).toBe(true);
    expect(shouldContinueKnowledgeImportJob({ status: "preview_ready" })).toBe(false);
    expect(shouldContinueKnowledgeImportJob({ status: "failed" })).toBe(false);
  });

  it("polls an unexpired durable lease and resumes after another processor disappears", async () => {
    const processing = { ...previewJob(), status: "processing" as const, revision: 2, totalItems: 1 };
    const completed = {
      ...processing,
      status: "completed" as const,
      revision: 3,
      completedItems: 1,
    };
    const processNext = vi.fn()
      .mockResolvedValueOnce(processing)
      .mockResolvedValueOnce(completed);
    const wait = vi.fn(async () => undefined);
    const controller = new AbortController();

    await expect(continueKnowledgeImportJob(
      repository({ processNext }),
      processing,
      controller.signal,
      { now: () => 0, wait },
    )).resolves.toMatchObject({ status: "completed", revision: 3 });

    expect(processNext).toHaveBeenCalledTimes(2);
    expect(processNext).toHaveBeenNthCalledWith(1, "job", 2, controller.signal);
    expect(processNext).toHaveBeenNthCalledWith(2, "job", 2, controller.signal);
    expect(wait).toHaveBeenCalledTimes(1);
  });

  it("stops recovery polling when the active request is aborted", async () => {
    const processing = { ...previewJob(), status: "processing" as const, revision: 2, totalItems: 1 };
    const controller = new AbortController();
    const processNext = vi.fn(async () => {
      controller.abort();
      return processing;
    });
    const wait = vi.fn(async () => undefined);

    await expect(continueKnowledgeImportJob(
      repository({ processNext }),
      processing,
      controller.signal,
      { now: () => 0, wait },
    )).resolves.toBe(processing);

    expect(processNext).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
  });

  it("restores the remembered job without querying the recovery feed", async () => {
    const remembered = previewJob();
    const importRepository = repository({
      getJob: vi.fn().mockResolvedValue(remembered),
      listRecoverableJobs: vi.fn().mockResolvedValue([previewJob()]),
    });

    await expect(resolveKnowledgeImportRecovery(importRepository, "job")).resolves.toBe(remembered);
    expect(importRepository.getJob).toHaveBeenCalledWith("job", undefined);
    expect(importRepository.listRecoverableJobs).not.toHaveBeenCalled();
  });

  it("discovers the latest recoverable workspace job when session state is missing or stale", async () => {
    const latest = { ...previewJob(), id: "job-latest", status: "pending" as const };
    const importRepository = repository({
      getJob: vi.fn().mockResolvedValue(null),
      listRecoverableJobs: vi.fn().mockResolvedValue([latest, { ...previewJob(), id: "job-failed", status: "failed" }]),
    });

    await expect(resolveKnowledgeImportRecovery(importRepository, "missing-job")).resolves.toBe(latest);
    expect(importRepository.listRecoverableJobs).toHaveBeenCalledWith(undefined);
    expect(shouldContinueKnowledgeImportJob(latest)).toBe(true);

    const withoutSession = repository({ listRecoverableJobs: vi.fn().mockResolvedValue([latest]) });
    await expect(resolveKnowledgeImportRecovery(withoutSession, null)).resolves.toBe(latest);
    expect(withoutSession.getJob).not.toHaveBeenCalled();
  });

  it("prefers a newer recoverable task over a remembered completed result", async () => {
    const completed = { ...previewJob(), id: "job-completed", status: "completed" as const };
    const failed = { ...previewJob(), id: "job-failed", status: "failed" as const };
    const importRepository = repository({
      getJob: vi.fn().mockResolvedValue(completed),
      listRecoverableJobs: vi.fn().mockResolvedValue([failed]),
    });

    await expect(resolveKnowledgeImportRecovery(importRepository, completed.id)).resolves.toBe(failed);
    expect(importRepository.listRecoverableJobs).toHaveBeenCalledWith(undefined);
  });

  it("ignores an invalid remembered identifier and keeps terminal recovery semantics", async () => {
    const failed = { ...previewJob(), id: "job-failed", status: "failed" as const };
    const importRepository = repository({ listRecoverableJobs: vi.fn().mockResolvedValue([failed]) });

    await expect(resolveKnowledgeImportRecovery(importRepository, "x".repeat(129))).resolves.toBe(failed);
    expect(importRepository.getJob).not.toHaveBeenCalled();
    expect(isTerminalKnowledgeImportJob(failed)).toBe(true);
    expect(shouldContinueKnowledgeImportJob(failed)).toBe(false);
  });
});
