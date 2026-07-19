import { describe, expect, it } from "vitest";
import { ImportItemStatus, ImportJobStatus } from "@prisma/client";
import {
  parseKnowledgeFile,
  withKnowledgeParserDeadline,
} from "@/lib/knowledge/file-parser";
import {
  knowledgeImportLimits,
  validateKnowledgeImportRuntimeLimits,
} from "@/lib/knowledge/import-limits";
import {
  createDocxFixture,
  createPdfFixture,
} from "@/lib/knowledge/__tests__/importFixtures";
import {
  PrismaKnowledgeImportRepository,
  knowledgeImportJobLimits,
} from "@/lib/server-storage/knowledgeImportRepository";

const fixedTime = new Date("2026-07-19T00:00:00.000Z");

function applyData(target: Record<string, unknown>, data: Record<string, unknown>) {
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === "object" && "increment" in value) {
      target[key] = Number(target[key] ?? 0) + Number((value as { increment: number }).increment);
    } else {
      target[key] = value;
    }
  }
}

function createImportPressureHarness(
  workspaceId: string,
  options: { replace?: boolean } = {},
) {
  const item: Record<string, unknown> = {
    workspaceId,
    id: `item-${workspaceId}`,
    importJobId: `job-${workspaceId}`,
    itemIndex: 0,
    originalFileName: "policy.txt",
    normalizedTitle: "policy",
    mimeType: "text/plain",
    sizeBytes: 128,
    checksum: "a".repeat(64),
    status: ImportItemStatus.READY,
    conflictType: options.replace ? "exact_content" : "none",
    conflictDocumentId: options.replace ? `document-${workspaceId}` : null,
    conflictDocumentRevision: options.replace ? 0 : null,
    conflictResolution: options.replace ? "replace" : "import_as_new",
    extractedText: "Enterprise policy requires an approved audit record and forbids deletion before the retention date.",
    previewMetadata: {
      title: "Enterprise policy",
      category: "Governance",
      tags: ["audit"],
      sourceType: "user_upload",
      enabled: true,
      suggestedQuestions: [],
      metadata: {},
      extractedCharacterCount: 96,
      estimatedChunkCount: 1,
      qualityLevel: "usable",
      qualityLabel: "可用",
      warnings: [],
    },
    chunkPreview: [],
    documentId: null,
    errorCode: null,
    errorMessageSafe: null,
    retryCount: 0,
    revision: 1,
    claimToken: null,
    claimedAt: null,
    leaseExpiresAt: null,
    createdAt: fixedTime,
    updatedAt: fixedTime,
  };
  const job: Record<string, unknown> = {
    workspaceId,
    id: `job-${workspaceId}`,
    status: ImportJobStatus.PENDING,
    documentId: null,
    knowledgePackId: null,
    idempotencyKey: `pressure-${workspaceId}`,
    totalItems: 1,
    completedItems: 0,
    failedItems: 0,
    skippedItems: 0,
    conflictedItems: options.replace ? 1 : 0,
    revision: 1,
    completedAt: null,
    durationMs: null,
    errorCode: null,
    createdAt: fixedTime,
    updatedAt: fixedTime,
    items: [item],
  };
  const metrics = {
    createdDocuments: options.replace ? 1 : 0,
    replacementWrites: 0,
    chunkCreates: 0,
    chunkDeletes: 0,
  };
  const existingDocument = options.replace
    ? { id: `document-${workspaceId}`, revision: 0, createdAt: fixedTime }
    : null;

  function sameWorkspace(where: Record<string, unknown> | undefined) {
    const compound = where?.workspaceId_id as { workspaceId?: unknown } | undefined;
    return !compound || compound.workspaceId === workspaceId;
  }

  function statusMatches(expected: unknown) {
    if (typeof expected === "string") return item.status === expected;
    if (expected && typeof expected === "object" && "in" in expected) {
      return (expected as { in: unknown[] }).in.includes(item.status);
    }
    return true;
  }

  const tx: Record<string, any> = {};
  tx.knowledgePack = { findUnique: async () => null };
  tx.knowledgeDocument = {
    count: async () => metrics.createdDocuments,
    findUnique: async ({ where }: { where: Record<string, unknown> }) => (
      sameWorkspace(where) ? existingDocument : null
    ),
    create: async () => {
      metrics.createdDocuments += 1;
      return {};
    },
    updateMany: async ({ where }: { where: Record<string, unknown> }) => {
      if (!existingDocument || where.workspaceId !== workspaceId || where.id !== existingDocument.id || where.revision !== existingDocument.revision) {
        return { count: 0 };
      }
      metrics.replacementWrites += 1;
      existingDocument.revision += 1;
      return { count: 1 };
    },
  };
  tx.knowledgeChunk = {
    deleteMany: async () => {
      metrics.chunkDeletes += 1;
      return { count: 1 };
    },
    createMany: async ({ data }: { data: unknown[] }) => {
      metrics.chunkCreates += data.length;
      return { count: data.length };
    },
  };
  tx.importItem = {
    findFirst: async () => {
      const lease = item.leaseExpiresAt as Date | null;
      return item.status === ImportItemStatus.READY
        || (item.status === ImportItemStatus.PROCESSING && lease && lease.getTime() < Date.now())
        ? item
        : null;
    },
    findUnique: async ({ where }: { where: Record<string, unknown> }) => (
      sameWorkspace(where) ? item : null
    ),
    findMany: async ({ where }: { where?: Record<string, unknown> } = {}) => (
      where?.updatedAt ? [] : [{ status: item.status, conflictType: item.conflictType }]
    ),
    updateMany: async ({ where, data }: { where: Record<string, any>; data: Record<string, unknown> }) => {
      if (where.workspaceId !== workspaceId || (where.id && where.id !== item.id) || !statusMatches(where.status)) return { count: 0 };
      if (where.revision !== undefined && where.revision !== item.revision) return { count: 0 };
      if (where.claimToken !== undefined && where.claimToken !== item.claimToken) return { count: 0 };
      if (where.leaseExpiresAt?.gt && (!(item.leaseExpiresAt instanceof Date) || item.leaseExpiresAt <= where.leaseExpiresAt.gt)) return { count: 0 };
      applyData(item, data);
      return { count: 1 };
    },
    update: async ({ data }: { data: Record<string, unknown> }) => {
      applyData(item, data);
      return item;
    },
  };
  tx.importJob = {
    deleteMany: async () => ({ count: 0 }),
    findUnique: async ({ where }: { where: Record<string, unknown> }) => (
      sameWorkspace(where) ? job : null
    ),
    updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      if (where.workspaceId !== workspaceId || (where.id && where.id !== job.id) || (where.revision !== undefined && where.revision !== job.revision)) {
        return { count: 0 };
      }
      applyData(job, data);
      return { count: 1 };
    },
    update: async ({ data }: { data: Record<string, unknown> }) => {
      applyData(job, data);
      job.items = [item];
      return job;
    },
  };

  let transactionTail = Promise.resolve();
  const prisma = {
    importItem: tx.importItem,
    importJob: tx.importJob,
    $transaction: async <T>(operation: (client: typeof tx) => Promise<T>) => {
      const previous = transactionTail;
      let release!: () => void;
      transactionTail = new Promise<void>((resolve) => { release = resolve; });
      await previous;
      try {
        return await operation(tx);
      } finally {
        release();
      }
    },
  };

  return {
    repository: new PrismaKnowledgeImportRepository(workspaceId, prisma as never),
    jobId: job.id as string,
    metrics,
  };
}

