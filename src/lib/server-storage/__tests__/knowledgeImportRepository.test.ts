import { beforeEach, describe, expect, it, vi } from "vitest";
import { ImportItemStatus, ImportJobStatus, KnowledgePackStatus, Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  parseKnowledgeFile: vi.fn(),
}));

vi.mock("@/lib/knowledge/file-parser", () => ({
  parseKnowledgeFile: mocks.parseKnowledgeFile,
}));

import {
  knowledgeImportJobLimits,
  PrismaKnowledgeImportRepository,
  sanitizeExpectedRevision,
  sanitizeImportPreviewMetadata,
  sanitizeJobConfirmation,
} from "@/lib/server-storage/knowledgeImportRepository";
import { createKnowledgeContentChecksum } from "@/lib/server-storage/knowledgeRepository";
import { knowledgeImportLimits } from "@/lib/knowledge/import-limits";
import { agentRequestLimits } from "@/lib/ops/securityLimits";

const now = new Date("2026-07-17T00:00:00.000Z");

function previewMetadata(title = "退款制度") {
  return {
    title,
    category: "售后制度",
    tags: ["退款"],
    sourceType: "user_upload" as const,
    enabled: true,
    suggestedQuestions: ["如何申请退款？"],
    metadata: { department: "客服" },
    extractedCharacterCount: 32,
    estimatedChunkCount: 1,
    qualityLevel: "usable",
    qualityLabel: "可用",
    warnings: [],
  };
}

function itemRecord(overrides: Record<string, unknown> = {}) {
  return {
    workspaceId: "ws-1",
    id: "item-1",
    importJobId: "job-1",
    itemIndex: 0,
    originalFileName: "refund.txt",
    normalizedTitle: "退款制度",
    mimeType: "text/plain",
    sizeBytes: 32,
    checksum: "a".repeat(64),
    status: ImportItemStatus.PREVIEW_READY,
    conflictType: "none",
    conflictDocumentId: null,
    conflictDocumentRevision: null,
    conflictResolution: null,
    extractedText: "订单签收后七天内可以申请退款。",
    previewMetadata: previewMetadata(),
    chunkPreview: [],
    documentId: null,
    errorCode: null,
    errorMessageSafe: null,
    retryCount: 0,
    revision: 0,
    claimToken: null,
    claimedAt: null,
    leaseExpiresAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function jobRecord(overrides: Record<string, unknown> = {}) {
  return {
    workspaceId: "ws-1",
    id: "job-1",
    status: ImportJobStatus.PREVIEW_READY,
    documentId: null,
    knowledgePackId: null,
    idempotencyKey: null,
    totalItems: 1,
    completedItems: 0,
    failedItems: 0,
    skippedItems: 0,
    conflictedItems: 0,
    revision: 0,
    completedAt: null,
    durationMs: null,
    errorCode: null,
    createdAt: now,
    updatedAt: now,
    items: [itemRecord()],
    ...overrides,
  };
}

function successfulParse(text: string, title: string) {
  return {
    ok: true as const,
    value: {
      text,
      title,
      mimeType: "text/plain",
      fileKind: "txt" as const,
      warnings: [],
      quality: {
        canImport: true,
        qualityLevel: "usable" as const,
        label: "可用" as const,
        score: 80,
        characterCount: text.length,
        approximateTokens: 20,
        chunkCount: 1,
        chunkPreview: [{
          chunkIndex: 1,
          characterCount: text.length,
          approximateTokens: 20,
          keywords: ["退款"],
          contentPreview: text,
          tooShort: false,
          tooLong: false,
          duplicate: false,
          lowInformation: false,
        }],
        chunkPreviewTruncated: false,
        warnings: [],
      },
    },
  };
}

function uploaded(fileName: string, text: string) {
  const bytes = new TextEncoder().encode(text);
  return { fileName, mimeType: "text/plain", sizeBytes: bytes.byteLength, bytes };
}

function applyScalarOrIncrement(target: Record<string, unknown>, data: Record<string, unknown>) {
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === "object" && "increment" in value) {
      target[key] = Number(target[key] ?? 0) + Number((value as { increment: number }).increment);
    } else if (value && typeof value === "object" && "decrement" in value) {
      target[key] = Number(target[key] ?? 0) - Number((value as { decrement: number }).decrement);
    } else {
      target[key] = value;
    }
  }
}

let cleanupExpiredTemporaryContentSpy: { mockRestore: () => void };

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  cleanupExpiredTemporaryContentSpy = vi.spyOn(
    PrismaKnowledgeImportRepository.prototype,
    "cleanupExpiredTemporaryContent",
  ).mockResolvedValue({ deletedPreviewJobs: 0, expiredItems: 0, clearedTerminalItems: 0 });
});

describe("knowledge import request sanitizers", () => {
  it("accepts only safe metadata and rejects ownership or prototype-pollution fields", () => {
    expect(sanitizeImportPreviewMetadata({
      title: "退款制度",
      category: "售后",
      tags: ["退款"],
      sourceType: "user_upload",
      enabled: true,
      suggestedQuestions: [],
      metadata: { department: "客服" },
    })).toMatchObject({ title: "退款制度", sourceType: "user_upload" });
    expect(sanitizeImportPreviewMetadata({
      title: "退款制度",
      category: "售后",
      tags: [],
      sourceType: "user_upload",
      enabled: true,
      suggestedQuestions: [],
      metadata: {},
      workspaceId: "other",
    })).toBeNull();
    expect(sanitizeImportPreviewMetadata(JSON.parse('{"title":"退款制度","category":"售后","tags":[],"sourceType":"user_upload","enabled":true,"suggestedQuestions":[],"metadata":{"__proto__":{"polluted":true}}}'))).toBeNull();
  });

  it("requires a closed CAS confirmation and finite non-negative revisions", () => {
    const metadata = {
      title: "退款制度", category: "售后", tags: [], sourceType: "user_upload", enabled: true,
      suggestedQuestions: [], metadata: {},
    };
    expect(sanitizeJobConfirmation({
      expectedRevision: 0,
      items: [{ itemId: "item-1", expectedRevision: 0, metadata, conflictResolution: "skip" }],
    })).toMatchObject({ expectedRevision: 0, items: [{ itemId: "item-1", conflictResolution: "skip" }] });
    expect(sanitizeJobConfirmation({
      expectedRevision: 0,
      knowledgePackId: "batch-pack",
      items: [{ itemId: "item-1", expectedRevision: 0, metadata: { ...metadata, knowledgePackId: null }, conflictResolution: "skip" }],
    })).toMatchObject({ items: [{ metadata: { knowledgePackId: null } }] });
    expect(sanitizeJobConfirmation({ expectedRevision: 0, items: [], workspaceId: "other" })).toBeNull();
    expect(sanitizeExpectedRevision({ expectedRevision: 1 })).toBe(1);
    expect(sanitizeExpectedRevision({ expectedRevision: Number.POSITIVE_INFINITY })).toBeNull();
    expect(sanitizeExpectedRevision({ expectedRevision: -1 })).toBeNull();
    expect(sanitizeExpectedRevision({ expectedRevision: 1, workspaceId: "other" })).toBeNull();
  });
});

describe("PrismaKnowledgeImportRepository temporary content retention", () => {
  it("expires actionable text, clears terminal text and recomputes job totals without touching formal knowledge", async () => {
    cleanupExpiredTemporaryContentSpy.mockRestore();
    const cleanupNow = new Date("2026-07-19T00:00:00.000Z");
    const staleUpdatedAt = new Date(cleanupNow.getTime() - knowledgeImportJobLimits.temporaryExtractedTextRetentionMilliseconds - 1);
    const items = [
      itemRecord({ id: "item-ready", status: ImportItemStatus.READY, updatedAt: staleUpdatedAt }),
      itemRecord({
        id: "item-processing",
        itemIndex: 1,
        status: ImportItemStatus.PROCESSING,
        claimToken: "expired-claim",
        claimedAt: staleUpdatedAt,
        leaseExpiresAt: new Date(cleanupNow.getTime() - 1_000),
        updatedAt: staleUpdatedAt,
      }),
      itemRecord({ id: "item-failed", itemIndex: 2, status: ImportItemStatus.FAILED, errorCode: "knowledge_import_item_failed", updatedAt: staleUpdatedAt }),
      itemRecord({ id: "item-completed", itemIndex: 3, status: ImportItemStatus.COMPLETED, documentId: "doc-existing", updatedAt: staleUpdatedAt }),
    ];
    const job = jobRecord({
      status: ImportJobStatus.PROCESSING,
      totalItems: items.length,
      revision: 4,
      items,
    });
    const formalDocument = { id: "doc-existing", content: "正式知识正文" };
    const formalChunk = { id: "chunk-existing", documentId: formalDocument.id, content: "正式知识分块" };
    const updateItems = vi.fn(async ({ where, data }: { where: Record<string, any>; data: Record<string, unknown> }) => {
      const ids = new Set<string>(where.id?.in ?? []);
      let count = 0;
      for (const item of items) {
        if (!ids.has(item.id) || item.extractedText === null || item.updatedAt >= where.updatedAt.lt) continue;
        if (where.status?.in && !where.status.in.includes(item.status)) continue;
        applyScalarOrIncrement(item, data);
        count += 1;
      }
      return { count };
    });
    const tx = {
      importJob: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        findUnique: vi.fn().mockResolvedValue(job),
        update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          applyScalarOrIncrement(job, data);
          job.items = items;
          return job;
        }),
      },
      importItem: {
        findMany: vi.fn(async ({ select }: { select: Record<string, boolean> }) => (
          select.id
            ? items.map(({ id, importJobId, status }) => ({ id, importJobId, status }))
            : items.map(({ status, conflictType }) => ({ status, conflictType }))
        )),
        updateMany: updateItems,
      },
      knowledgeDocument: { deleteMany: vi.fn(), updateMany: vi.fn() },
      knowledgeChunk: { deleteMany: vi.fn(), updateMany: vi.fn() },
    };
    const prisma = { $transaction: vi.fn((operation: (client: typeof tx) => unknown) => operation(tx)) };

    const result = await new PrismaKnowledgeImportRepository("ws-1", prisma as never)
      .cleanupExpiredTemporaryContent(cleanupNow);

    expect(result).toEqual({ deletedPreviewJobs: 0, expiredItems: 3, clearedTerminalItems: 1 });
    expect(items.slice(0, 3)).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: ImportItemStatus.FAILED, extractedText: null, errorCode: "knowledge_import_temporary_content_expired" }),
    ]));
    expect(items[1]).toMatchObject({ claimToken: null, claimedAt: null, leaseExpiresAt: null });
    expect(items[3]).toMatchObject({ status: ImportItemStatus.COMPLETED, extractedText: null, documentId: "doc-existing", errorCode: null });
    expect(job).toMatchObject({ status: ImportJobStatus.PARTIAL_FAILED, completedItems: 1, failedItems: 3, revision: 5 });
    expect(formalDocument).toEqual({ id: "doc-existing", content: "正式知识正文" });
    expect(formalChunk).toEqual({ id: "chunk-existing", documentId: "doc-existing", content: "正式知识分块" });
    expect(tx.knowledgeDocument.deleteMany).not.toHaveBeenCalled();
    expect(tx.knowledgeChunk.deleteMany).not.toHaveBeenCalled();
    expect(JSON.stringify(items)).not.toContain("订单签收后七天内可以申请退款");
  });
});