function nearLimitKnowledgeText(seed: number) {
  const text = Array.from({ length: 220 }, (_, index) => (
    `Policy ${seed}-${index}: order ${100_000 + index} must retain its approved audit evidence for seven years. `
    + `Do not delete the record. The compliance owner must verify the decision, date, revision, source and completion status before release. `
    + `If validation fails, keep the item pending and retry only after the documented issue has been resolved.`
  )).join("\n");
  return text.slice(0, knowledgeImportLimits.maximumExtractedCharacters - 1_000);
}

describe("knowledge import bounded pressure", () => {
  it("keeps all production limits positive and closes timeout/lease relationships", () => {
    expect(validateKnowledgeImportRuntimeLimits()).toBe(true);
    expect(knowledgeImportLimits.maximumBatchFiles).toBe(10);
    expect(knowledgeImportLimits.maximumFileBytes).toBeLessThanOrEqual(knowledgeImportLimits.maximumBatchBytes);
    expect(knowledgeImportLimits.maximumConcurrentParsers).toBeLessThanOrEqual(2);
    expect(knowledgeImportLimits.leaseRenewalIntervalMs).toBeLessThan(knowledgeImportLimits.leaseMilliseconds);
    expect(
      knowledgeImportLimits.itemProcessingTimeoutMs + knowledgeImportLimits.transactionMaximumWaitMs,
    ).toBeLessThan(knowledgeImportLimits.leaseMilliseconds);
  });

  it("parses ten near-limit text documents without exceeding text or chunk limits", async () => {
    const inputs = Array.from({ length: knowledgeImportLimits.maximumBatchFiles }, (_, index) => {
      const text = nearLimitKnowledgeText(index);
      return {
        fileName: `pressure-${index}.txt`,
        mimeType: "text/plain",
        buffer: Buffer.from(text, "utf8"),
      };
    });

    const results = await Promise.all(inputs.map((input) => parseKnowledgeFile(input)));

    expect(results).toHaveLength(knowledgeImportLimits.maximumBatchFiles);
    for (const result of results) {
      if (!result.ok) throw new Error(result.error.code);
      expect(result.value.text.length).toBeLessThanOrEqual(knowledgeImportLimits.maximumExtractedCharacters);
      expect(result.value.quality.chunkCount).toBeLessThanOrEqual(knowledgeImportLimits.maximumChunks);
    }
  });

  it("parses a mixed ten-file batch with bounded duration and memory statistics", async () => {
    const repeated = "Enterprise policy keeps approved evidence, revision and completion state. ".repeat(4);
    const inputs = [
      { fileName: "one.txt", mimeType: "text/plain", buffer: Buffer.from(nearLimitKnowledgeText(1), "utf8") },
      { fileName: "two.md", mimeType: "text/markdown", buffer: Buffer.from(`# Policy\n\n${nearLimitKnowledgeText(2)}`, "utf8") },
      { fileName: "three.pdf", mimeType: "application/pdf", buffer: createPdfFixture(repeated) },
      { fileName: "four.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: createDocxFixture(repeated) },
      { fileName: "five.txt", mimeType: "text/plain", buffer: Buffer.from(repeated, "utf8") },
      { fileName: "six.md", mimeType: "text/markdown", buffer: Buffer.from(`# Audit\n\n${repeated}`, "utf8") },
      { fileName: "seven.pdf", mimeType: "application/pdf", buffer: createPdfFixture(`${repeated} seven`) },
      { fileName: "eight.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: createDocxFixture(`${repeated} eight`) },
      { fileName: "nine.txt", mimeType: "text/plain", buffer: Buffer.from(`${repeated} nine`, "utf8") },
      { fileName: "ten.md", mimeType: "text/markdown", buffer: Buffer.from(`# Retention\n\n${repeated}`, "utf8") },
    ];
    const startedAt = performance.now();
    const initialRss = process.memoryUsage().rss;
    let peakRss = initialRss;
    const memorySampler = setInterval(() => {
      peakRss = Math.max(peakRss, process.memoryUsage().rss);
    }, 5);
    let results: Awaited<ReturnType<typeof parseKnowledgeFile>>[];
    try {
      results = await Promise.all(inputs.map((input) => parseKnowledgeFile(input)));
      peakRss = Math.max(peakRss, process.memoryUsage().rss);
    } finally {
      clearInterval(memorySampler);
    }
    const durationMs = performance.now() - startedAt;
    const errorCodes = results.flatMap((result) => result.ok ? [] : [result.error.code]);
    const successCount = results.length - errorCodes.length;
    const peakMemoryIncrease = Math.max(0, peakRss - initialRss);

    expect(inputs).toHaveLength(knowledgeImportLimits.maximumBatchFiles);
    expect(successCount).toBe(knowledgeImportLimits.maximumBatchFiles);
    expect(errorCodes).toEqual([]);
    expect(durationMs).toBeLessThan(30_000);
    expect(Number.isFinite(peakMemoryIncrease)).toBe(true);
    expect(peakMemoryIncrease).toBeLessThan(256 * 1024 * 1024);
  });

  it("prevents duplicate claims in one workspace while independent workspaces progress concurrently", async () => {
    const shared = createImportPressureHarness("workspace-shared");
    const sameWorkspace = await Promise.allSettled([
      shared.repository.processNext(shared.jobId, 1),
      shared.repository.processNext(shared.jobId, 1),
    ]);
    const fulfilledCount = sameWorkspace.filter((result) => result.status === "fulfilled").length;
    const claimErrorCodes = sameWorkspace.flatMap((result) => (
      result.status === "rejected" && result.reason && typeof result.reason === "object" && "code" in result.reason
        ? [String((result.reason as { code: unknown }).code)]
        : []
    ));

    // A racing request may observe the terminal job and return that idempotent
    // result instead of surfacing the transient claim conflict.
    expect(fulfilledCount).toBe(2);
    expect(claimErrorCodes).toEqual([]);
    expect(shared.metrics.createdDocuments).toBe(1);

    const left = createImportPressureHarness("workspace-left");
    const right = createImportPressureHarness("workspace-right");
    const crossWorkspace = await Promise.all([
      left.repository.processNext(left.jobId, 1),
      right.repository.processNext(right.jobId, 1),
    ]);
    expect(crossWorkspace).toHaveLength(2);
    expect(left.metrics.createdDocuments + right.metrics.createdDocuments).toBe(2);
  });

  it("keeps exact-duplicate replace idempotent and prevents cancelled work from writing", async () => {
    const replacement = createImportPressureHarness("workspace-replace", { replace: true });
    const first = await replacement.repository.processNext(replacement.jobId, 1);
    const replay = await replacement.repository.processNext(replacement.jobId, 1);
    const completedCount = [first, replay].filter((job) => job.completedItems === 1).length;

    expect(completedCount).toBe(2);
    expect(first.conflictedItems).toBe(1);
    expect(replacement.metrics.createdDocuments).toBe(1);
    expect(replacement.metrics.replacementWrites).toBe(1);
    expect(replacement.metrics.chunkDeletes).toBe(1);
    expect(replacement.metrics.chunkCreates).toBeGreaterThan(0);

    const cancelled = createImportPressureHarness("workspace-cancelled");
    const cancelledJob = await cancelled.repository.cancel(cancelled.jobId, 1);
    const replayAfterCancel = await cancelled.repository.processNext(cancelled.jobId, 1);
    const cancelledItemCount = [cancelledJob, replayAfterCancel]
      .flatMap((job) => job.items)
      .filter((item) => item.status === "cancelled").length;

    expect(cancelledItemCount).toBe(2);
    expect(cancelled.metrics.createdDocuments).toBe(0);
    expect(cancelled.metrics.chunkCreates).toBe(0);
  });

  it("returns safe deterministic timeout and abort failures", async () => {
    await expect(withKnowledgeParserDeadline(new Promise<never>(() => undefined), undefined, 5))
      .rejects.toMatchObject({ code: "parser_timeout" });

    const controller = new AbortController();
    const pending = withKnowledgeParserDeadline(new Promise<never>(() => undefined), controller.signal, 1_000);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: "parser_cancelled" });
  });
});