describe("PrismaKnowledgeImportRepository preview and confirmation", () => {
  it("lists a bounded, newest-first recovery feed scoped to one workspace", async () => {
    const records = [
      jobRecord({ id: "job-new", status: ImportJobStatus.PROCESSING, updatedAt: new Date("2026-07-17T02:00:00.000Z") }),
      jobRecord({ id: "job-old", status: ImportJobStatus.FAILED, updatedAt: new Date("2026-07-17T01:00:00.000Z") }),
    ];
    const findMany = vi.fn().mockResolvedValue(records);
    const repository = new PrismaKnowledgeImportRepository("ws-1", { importJob: { findMany } } as never);

    await expect(repository.listRecoverableJobs()).resolves.toMatchObject([
      { id: "job-new", status: "processing" },
      { id: "job-old", status: "failed" },
    ]);
    expect(findMany).toHaveBeenCalledWith({
      where: {
        workspaceId: "ws-1",
        status: { in: [
          ImportJobStatus.PREVIEW_READY,
          ImportJobStatus.PENDING,
          ImportJobStatus.RUNNING,
          ImportJobStatus.PROCESSING,
          ImportJobStatus.PARTIAL_FAILED,
          ImportJobStatus.FAILED,
        ] },
      },
      include: { items: { orderBy: { itemIndex: "asc" } } },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: knowledgeImportLimits.maximumRecoverableJobs,
    });
  });

  it("rejects a new preview for an archived workspace pack before parsing files", async () => {
    const prisma = {
      knowledgePack: { findUnique: vi.fn().mockResolvedValue({ status: KnowledgePackStatus.ARCHIVED }) },
      importJob: {
        findUnique: vi.fn().mockResolvedValue(null),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        count: vi.fn().mockResolvedValue(0),
      },
      importItem: { count: vi.fn().mockResolvedValue(0) },
    };

    await expect(new PrismaKnowledgeImportRepository("ws-1", prisma as never).preview({
      files: [uploaded("policy.txt", "归档知识包不能继续接收新文档。")],
      knowledgePackId: "pack-archived",
      idempotencyKey: "archived-pack-preview",
    })).rejects.toMatchObject({ status: 409, code: "knowledge_pack_archived" });

    expect(prisma.knowledgePack.findUnique).toHaveBeenCalledWith({
      where: { workspaceId_id: { workspaceId: "ws-1", id: "pack-archived" } },
    });
    expect(mocks.parseKnowledgeFile).not.toHaveBeenCalled();
  });

  it("persists only preview items, reports exact/title duplicates and does not write formal documents", async () => {
    const exactText = "订单签收后七天内可以申请退款。";
    const otherText = "退换货运费由责任方承担。";
    mocks.parseKnowledgeFile
      .mockResolvedValueOnce(successfulParse(exactText, "退款制度"))
      .mockResolvedValueOnce(successfulParse(otherText, "运费制度"));
    const createFormalDocument = vi.fn();
    const createChunks = vi.fn();
    const createPreviewJob = vi.fn(async ({ data }: { data: Record<string, any> }) => jobRecord({
      ...data,
      items: data.items.create.map((item: Record<string, unknown>) => itemRecord({ ...item, importJobId: data.id })),
    }));
    const tx = {
      importJob: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        count: vi.fn().mockResolvedValue(0),
        create: createPreviewJob,
      },
      importItem: { count: vi.fn().mockResolvedValue(0) },
    };
    const prisma = {
      knowledgePack: { findUnique: vi.fn() },
      knowledgeDocument: {
        findMany: vi.fn().mockResolvedValue([
          { id: "doc-exact", title: "既有退款制度", originalFileName: "old.txt", content: exactText, contentChecksum: createKnowledgeContentChecksum(exactText), revision: 3 },
          { id: "doc-title", title: "运费制度", originalFileName: "shipping-old.txt", content: "其他正文", contentChecksum: createKnowledgeContentChecksum("其他正文"), revision: 2 },
        ]),
        create: createFormalDocument,
      },
      knowledgeChunk: { createMany: createChunks },
      importJob: {
        findUnique: vi.fn(),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        count: vi.fn().mockResolvedValue(0),
      },
      importItem: { count: vi.fn().mockResolvedValue(0) },
      $transaction: vi.fn((operation: (client: typeof tx) => unknown) => operation(tx)),
    };
    const result = await new PrismaKnowledgeImportRepository("ws-1", prisma as never).preview({
      files: [{ ...uploaded("refund.txt", exactText), mimeType: "application/octet-stream" }, uploaded("shipping.txt", otherText)],
      idempotencyKey: "batch-preview",
    });
    expect(result.status).toBe("preview_ready");
    expect(result.items.map((item) => item.duplicateType)).toEqual(["exact_content", "same_title"]);
    expect(result.items.map((item) => item.conflictDocumentId)).toEqual(["doc-exact", "doc-title"]);
    expect(result.items[0]?.mimeType).toBe("text/plain");
    expect(prisma.knowledgeDocument.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { workspaceId: "ws-1" } }));
    expect(prisma.knowledgeDocument.findMany).toHaveBeenCalledTimes(3);
    expect(prisma.knowledgeDocument.findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: expect.objectContaining({
        workspaceId: "ws-1",
        OR: expect.arrayContaining([
          { contentChecksum: { in: expect.any(Array) } },
          { normalizedTitle: { in: expect.any(Array) } },
          { normalizedFileName: { in: expect.any(Array) } },
        ]),
      }),
      take: agentRequestLimits.userDocuments,
      select: expect.not.objectContaining({ content: true }),
    }));
    expect(prisma.knowledgeDocument.findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: { workspaceId: "ws-1", contentChecksum: null },
      take: agentRequestLimits.userDocuments,
      select: expect.objectContaining({ content: true }),
    }));
    expect(prisma.knowledgeDocument.findMany).toHaveBeenNthCalledWith(3, expect.objectContaining({
      where: { workspaceId: "ws-1" },
      take: agentRequestLimits.userDocuments,
      select: expect.not.objectContaining({ content: true }),
    }));
    expect(createFormalDocument).not.toHaveBeenCalled();
    expect(createChunks).not.toHaveBeenCalled();
    expect(createPreviewJob).toHaveBeenCalledTimes(1);
    const nestedItems = createPreviewJob.mock.calls[0]?.[0].data.items.create as Array<Record<string, unknown>>;
    expect(nestedItems).toHaveLength(2);
    expect(nestedItems.every((item) => !("workspaceId" in item))).toBe(true);
    expect(tx.importJob.deleteMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ workspaceId: "ws-1", status: ImportJobStatus.PREVIEW_READY }),
    }));
  });

  it("marks a later file with identical content as an in-batch exact duplicate", async () => {
    const text = "同一批次内重复的企业退款制度正文。";
    mocks.parseKnowledgeFile
      .mockResolvedValueOnce(successfulParse(text, "退款制度甲"))
      .mockResolvedValueOnce(successfulParse(text, "退款制度乙"));
    const createPreviewJob = vi.fn(async ({ data }: { data: Record<string, any> }) => jobRecord({
      ...data,
      totalItems: 2,
      items: data.items.create.map((item: Record<string, unknown>) => itemRecord({ ...item, importJobId: data.id })),
    }));
    const tx = {
      importJob: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        count: vi.fn().mockResolvedValue(0),
        create: createPreviewJob,
      },
      importItem: { count: vi.fn().mockResolvedValue(0) },
    };
    const prisma = {
      knowledgeDocument: { findMany: vi.fn().mockResolvedValue([]) },
      importJob: {
        findUnique: vi.fn(),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        count: vi.fn().mockResolvedValue(0),
      },
      importItem: { count: vi.fn().mockResolvedValue(0) },
      $transaction: vi.fn((operation: (client: typeof tx) => unknown) => operation(tx)),
    };

    const result = await new PrismaKnowledgeImportRepository("ws-1", prisma as never).preview({
      files: [uploaded("refund-a.txt", text), uploaded("refund-b.txt", text)],
      idempotencyKey: "batch-internal-duplicate",
    });

    expect(result.items.map((item) => item.duplicateType)).toEqual(["none", "exact_content"]);
    expect(result.items[1]?.conflictDocumentId).toBeUndefined();
    expect(createPreviewJob).toHaveBeenCalledTimes(1);
  });

  it("removes expired previews before enforcing the workspace quota", async () => {
    cleanupExpiredTemporaryContentSpy.mockRestore();
    const text = "到期预览清理后允许继续导入。";
    mocks.parseKnowledgeFile.mockResolvedValue(successfulParse(text, "到期清理制度"));
    let activeJobs: number = knowledgeImportJobLimits.maximumActiveJobsPerWorkspace;
    const deleteExpiredPreviews = vi.fn(async () => {
      const removed = activeJobs;
      activeJobs = 0;
      return { count: removed };
    });
    const countActiveJobs = vi.fn(async () => activeJobs);
    const createPreviewJob = vi.fn(async ({ data }: { data: Record<string, any> }) => jobRecord({
      ...data,
      items: data.items.create.map((item: Record<string, unknown>) => itemRecord({ ...item, importJobId: data.id })),
    }));
    const tx = {
      importJob: {
        deleteMany: deleteExpiredPreviews,
        count: vi.fn().mockResolvedValue(0),
        create: createPreviewJob,
      },
      importItem: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const prisma = {
      knowledgeDocument: { findMany: vi.fn().mockResolvedValue([]) },
      importJob: {
        findUnique: vi.fn().mockResolvedValue(null),
        deleteMany: deleteExpiredPreviews,
        count: countActiveJobs,
      },
      importItem: { count: vi.fn().mockResolvedValue(0) },
      $transaction: vi.fn((operation: (client: typeof tx) => unknown) => operation(tx)),
    };

    await expect(new PrismaKnowledgeImportRepository("ws-1", prisma as never).preview({
      files: [uploaded("policy.txt", text)],
      idempotencyKey: "batch-after-expiry-cleanup",
    })).resolves.toMatchObject({ status: "preview_ready" });

    expect(deleteExpiredPreviews).toHaveBeenCalledWith({
      where: {
        workspaceId: "ws-1",
        status: ImportJobStatus.PREVIEW_READY,
        updatedAt: { lt: expect.any(Date) },
      },
    });
    expect(deleteExpiredPreviews.mock.invocationCallOrder[0]).toBeLessThan(countActiveJobs.mock.invocationCallOrder[0]!);
    expect(createPreviewJob).toHaveBeenCalledTimes(1);
  });

  it("reuses an identical idempotency key and rejects a different payload", async () => {
    const text = "企业退款规则正文。";
    mocks.parseKnowledgeFile.mockResolvedValue(successfulParse(text, "退款制度"));
    const existing = jobRecord({
      idempotencyKey: "batch-1",
      items: [itemRecord({ originalFileName: "refund.txt", checksum: createKnowledgeContentChecksum(text) })],
    });
    const create = vi.fn();
    const prisma = {
      knowledgeDocument: { findMany: vi.fn().mockResolvedValue([]) },
      importJob: { findUnique: vi.fn().mockResolvedValue(existing), create },
    };
    const repository = new PrismaKnowledgeImportRepository("ws-1", prisma as never);
    await expect(repository.preview({ files: [uploaded("refund.txt", text)], idempotencyKey: "batch-1" })).resolves.toMatchObject({ id: "job-1" });
    expect(create).not.toHaveBeenCalled();
    await expect(repository.preview({ files: [uploaded("different.txt", text)], idempotencyKey: "batch-1" })).rejects.toMatchObject({ status: 409, code: "knowledge_import_idempotency_conflict" });
  });

  it("recovers an identical concurrent idempotent preview after the unique constraint wins", async () => {
    const text = "企业退款规则正文。";
    mocks.parseKnowledgeFile.mockResolvedValue(successfulParse(text, "退款制度"));
    const existing = jobRecord({
      idempotencyKey: "batch-race",
      items: [itemRecord({ originalFileName: "refund.txt", checksum: createKnowledgeContentChecksum(text) })],
    });
    const findUnique = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existing);
    const create = vi.fn().mockRejectedValue(new Prisma.PrismaClientKnownRequestError("unique", {
      code: "P2002",
      clientVersion: "6.19.3",
    }));
    const tx = {
      importJob: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        count: vi.fn().mockResolvedValue(0),
        create,
      },
      importItem: { count: vi.fn().mockResolvedValue(0) },
    };
    const prisma = {
      knowledgeDocument: { findMany: vi.fn().mockResolvedValue([]) },
      importJob: {
        findUnique,
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        count: vi.fn().mockResolvedValue(0),
      },
      importItem: { count: vi.fn().mockResolvedValue(0) },
      $transaction: vi.fn((operation: (client: typeof tx) => unknown) => operation(tx)),
    };

    await expect(new PrismaKnowledgeImportRepository("ws-1", prisma as never).preview({
      files: [uploaded("refund.txt", text)],
      idempotencyKey: "batch-race",
    })).resolves.toMatchObject({ id: "job-1" });
    expect(findUnique).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("stops an aborted preview before parsing or persisting any item", async () => {
    const controller = new AbortController();
    controller.abort();
    const prisma = {
      knowledgeDocument: { findMany: vi.fn() },
      importJob: { create: vi.fn() },
    };
    await expect(new PrismaKnowledgeImportRepository("ws-1", prisma as never).preview({
      files: [uploaded("refund.txt", "退款正文")],
      idempotencyKey: "batch-abort",
      signal: controller.signal,
    })).rejects.toMatchObject({ status: 499, code: "knowledge_import_cancelled" });
    expect(mocks.parseKnowledgeFile).not.toHaveBeenCalled();
    expect(prisma.knowledgeDocument.findMany).not.toHaveBeenCalled();
    expect(prisma.importJob.create).not.toHaveBeenCalled();
  });

  it("keeps a maximum-size batch inside the configured parser concurrency", async () => {
    let activeParsers = 0;
    let peakParsers = 0;
    mocks.parseKnowledgeFile.mockImplementation(async (input: { fileName: string }) => {
      activeParsers += 1;
      peakParsers = Math.max(peakParsers, activeParsers);
      await new Promise((resolve) => setTimeout(resolve, 2));
      activeParsers -= 1;
      return successfulParse(`受控批量导入正文 ${input.fileName}`, input.fileName.replace(/\.txt$/u, ""));
    });
    const createPreviewJob = vi.fn(async ({ data }: { data: Record<string, any> }) => jobRecord({
      ...data,
      totalItems: data.items.create.length,
      items: data.items.create.map((item: Record<string, unknown>) => itemRecord({ ...item, importJobId: data.id })),
    }));
    const tx = {
      importJob: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        count: vi.fn().mockResolvedValue(0),
        create: createPreviewJob,
      },
      importItem: { count: vi.fn().mockResolvedValue(0) },
    };
    const prisma = {
      knowledgeDocument: { findMany: vi.fn().mockResolvedValue([]) },
      importJob: {
        findUnique: vi.fn().mockResolvedValue(null),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        count: vi.fn().mockResolvedValue(0),
      },
      importItem: { count: vi.fn().mockResolvedValue(0) },
      $transaction: vi.fn((operation: (client: typeof tx) => unknown) => operation(tx)),
    };
    const files = Array.from({ length: knowledgeImportLimits.maximumBatchFiles }, (_, index) => (
      uploaded(`batch-${index}.txt`, `批量导入正文 ${index}`)
    ));

    const result = await new PrismaKnowledgeImportRepository("ws-1", prisma as never).preview({
      files,
      idempotencyKey: "bounded-parser-pressure",
    });

    expect(result.totalItems).toBe(knowledgeImportLimits.maximumBatchFiles);
    expect(peakParsers).toBe(knowledgeImportLimits.maximumConcurrentParsers);
    expect(mocks.parseKnowledgeFile).toHaveBeenCalledTimes(knowledgeImportLimits.maximumBatchFiles);
  });

  it("confirms all eligible items atomically and enforces job/item CAS", async () => {
    const storedItem = itemRecord({ conflictType: "exact_content", conflictDocumentId: "doc-1", conflictDocumentRevision: 4 });
    const storedJob = jobRecord({ items: [storedItem] });
    let updatedItem = storedItem;
    const tx = {
      importJob: {
        findUnique: vi.fn().mockResolvedValue(storedJob),
        update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const next = { ...storedJob } as Record<string, unknown>;
          applyScalarOrIncrement(next, data);
          return { ...next, items: [updatedItem] };
        }),
      },
      importItem: {
        update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const next = { ...storedItem } as Record<string, unknown>;
          applyScalarOrIncrement(next, data);
          updatedItem = next as ReturnType<typeof itemRecord>;
          return updatedItem;
        }),
      },
      knowledgePack: { findUnique: vi.fn() },
    };
    const prisma = { $transaction: vi.fn((operation: (client: typeof tx) => unknown, _options?: unknown) => operation(tx)) };
    const repository = new PrismaKnowledgeImportRepository("ws-1", prisma as never);
    const metadata = {
      title: "更新后的退款制度", category: "售后", tags: ["退款"], sourceType: "user_upload" as const,
      enabled: true, suggestedQuestions: [], metadata: {},
    };
    const confirmed = await repository.confirmJob("job-1", {
      expectedRevision: 0,
      items: [{ itemId: "item-1", expectedRevision: 0, metadata, conflictResolution: "replace" }],
    });
    expect(confirmed.status).toBe("pending");
    expect(tx.importItem.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { workspaceId_id: { workspaceId: "ws-1", id: "item-1" } },
      data: expect.objectContaining({ conflictResolution: "replace", status: ImportItemStatus.READY }),
    }));
    expect(prisma.$transaction.mock.calls[0]?.[1]).toMatchObject({ isolationLevel: "Serializable" });

    await expect(repository.confirmJob("job-1", {
      expectedRevision: 9,
      items: [{ itemId: "item-1", expectedRevision: 0, metadata, conflictResolution: "replace" }],
    })).rejects.toMatchObject({ status: 409, code: "knowledge_import_revision_conflict" });
  });
});

function processingPrisma(options: { failCapacity?: boolean; claimConflict?: boolean } = {}) {
  const state = {
    job: jobRecord({ status: ImportJobStatus.PENDING, revision: 1 }),
    item: itemRecord({ status: ImportItemStatus.READY, revision: 1, conflictResolution: "import_as_new" }),
  };
  state.job.items = [state.item];
  const formalDocuments: Array<Record<string, unknown>> = [];
  const chunks: Array<Record<string, unknown>> = [];

  const tx: Record<string, any> = {};
  tx.knowledgePack = { findUnique: vi.fn() };
  tx.knowledgeDocument = {
    count: vi.fn().mockResolvedValue(options.failCapacity ? 200 : 0),
    findUnique: vi.fn(),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      formalDocuments.push(data);
      return data;
    }),
    updateMany: vi.fn(),
  };
  tx.knowledgeChunk = {
    deleteMany: vi.fn(),
    createMany: vi.fn(async ({ data }: { data: Array<Record<string, unknown>> }) => {
      chunks.push(...data);
      return { count: data.length };
    }),
  };
  tx.importItem = {
    findFirst: vi.fn(async () => state.item),
    findUnique: vi.fn(async () => state.item),
    findMany: vi.fn(async () => [{ status: state.item.status }]),
    updateMany: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      if (data.status === ImportItemStatus.PROCESSING && options.claimConflict) return { count: 0 };
      applyScalarOrIncrement(state.item as unknown as Record<string, unknown>, data);
      return { count: 1 };
    }),
    update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      applyScalarOrIncrement(state.item as unknown as Record<string, unknown>, data);
      return state.item;
    }),
  };
  tx.importJob = {
    findUnique: vi.fn(async () => state.job),
    updateMany: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      applyScalarOrIncrement(state.job as unknown as Record<string, unknown>, data);
      return { count: 1 };
    }),
    update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      applyScalarOrIncrement(state.job as unknown as Record<string, unknown>, data);
      state.job.items = [state.item];
      return state.job;
    }),
  };
  const prisma = {
    importItem: tx.importItem,
    importJob: tx.importJob,
    $transaction: vi.fn((operation: (client: typeof tx) => unknown) => operation(tx)),
  };
  return { prisma, tx, state, formalDocuments, chunks };
}

describe("PrismaKnowledgeImportRepository processing safety", () => {
  it("claims one item, writes its document and chunks in a transaction, then finalizes progress", async () => {
    const fixture = processingPrisma();
    const result = await new PrismaKnowledgeImportRepository("ws-1", fixture.prisma as never).processNext("job-1", 1);
    expect(result.status).toBe("completed");
    expect(result.completedItems).toBe(1);
    expect(result.items[0]).toMatchObject({ status: "completed", retryCount: 0 });
    expect(fixture.formalDocuments).toHaveLength(1);
    expect(fixture.formalDocuments[0]).toMatchObject({ workspaceId: "ws-1", importJobId: "job-1", originalFileName: "refund.txt" });
    expect(fixture.chunks.length).toBeGreaterThan(0);
    expect(fixture.state.item.extractedText).toBeNull();
    expect(fixture.tx.importItem.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ workspaceId: "ws-1", importJobId: "job-1" }),
    }));
    expect(fixture.prisma.$transaction).toHaveBeenCalledTimes(2);
    const claimCall = fixture.tx.importItem.updateMany.mock.calls[0]?.[0];
    expect(claimCall.where.OR).toEqual([
      { status: ImportItemStatus.READY },
      { status: ImportItemStatus.PROCESSING, leaseExpiresAt: { lt: expect.any(Date) } },
    ]);
    expect(claimCall.data).toMatchObject({
      status: ImportItemStatus.PROCESSING,
      claimToken: expect.any(String),
      claimedAt: expect.any(Date),
      leaseExpiresAt: expect.any(Date),
    });
    expect(claimCall.data.leaseExpiresAt.getTime()).toBeGreaterThan(claimCall.data.claimedAt.getTime());
    expect(fixture.tx.importItem.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: ImportItemStatus.PROCESSING,
        claimToken: expect.any(String),
        leaseExpiresAt: { gt: expect.any(Date) },
      }),
      data: { leaseExpiresAt: expect.any(Date) },
    }));
    expect(fixture.tx.importJob.update).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ durationMs: expect.any(Number) }),
    }));
  });

  it("finishes an already-confirmed item if its pack is archived while processing", async () => {
    const fixture = processingPrisma();
    (fixture.state.job as unknown as Record<string, unknown>).knowledgePackId = "pack-archived";
    fixture.tx.knowledgePack.findUnique.mockResolvedValue({ status: KnowledgePackStatus.ARCHIVED });

    await expect(new PrismaKnowledgeImportRepository("ws-1", fixture.prisma as never).processNext("job-1", 1))
      .resolves.toMatchObject({ status: "completed" });
    expect(fixture.formalDocuments[0]).toMatchObject({ knowledgePackId: "pack-archived" });
  });

  it("turns an isolated item failure into a safe failed result without a partial document write", async () => {
    const fixture = processingPrisma({ failCapacity: true });
    const result = await new PrismaKnowledgeImportRepository("ws-1", fixture.prisma as never).processNext("job-1", 1);
    expect(result.status).toBe("failed");
    expect(result.failedItems).toBe(1);
    expect(result.items[0]).toMatchObject({ status: "failed", errorCode: "knowledge_document_capacity", retryable: false });
    expect(fixture.formalDocuments).toHaveLength(0);
    expect(fixture.chunks).toHaveLength(0);
  });

  it("treats an all-skipped import as a successful terminal job", async () => {
    const fixture = processingPrisma();
    (fixture.state.item as unknown as Record<string, unknown>).conflictResolution = "skip";
    const result = await new PrismaKnowledgeImportRepository("ws-1", fixture.prisma as never).processNext("job-1", 1);
    expect(result).toMatchObject({ status: "completed", completedItems: 0, failedItems: 0, skippedItems: 1 });
    expect(result.items[0]).toMatchObject({ status: "skipped" });
    expect(fixture.formalDocuments).toHaveLength(0);
    expect(fixture.chunks).toHaveLength(0);
  });

  it("rejects a competing claim before any formal document is written", async () => {
    const fixture = processingPrisma({ claimConflict: true });
    await expect(new PrismaKnowledgeImportRepository("ws-1", fixture.prisma as never).processNext("job-1", 1))
      .rejects.toMatchObject({ status: 409, code: "knowledge_import_claim_conflict" });
    expect(fixture.formalDocuments).toHaveLength(0);
    expect(fixture.tx.knowledgeDocument.create).not.toHaveBeenCalled();
  });

  it("reclaims an expired lease with a new owner and still writes only one final document", async () => {
    const fixture = processingPrisma();
    const expiredToken = "expired-worker-token";
    Object.assign(fixture.state.job, { status: ImportJobStatus.PROCESSING });
    Object.assign(fixture.state.item, {
      status: ImportItemStatus.PROCESSING,
      claimToken: expiredToken,
      claimedAt: new Date(Date.now() - knowledgeImportJobLimits.leaseMilliseconds * 2),
      leaseExpiresAt: new Date(Date.now() - 1_000),
    });

    const result = await new PrismaKnowledgeImportRepository("ws-1", fixture.prisma as never).processNext("job-1", 1);

    expect(result.status).toBe("completed");
    expect(fixture.formalDocuments).toHaveLength(1);
    const recoveredClaim = fixture.tx.importItem.updateMany.mock.calls[0]?.[0];
    expect(recoveredClaim.where.OR).toContainEqual({
      status: ImportItemStatus.PROCESSING,
      leaseExpiresAt: { lt: expect.any(Date) },
    });
    expect(recoveredClaim.data.claimToken).not.toBe(expiredToken);
  });

  it("treats a repeated process request for a terminal job as an idempotent read", async () => {
    const fixture = processingPrisma();
    Object.assign(fixture.state.job, {
      status: ImportJobStatus.COMPLETED,
      revision: 3,
      completedItems: 1,
      completedAt: now,
    });
    Object.assign(fixture.state.item, {
      status: ImportItemStatus.COMPLETED,
      documentId: "doc-existing",
      extractedText: null,
    });

    const result = await new PrismaKnowledgeImportRepository("ws-1", fixture.prisma as never).processNext("job-1", 1);

    expect(result).toMatchObject({ status: "completed", completedItems: 1 });
    expect(fixture.tx.importItem.updateMany).not.toHaveBeenCalled();
    expect(fixture.formalDocuments).toHaveLength(0);
  });

  it("retries only failed items with retained text and never resets completed items", async () => {
    const failed = itemRecord({
      status: ImportItemStatus.FAILED,
      extractedText: "可重试正文",
      errorCode: "knowledge_import_item_failed",
      retryCount: 1,
    });
    const completed = itemRecord({ id: "item-2", itemIndex: 1, status: ImportItemStatus.COMPLETED, extractedText: null, documentId: "doc-2" });
    const job = jobRecord({ status: ImportJobStatus.PARTIAL_FAILED, revision: 5, totalItems: 2, completedItems: 1, failedItems: 1, items: [failed, completed] });
    const tx = {
      importJob: {
        findUnique: vi.fn().mockResolvedValue(job),
        update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const next = { ...job } as Record<string, unknown>;
          applyScalarOrIncrement(next, data);
          return { ...next, items: [{ ...failed, status: ImportItemStatus.READY, retryCount: 2 }, completed] };
        }),
      },
      importItem: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findMany: vi.fn().mockResolvedValue([
          { status: ImportItemStatus.READY, conflictType: "none" },
          { status: ImportItemStatus.COMPLETED, conflictType: "none" },
        ]),
      },
    };
    const prisma = { $transaction: vi.fn((operation: (client: typeof tx) => unknown) => operation(tx)) };
    const result = await new PrismaKnowledgeImportRepository("ws-1", prisma as never).retryFailed("job-1", 5);
    expect(result.status).toBe("pending");
    expect(result.items[1]).toMatchObject({ id: "item-2", status: "completed", documentId: "doc-2" });
    expect(tx.importItem.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        workspaceId: "ws-1",
        importJobId: "job-1",
        status: ImportItemStatus.FAILED,
        extractedText: { not: null },
        errorCode: { in: ["knowledge_import_item_failed", "knowledge_import_item_timeout"] },
        retryCount: { lt: knowledgeImportJobLimits.maximumRetryCount },
      },
      data: expect.objectContaining({ retryCount: { increment: 1 } }),
    }));
    await expect(new PrismaKnowledgeImportRepository("ws-1", prisma as never).retryFailed("job-1", 4))
      .rejects.toMatchObject({ status: 409, code: "knowledge_import_revision_conflict" });
  });

  it("does not offer or reset a failed item after the retry limit", async () => {
    const failed = itemRecord({
      status: ImportItemStatus.FAILED,
      extractedText: "仍然保留但已达到重试上限的正文",
      errorCode: "knowledge_import_item_timeout",
      retryCount: knowledgeImportJobLimits.maximumRetryCount,
    });
    const job = jobRecord({ status: ImportJobStatus.FAILED, revision: 5, failedItems: 1, items: [failed] });
    const tx = {
      importJob: { findUnique: vi.fn().mockResolvedValue(job) },
      importItem: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    };
    const prisma = {
      importJob: { findUnique: vi.fn().mockResolvedValue(job) },
      $transaction: vi.fn((operation: (client: typeof tx) => unknown) => operation(tx)),
    };
    const repository = new PrismaKnowledgeImportRepository("ws-1", prisma as never);

    await expect(repository.getJob("job-1")).resolves.toMatchObject({
      items: [{ retryable: false, retryCount: knowledgeImportJobLimits.maximumRetryCount }],
    });
    await expect(repository.retryFailed("job-1", 5)).rejects.toMatchObject({
      status: 400,
      code: "knowledge_import_nothing_to_retry",
    });
    expect(tx.importItem.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ retryCount: { lt: knowledgeImportJobLimits.maximumRetryCount } }),
    }));
  });

  it("rejects an already-aborted processor before it can claim an item", async () => {
    const fixture = processingPrisma();
    const controller = new AbortController();
    controller.abort();

    await expect(new PrismaKnowledgeImportRepository("ws-1", fixture.prisma as never)
      .processNext("job-1", 1, controller.signal))
      .rejects.toMatchObject({ status: 499, code: "knowledge_import_cancelled" });
    expect(fixture.prisma.$transaction).not.toHaveBeenCalled();
    expect(fixture.formalDocuments).toHaveLength(0);
  });

  it("cancels only the workspace-scoped pending items and returns 404 across workspaces", async () => {
    const job = jobRecord({ status: ImportJobStatus.PENDING, revision: 2, items: [itemRecord({ status: ImportItemStatus.READY })] });
    const tx = {
      importJob: {
        findUnique: vi.fn().mockResolvedValue(job),
        update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
          ...job,
          ...data,
          revision: 3,
          items: [itemRecord({ status: ImportItemStatus.CANCELLED, extractedText: null })],
        })),
      },
      importItem: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    const prisma = { $transaction: vi.fn((operation: (client: typeof tx) => unknown) => operation(tx)) };
    const result = await new PrismaKnowledgeImportRepository("ws-1", prisma as never).cancel("job-1", 2);
    expect(result.status).toBe("cancelled");
    expect(result.items[0]).toMatchObject({ status: "cancelled" });
    expect(tx.importItem.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        workspaceId: "ws-1",
        importJobId: "job-1",
        status: { in: expect.arrayContaining([ImportItemStatus.FAILED]) },
      }),
      data: expect.objectContaining({ status: ImportItemStatus.CANCELLED, extractedText: null }),
    }));
    expect(tx.importJob.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ completedAt: expect.any(Date), durationMs: expect.any(Number) }),
    }));

    const isolatedTx = { importJob: { findUnique: vi.fn().mockResolvedValue(null) }, importItem: { updateMany: vi.fn() } };
    const isolatedPrisma = { $transaction: vi.fn((operation: (client: typeof isolatedTx) => unknown) => operation(isolatedTx)) };
    await expect(new PrismaKnowledgeImportRepository("ws-2", isolatedPrisma as never).cancel("job-1", 2))
      .rejects.toMatchObject({ status: 404, code: "knowledge_import_not_found" });
    expect(isolatedTx.importJob.findUnique).toHaveBeenCalledWith({ where: { workspaceId_id: { workspaceId: "ws-2", id: "job-1" } } });
  });
});
