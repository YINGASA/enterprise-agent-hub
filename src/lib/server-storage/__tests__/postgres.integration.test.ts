import { createHash, randomUUID } from "node:crypto";
import { ImportItemStatus, ImportJobStatus, KnowledgeSourceType, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { knowledgeImportJobLimits } from "@/lib/knowledge/import-limits";
import { PrismaConversationRepository } from "@/lib/server-storage/conversationRepository";
import { PrismaKnowledgeRepository } from "@/lib/server-storage/knowledgeRepository";
import { PrismaKnowledgePackRepository } from "@/lib/server-storage/knowledgePackRepository";
import { PrismaKnowledgeImportRepository } from "@/lib/server-storage/knowledgeImportRepository";
import { executeStorageMigration, sanitizeStorageMigrationInput } from "@/lib/server-storage/migration";
import type { ConversationMessage, ImportedKnowledgeDocument } from "@/types";

const databaseUrl = process.env.TEST_DATABASE_URL;
const integrationEnabled = process.env.RUN_POSTGRES_INTEGRATION === "1" && typeof databaseUrl === "string" && databaseUrl.length > 0;
const describePostgres = integrationEnabled ? describe : describe.skip;
const now = "2026-07-16T00:00:00.000Z";

function workspaceTokenHash(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function userMessage(id: string, content: string): ConversationMessage & { role: "user" } {
  return { id, role: "user", content, createdAt: now };
}

function assistantMessage(id: string, runId: string, content: string): ConversationMessage & { role: "assistant" } {
  return { id, role: "assistant", content, createdAt: now, runId, responseMode: "mock", scenario: "general", intent: "general_chat" };
}

function knowledgeDocument(id: string, content = "订单签收后 7 天内可以申请退款。", title = "退款规则"): ImportedKnowledgeDocument {
  return {
    id,
    title,
    category: "售后",
    tags: ["退款"],
    summary: "退款政策摘要",
    content,
    createdAt: now,
    updatedAt: now,
    importedAt: now,
    sourceType: "user_paste",
    isDefault: false,
    enabled: true,
    suggestedQuestions: ["如何退款？"],
  };
}

describePostgres("PostgreSQL storage integration", () => {
  let prisma: PrismaClient;
  const workspaceIds = new Set<string>();

  async function createWorkspace(label: string) {
    const id = `pg-${label}-${randomUUID()}`.slice(0, 64);
    workspaceIds.add(id);
    await prisma.workspace.create({
      data: { id, name: `PostgreSQL test ${label}`, sessionTokenHash: workspaceTokenHash(`${label}-${randomUUID()}`) },
    });
    return id;
  }

  beforeAll(() => {
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl! } } });
  });

  afterAll(async () => {
    if (!prisma) return;
    if (workspaceIds.size) await prisma.workspace.deleteMany({ where: { id: { in: [...workspaceIds] } } });
    await prisma.$disconnect();
  });

  it("isolates workspaces and keeps append, Summary, CAS, regenerate and edit/resend atomic", async () => {
    const workspaceA = await createWorkspace("conversation-a");
    const workspaceB = await createWorkspace("conversation-b");
    const repositoryA = new PrismaConversationRepository(workspaceA, prisma);
    const repositoryB = new PrismaConversationRepository(workspaceB, prisma);
    const conversationId = `conversation-${randomUUID()}`;
    await repositoryA.create({ id: conversationId, createdAt: now });
    await repositoryB.create({ id: conversationId, createdAt: now });

    let conversation = await repositoryA.get(conversationId);
    if (!conversation) throw new Error("conversation fixture missing");
    for (let turn = 1; turn <= 5; turn += 1) {
      conversation = await repositoryA.appendPersistedTurn({
        conversationId,
        expectedRevision: conversation.revision,
        userMessage: userMessage(`turn-${turn}-user`, `问题 ${turn}`),
        assistantMessage: assistantMessage(`turn-${turn}-assistant`, `turn-${turn}-run`, `回答 ${turn}`),
      });
    }

    const summary = { text: "已确认事项：前一轮历史已压缩。", throughMessageId: "turn-1-assistant", updatedAt: now, version: 1 as const, sourceMessageCount: 2 };
    conversation = await repositoryA.appendPersistedTurn({
      conversationId,
      expectedRevision: 5,
      userMessage: userMessage("turn-6-user", "问题 6"),
      assistantMessage: assistantMessage("turn-6-assistant", "turn-6-run", "回答 6"),
      conversationSummaryPatch: { set: summary },
    });
    expect(conversation).toMatchObject({ revision: 6, conversationSummary: summary });
    expect(conversation.messages).toHaveLength(12);

    await expect(repositoryA.appendPersistedTurn({
      conversationId,
      expectedRevision: 5,
      userMessage: userMessage("stale-user", "陈旧问题"),
      assistantMessage: assistantMessage("stale-assistant", "stale-run", "陈旧回答"),
      conversationSummaryPatch: { clear: true },
    })).rejects.toMatchObject({ code: "conflict", status: 409 });
    const afterConflict = await repositoryA.get(conversationId);
    expect(afterConflict).toMatchObject({ revision: 6, conversationSummary: summary });
    expect(afterConflict?.messages).toHaveLength(12);

    await expect(repositoryA.appendPersistedTurn({
      conversationId,
      expectedRevision: 5,
      userMessage: userMessage("turn-6-user", "问题 6"),
      assistantMessage: assistantMessage("turn-6-assistant", "turn-6-run", "回答 6"),
      conversationSummaryPatch: { set: summary },
    })).resolves.toMatchObject({ revision: 6 });
    await expect(repositoryA.appendPersistedTurn({
      conversationId,
      expectedRevision: 5,
      userMessage: userMessage("different-user", "不同问题"),
      assistantMessage: assistantMessage("different-assistant", "turn-6-run", "不同回答"),
    })).rejects.toMatchObject({ code: "conflict", status: 409 });

    conversation = await repositoryA.regeneratePersistedAssistant({
      conversationId,
      expectedRevision: 6,
      expectedAssistantMessageId: "turn-6-assistant",
      assistantMessage: assistantMessage("turn-6-assistant-regenerated", "turn-6-regenerated-run", "重新生成回答"),
    });
    expect(conversation).toMatchObject({ revision: 7 });
    expect(conversation.messages.at(-1)).toMatchObject({ id: "turn-6-assistant-regenerated", content: "重新生成回答" });
    expect(conversation.messages.some((message) => message.id === "turn-6-assistant")).toBe(false);

    conversation = await repositoryA.editAndResendPersistedTurn({
      conversationId,
      expectedRevision: 7,
      expectedUserMessageId: "turn-6-user",
      expectedAssistantMessageId: "turn-6-assistant-regenerated",
      userMessage: userMessage("turn-6-user-edited", "编辑后的问题"),
      assistantMessage: assistantMessage("turn-6-assistant-edited", "turn-6-edited-run", "编辑后的回答"),
      conversationSummaryPatch: { clear: true },
    });
    expect(conversation).toMatchObject({ revision: 8, conversationSummary: undefined });
    expect(conversation.messages.slice(-2)).toEqual([
      expect.objectContaining({ id: "turn-6-user-edited", content: "编辑后的问题" }),
      expect.objectContaining({ id: "turn-6-assistant-edited", content: "编辑后的回答" }),
    ]);
    expect(conversation.messages.some((message) => message.id === "turn-6-user" || message.id === "turn-6-assistant-regenerated")).toBe(false);

    await expect(repositoryB.get(conversationId)).resolves.toMatchObject({ revision: 0, messages: [] });

    const foreignConversationId = `foreign-${randomUUID()}`;
    await repositoryB.create({ id: foreignConversationId, createdAt: now });
    await expect(prisma.message.create({ data: {
      workspaceId: workspaceA,
      conversationId: foreignConversationId,
      id: `foreign-message-${randomUUID()}`,
      role: "USER",
      content: "禁止跨工作区关联",
      createdAt: new Date(now),
      messageOrder: 0,
    } })).rejects.toMatchObject({ code: "P2003" });

    const cascadeConversationId = `cascade-${randomUUID()}`;
    await repositoryA.create({ id: cascadeConversationId, createdAt: now });
    await repositoryA.appendPersistedTurn({
      conversationId: cascadeConversationId,
      expectedRevision: 0,
      userMessage: userMessage(`cascade-user-${randomUUID()}`, "级联问题"),
      assistantMessage: assistantMessage(`cascade-assistant-${randomUUID()}`, `cascade-run-${randomUUID()}`, "级联回答"),
    });
    await prisma.conversation.delete({ where: { workspaceId_id: { workspaceId: workspaceA, id: cascadeConversationId } } });
    await expect(prisma.message.count({ where: { workspaceId: workspaceA, conversationId: cascadeConversationId } })).resolves.toBe(0);
  });

  it("serializes concurrent CAS and rolls back invalid Summary and stale revision mutations", async () => {
    const workspaceId = await createWorkspace("concurrent-conversation");
    const repository = new PrismaConversationRepository(workspaceId, prisma);
    const conversationId = `concurrent-${randomUUID()}`;
    await repository.create({ id: conversationId, createdAt: now });

    const writes = await Promise.allSettled([
      repository.appendPersistedTurn({
        conversationId,
        expectedRevision: 0,
        userMessage: userMessage(`concurrent-user-a-${randomUUID()}`, "并发问题 A"),
        assistantMessage: assistantMessage(`concurrent-assistant-a-${randomUUID()}`, `concurrent-run-a-${randomUUID()}`, "并发回答 A"),
      }),
      repository.appendPersistedTurn({
        conversationId,
        expectedRevision: 0,
        userMessage: userMessage(`concurrent-user-b-${randomUUID()}`, "并发问题 B"),
        assistantMessage: assistantMessage(`concurrent-assistant-b-${randomUUID()}`, `concurrent-run-b-${randomUUID()}`, "并发回答 B"),
      }),
    ]);
    expect(writes.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = writes.find((result): result is PromiseRejectedResult => result.status === "rejected");
    expect(rejected?.reason).toMatchObject({ code: "conflict", status: 409 });

    const committed = await repository.get(conversationId);
    expect(committed).toMatchObject({ revision: 1 });
    expect(committed?.messages).toHaveLength(2);
    const tail = committed?.messages.at(-1);

    await expect(repository.appendPersistedTurn({
      conversationId,
      expectedRevision: 1,
      userMessage: userMessage(`invalid-summary-user-${randomUUID()}`, "不会提交的问题"),
      assistantMessage: assistantMessage(`invalid-summary-assistant-${randomUUID()}`, `invalid-summary-run-${randomUUID()}`, "不会提交的回答"),
      conversationSummaryPatch: { set: { text: "无效游标摘要", throughMessageId: "missing-assistant", updatedAt: now, version: 1, sourceMessageCount: 2 } },
    })).rejects.toMatchObject({ code: "invalid_input", status: 400 });
    await expect(repository.regeneratePersistedAssistant({
      conversationId,
      expectedRevision: 1,
      expectedAssistantMessageId: "stale-assistant",
      assistantMessage: assistantMessage(`stale-regenerate-${randomUUID()}`, `stale-regenerate-run-${randomUUID()}`, "不会提交的重生成"),
    })).rejects.toMatchObject({ code: "conflict", status: 409 });
    await expect(repository.editAndResendPersistedTurn({
      conversationId,
      expectedRevision: 1,
      expectedUserMessageId: "stale-user",
      expectedAssistantMessageId: tail?.id ?? "missing",
      userMessage: userMessage(`stale-edit-user-${randomUUID()}`, "不会提交的编辑"),
      assistantMessage: assistantMessage(`stale-edit-assistant-${randomUUID()}`, `stale-edit-run-${randomUUID()}`, "不会提交的编辑回答"),
    })).rejects.toMatchObject({ code: "conflict", status: 409 });

    const afterRollbacks = await repository.get(conversationId);
    expect(afterRollbacks).toMatchObject({ revision: 1, conversationSummary: undefined });
    expect(afterRollbacks?.messages).toEqual(committed?.messages);
  });

  it("persists workspace-scoped knowledge, rebuilds chunks and cascades document deletion", async () => {
    const workspaceA = await createWorkspace("knowledge-a");
    const workspaceB = await createWorkspace("knowledge-b");
    const repositoryA = new PrismaKnowledgeRepository(workspaceA, prisma);
    const repositoryB = new PrismaKnowledgeRepository(workspaceB, prisma);
    const documentId = `knowledge-${randomUUID()}`;
    await repositoryA.create(knowledgeDocument(documentId));
    await repositoryB.create(knowledgeDocument(documentId, "另一个工作区的规则。", "独立规则"));
    await expect(repositoryA.list()).resolves.toEqual([expect.objectContaining({ id: documentId, title: "退款规则" })]);
    await expect(repositoryB.list()).resolves.toEqual([expect.objectContaining({ id: documentId, title: "独立规则" })]);
    const originalChunks = await repositoryA.listChunks(documentId);
    expect(originalChunks.length).toBeGreaterThan(0);

    const updated = await repositoryA.update(documentId, { content: "更新后的退款规则要求在 5 天内提交申请。", summary: "更新摘要" });
    expect(updated.content).toContain("5 天");
    const rebuiltChunks = await repositoryA.listChunks(documentId);
    expect(rebuiltChunks.length).toBeGreaterThan(0);
    expect(rebuiltChunks.map((chunk) => chunk.content).join("\n")).toContain("5 天");

    await repositoryA.replaceAll([knowledgeDocument(`restored-${randomUUID()}`, "恢复后的知识正文。", "恢复文档")]);
    await expect(repositoryA.list()).resolves.toEqual([expect.objectContaining({ title: "恢复文档" })]);
    await expect(repositoryB.list()).resolves.toEqual([expect.objectContaining({ id: documentId, title: "独立规则" })]);

    const restored = (await repositoryA.list())[0]!;
    await expect(prisma.knowledgeChunk.create({ data: {
      workspaceId: workspaceB,
      documentId: restored.id,
      id: `foreign-chunk-${randomUUID()}`,
      chunkIndex: 99,
      content: "禁止跨工作区关联",
      keywords: [],
    } })).rejects.toMatchObject({ code: "P2003" });
    await repositoryA.remove(restored.id);
    await expect(prisma.knowledgeChunk.count({ where: { workspaceId: workspaceA, documentId: restored.id } })).resolves.toBe(0);
  });

  it("persists workspace-scoped packs and keeps V2.2.0-shaped knowledge rows readable", async () => {
    const workspaceA = await createWorkspace("knowledge-pack-a");
    const workspaceB = await createWorkspace("knowledge-pack-b");
    const packRepositoryA = new PrismaKnowledgePackRepository(workspaceA, prisma);
    const packA = await packRepositoryA.create({ name: "Enterprise Policies", description: "PostgreSQL integration fixture" });
    const packB = await new PrismaKnowledgePackRepository(workspaceB, prisma).create({ name: "Enterprise Policies" });

    expect(packA).toMatchObject({ revision: 0, documentCount: 0 });
    expect(packB).toMatchObject({ revision: 0, documentCount: 0 });

    const legacyDocumentId = `legacy-knowledge-${randomUUID()}`;
    await prisma.knowledgeDocument.create({
      data: {
        workspaceId: workspaceA,
        id: legacyDocumentId,
        title: "V2.2.0 compatible document",
        content: "This row intentionally omits every V2.2.1 optional column.",
        sourceType: KnowledgeSourceType.USER_PASTE,
        checksum: randomUUID(),
      },
    });
    await expect(prisma.knowledgeDocument.findUnique({
      where: { workspaceId_id: { workspaceId: workspaceA, id: legacyDocumentId } },
    })).resolves.toMatchObject({
      revision: 0,
      contentChecksum: null,
      knowledgePackId: null,
      mimeType: null,
      sizeBytes: null,
      importJobId: null,
    });

    const packedDocumentId = `packed-knowledge-${randomUUID()}`;
    await prisma.knowledgeDocument.create({
      data: {
        workspaceId: workspaceA,
        id: packedDocumentId,
        title: "Packed document",
        content: "Workspace A knowledge pack content.",
        sourceType: KnowledgeSourceType.USER_UPLOAD,
        checksum: randomUUID(),
        knowledgePackId: packA.id,
      },
    });
    const packedJobId = `packed-job-${randomUUID()}`;
    await prisma.importJob.create({
      data: {
        workspaceId: workspaceA,
        id: packedJobId,
        status: ImportJobStatus.COMPLETED,
        knowledgePackId: packA.id,
      },
    });
    await expect(prisma.knowledgeDocument.create({
      data: {
        workspaceId: workspaceA,
        id: `foreign-pack-document-${randomUUID()}`,
        title: "Cross-workspace pack reference",
        content: "This insert must be rejected.",
        sourceType: KnowledgeSourceType.USER_UPLOAD,
        checksum: randomUUID(),
        knowledgePackId: packB.id,
      },
    })).rejects.toMatchObject({ code: "P2003" });

    const detached = await packRepositoryA.remove(packA.id, { expectedRevision: 0 });
    expect(detached).toEqual({ detachedDocumentCount: 1, deletedDocumentCount: 0 });
    await expect(prisma.knowledgeDocument.findUnique({
      where: { workspaceId_id: { workspaceId: workspaceA, id: packedDocumentId } },
    })).resolves.toMatchObject({ knowledgePackId: null, revision: 1 });
    await expect(prisma.importJob.findUnique({
      where: { workspaceId_id: { workspaceId: workspaceA, id: packedJobId } },
    })).resolves.toMatchObject({ knowledgePackId: null, revision: 1 });

    const deletePack = await packRepositoryA.create({ name: "Disposable Pack" });
    const deleteDocumentId = `delete-with-pack-${randomUUID()}`;
    await prisma.knowledgeDocument.create({
      data: {
        workspaceId: workspaceA,
        id: deleteDocumentId,
        title: "Delete with pack",
        content: "This document is deleted only after explicit confirmation.",
        sourceType: KnowledgeSourceType.USER_UPLOAD,
        checksum: randomUUID(),
        knowledgePackId: deletePack.id,
      },
    });
    await expect(packRepositoryA.remove(deletePack.id, {
      expectedRevision: 0,
      deleteDocuments: true,
      confirmation: "DELETE_DOCUMENTS",
    })).resolves.toEqual({ detachedDocumentCount: 0, deletedDocumentCount: 1 });
    await expect(prisma.knowledgeDocument.count({ where: { workspaceId: workspaceA, id: deleteDocumentId } })).resolves.toBe(0);
  });

  it("persists import jobs and items with composite workspace isolation and cascade semantics", async () => {
    const workspaceA = await createWorkspace("import-model-a");
    const workspaceB = await createWorkspace("import-model-b");
    const jobId = `import-job-${randomUUID()}`;
    const otherJobId = `import-job-${randomUUID()}`;
    const job = await prisma.importJob.create({
      data: {
        workspaceId: workspaceA,
        id: jobId,
        status: ImportJobStatus.PREVIEW_READY,
        idempotencyKey: `idempotency-${randomUUID()}`,
      },
    });
    await prisma.importJob.create({ data: { workspaceId: workspaceB, id: otherJobId, status: ImportJobStatus.PREVIEW_READY } });
    expect(job).toMatchObject({
      totalItems: 0,
      completedItems: 0,
      failedItems: 0,
      skippedItems: 0,
      conflictedItems: 0,
      revision: 0,
    });
    await expect(prisma.importJob.create({
      data: {
        workspaceId: workspaceA,
        id: `duplicate-idempotency-job-${randomUUID()}`,
        idempotencyKey: job.idempotencyKey,
      },
    })).rejects.toMatchObject({ code: "P2002" });
    await expect(prisma.importJob.create({
      data: {
        workspaceId: workspaceB,
        id: `other-workspace-idempotency-job-${randomUUID()}`,
        idempotencyKey: job.idempotencyKey,
      },
    })).resolves.toMatchObject({ revision: 0 });

    const itemId = `import-item-${randomUUID()}`;
    const item = await prisma.importItem.create({
      data: {
        workspaceId: workspaceA,
        id: itemId,
        importJobId: jobId,
        itemIndex: 0,
        originalFileName: "policy.txt",
        normalizedTitle: "Policy",
        mimeType: "text/plain",
        sizeBytes: 42,
        checksum: "a".repeat(64),
      },
    });
    expect(item).toMatchObject({
      status: ImportItemStatus.PREVIEW_READY,
      retryCount: 0,
      revision: 0,
      extractedText: null,
    });
    await expect(prisma.importItem.findUnique({
      where: { workspaceId_id: { workspaceId: workspaceB, id: itemId } },
    })).resolves.toBeNull();
    await expect(prisma.importItem.create({
      data: {
        workspaceId: workspaceA,
        id: `cross-workspace-item-${randomUUID()}`,
        importJobId: otherJobId,
        itemIndex: 0,
        originalFileName: "cross-workspace.txt",
        normalizedTitle: "Cross workspace",
        mimeType: "text/plain",
        sizeBytes: 1,
        checksum: "b".repeat(64),
      },
    })).rejects.toMatchObject({ code: "P2003" });

    await prisma.importJob.delete({ where: { workspaceId_id: { workspaceId: workspaceA, id: jobId } } });
    await expect(prisma.importItem.count({ where: { workspaceId: workspaceA, importJobId: jobId } })).resolves.toBe(0);
    await expect(prisma.importJob.count({ where: { workspaceId: workspaceB, id: otherJobId } })).resolves.toBe(1);
  });

  it("creates a real PostgreSQL import preview through the nested repository path", async () => {
    const workspaceId = await createWorkspace("import-preview");
    const pack = await new PrismaKnowledgePackRepository(workspaceId, prisma).create({ name: "Import Preview Pack" });
    const repository = new PrismaKnowledgeImportRepository(workspaceId, prisma);
    const content = "星河审批码 Q7X9 是员工设备申请的唯一业务编号。".repeat(30);

    const preview = await repository.preview({
      files: [{
        fileName: "employee-policy.txt",
        mimeType: "text/plain",
        sizeBytes: Buffer.byteLength(content),
        bytes: Buffer.from(content),
      }],
      knowledgePackId: pack.id,
      idempotencyKey: `preview-${randomUUID()}`,
    });

    expect(preview).toMatchObject({
      status: "preview_ready",
      totalItems: 1,
      items: [expect.objectContaining({
        status: "preview_ready",
        originalFileName: "employee-policy.txt",
        checksumStatus: "computed",
      })],
    });
    await expect(prisma.knowledgeDocument.count({ where: { workspaceId } })).resolves.toBe(0);
    await expect(prisma.importItem.count({ where: { workspaceId, importJobId: preview.id } })).resolves.toBe(1);
  });

  it("expires retained import text transactionally without deleting formal knowledge or crossing workspaces", async () => {
    const workspaceA = await createWorkspace("retention-a");
    const workspaceB = await createWorkspace("retention-b");
    const repository = new PrismaKnowledgeImportRepository(workspaceA, prisma);
    const cleanupNow = new Date("2026-07-19T00:00:00.000Z");
    const staleUpdatedAt = new Date(cleanupNow.getTime() - knowledgeImportJobLimits.temporaryExtractedTextRetentionMilliseconds - 1);
    const documentId = `retained-document-${randomUUID()}`;
    await new PrismaKnowledgeRepository(workspaceA, prisma).create(knowledgeDocument(
      documentId,
      "正式知识文档和分块不能被临时正文清理删除。",
      "保留正式知识",
    ));
    const jobId = `retention-job-${randomUUID()}`;
    const otherJobId = `retention-other-job-${randomUUID()}`;
    await prisma.importJob.createMany({ data: [
      { workspaceId: workspaceA, id: jobId, status: ImportJobStatus.PROCESSING, totalItems: 4, updatedAt: staleUpdatedAt },
      { workspaceId: workspaceB, id: otherJobId, status: ImportJobStatus.PENDING, totalItems: 1, updatedAt: staleUpdatedAt },
    ] });
    const itemData = [
      { id: `retention-ready-${randomUUID()}`, itemIndex: 0, status: ImportItemStatus.READY },
      {
        id: `retention-processing-${randomUUID()}`,
        itemIndex: 1,
        status: ImportItemStatus.PROCESSING,
        claimToken: `expired-${randomUUID()}`,
        claimedAt: staleUpdatedAt,
        leaseExpiresAt: new Date(cleanupNow.getTime() - 1_000),
      },
      { id: `retention-failed-${randomUUID()}`, itemIndex: 2, status: ImportItemStatus.FAILED, errorCode: "knowledge_import_item_failed" },
      { id: `retention-completed-${randomUUID()}`, itemIndex: 3, status: ImportItemStatus.COMPLETED, documentId },
    ];
    await prisma.importItem.createMany({ data: itemData.map((item) => ({
      workspaceId: workspaceA,
      importJobId: jobId,
      originalFileName: `${item.itemIndex}.txt`,
      normalizedTitle: `retention${item.itemIndex}`,
      mimeType: "text/plain",
      sizeBytes: 32,
      checksum: createHash("sha256").update(item.id).digest("hex"),
      extractedText: `临时解析正文-${item.itemIndex}`,
      updatedAt: staleUpdatedAt,
      ...item,
    })) });
    const otherItemId = `retention-other-item-${randomUUID()}`;
    await prisma.importItem.create({ data: {
      workspaceId: workspaceB,
      id: otherItemId,
      importJobId: otherJobId,
      itemIndex: 0,
      originalFileName: "other.txt",
      normalizedTitle: "other",
      mimeType: "text/plain",
      sizeBytes: 32,
      checksum: createHash("sha256").update(otherItemId).digest("hex"),
      status: ImportItemStatus.READY,
      extractedText: "另一工作区临时正文",
      updatedAt: staleUpdatedAt,
    } });

    await expect(repository.cleanupExpiredTemporaryContent(cleanupNow)).resolves.toEqual({
      deletedPreviewJobs: 0,
      expiredItems: 3,
      clearedTerminalItems: 1,
    });

    const [items, job, documentCount, chunkCount, isolated] = await Promise.all([
      prisma.importItem.findMany({ where: { workspaceId: workspaceA, importJobId: jobId }, orderBy: { itemIndex: "asc" } }),
      prisma.importJob.findUnique({ where: { workspaceId_id: { workspaceId: workspaceA, id: jobId } } }),
      prisma.knowledgeDocument.count({ where: { workspaceId: workspaceA, id: documentId } }),
      prisma.knowledgeChunk.count({ where: { workspaceId: workspaceA, documentId } }),
      prisma.importItem.findUnique({ where: { workspaceId_id: { workspaceId: workspaceB, id: otherItemId } } }),
    ]);
    expect(items.slice(0, 3).every((item) => (
      item.status === ImportItemStatus.FAILED
      && item.extractedText === null
      && item.errorCode === "knowledge_import_temporary_content_expired"
      && item.claimToken === null
      && item.leaseExpiresAt === null
    ))).toBe(true);
    expect(items[3]).toMatchObject({ status: ImportItemStatus.COMPLETED, extractedText: null, documentId });
    expect(job).toMatchObject({ status: ImportJobStatus.PARTIAL_FAILED, completedItems: 1, failedItems: 3 });
    expect(documentCount).toBe(1);
    expect(chunkCount).toBeGreaterThan(0);
    expect(isolated).toMatchObject({ status: ImportItemStatus.READY, extractedText: "另一工作区临时正文" });
  });

  it("imports local data idempotently and keeps server records on conflict", async () => {
    const workspaceId = await createWorkspace("migration");
    const conversationId = `migrated-${randomUUID()}`;
    const documentId = `migrated-document-${randomUUID()}`;
    const payload = sanitizeStorageMigrationInput({
      migrationId: `migration-${randomUUID()}`,
      conversations: [{
        id: conversationId,
        title: "本地会话",
        titleSource: "manual",
        createdAt: now,
        updatedAt: now,
        revision: 0,
        schemaVersion: 1,
        messages: [userMessage(`${conversationId}-user`, "迁移问题"), assistantMessage(`${conversationId}-assistant`, `${conversationId}-run`, "迁移回答")],
      }],
      knowledgeDocuments: [knowledgeDocument(documentId)],
    });
    if (!payload.ok) throw new Error("migration fixture invalid");

    await expect(executeStorageMigration(workspaceId, payload.input, prisma)).resolves.toMatchObject({ status: "completed", imported: 2, idempotent: false });
    await expect(executeStorageMigration(workspaceId, payload.input, prisma)).resolves.toMatchObject({ status: "completed", imported: 2, idempotent: true });
    await expect(new PrismaConversationRepository(workspaceId, prisma).get(conversationId)).resolves.toMatchObject({ messages: [{ content: "迁移问题" }, { content: "迁移回答" }] });

    const changedSameId = sanitizeStorageMigrationInput({
      ...payload.input,
      migrationId: payload.input.migrationId,
      conversations: [{ ...payload.input.conversations[0]!, title: "不同数据包" }],
    });
    if (!changedSameId.ok) throw new Error("changed migration fixture invalid");
    await expect(executeStorageMigration(workspaceId, changedSameId.input, prisma)).rejects.toMatchObject({ code: "id_conflict", status: 409 });

    const serverWins = sanitizeStorageMigrationInput({
      migrationId: `migration-conflict-${randomUUID()}`,
      conversations: [{ ...payload.input.conversations[0]!, title: "尝试覆盖服务端" }],
      knowledgeDocuments: [{ ...payload.input.knowledgeDocuments[0]!, content: "尝试覆盖服务端知识。" }],
    });
    if (!serverWins.ok) throw new Error("conflict migration fixture invalid");
    await expect(executeStorageMigration(workspaceId, serverWins.input, prisma)).resolves.toMatchObject({ status: "conflict", conflicted: 2, imported: 0 });
    await expect(new PrismaConversationRepository(workspaceId, prisma).get(conversationId)).resolves.toMatchObject({ title: "本地会话" });
    await expect(new PrismaKnowledgeRepository(workspaceId, prisma).get(documentId)).resolves.toMatchObject({ content: "订单签收后 7 天内可以申请退款。" });
  });

  it("uses V2.2.2 workspace-scoped lookup and queue indexes without crossing workspaces", async () => {
    const workspaceA = await createWorkspace("query-plan-a");
    const workspaceB = await createWorkspace("query-plan-b");
    const conversationId = `query-plan-conversation-${randomUUID()}`;
    const runId = `query-plan-run-${randomUUID()}`;
    const normalizedTitle = "refundpolicy2026";
    const jobId = `query-plan-job-${randomUUID()}`;
    const nowDate = new Date(now);

    await Promise.all([
      prisma.conversation.create({
        data: { workspaceId: workspaceA, id: conversationId, title: "Query plan", createdAt: nowDate, updatedAt: nowDate },
      }),
      prisma.knowledgeDocument.create({
        data: {
          workspaceId: workspaceA,
          id: `query-plan-document-a-${randomUUID()}`,
          title: "Refund Policy 2026",
          normalizedTitle,
          normalizedFileName: "policy.docx",
          content: "Workspace A indexed knowledge.",
          sourceType: KnowledgeSourceType.USER_UPLOAD,
          checksum: randomUUID(),
        },
      }),
      prisma.knowledgeDocument.create({
        data: {
          workspaceId: workspaceB,
          id: `query-plan-document-b-${randomUUID()}`,
          title: "Refund Policy 2026",
          normalizedTitle,
          normalizedFileName: "policy.docx",
          content: "Workspace B must remain isolated.",
          sourceType: KnowledgeSourceType.USER_UPLOAD,
          checksum: randomUUID(),
        },
      }),
      prisma.importJob.create({
        data: { workspaceId: workspaceA, id: jobId, status: ImportJobStatus.PROCESSING, totalItems: 2 },
      }),
    ]);
    await prisma.message.create({
      data: {
        workspaceId: workspaceA,
        id: `query-plan-message-${randomUUID()}`,
        conversationId,
        role: "ASSISTANT",
        content: "Indexed response",
        runId,
        messageOrder: 0,
      },
    });
    await prisma.importItem.createMany({
      data: [
        {
          workspaceId: workspaceA,
          id: `query-plan-ready-${randomUUID()}`,
          importJobId: jobId,
          itemIndex: 0,
          originalFileName: "ready.txt",
          normalizedTitle: "ready",
          mimeType: "text/plain",
          sizeBytes: 10,
          checksum: "c".repeat(64),
          status: ImportItemStatus.READY,
        },
        {
          workspaceId: workspaceA,
          id: `query-plan-expired-${randomUUID()}`,
          importJobId: jobId,
          itemIndex: 1,
          originalFileName: "expired.txt",
          normalizedTitle: "expired",
          mimeType: "text/plain",
          sizeBytes: 10,
          checksum: "d".repeat(64),
          status: ImportItemStatus.PROCESSING,
          leaseExpiresAt: new Date(nowDate.getTime() - 1_000),
        },
      ],
    });

    await expect(prisma.knowledgeDocument.findMany({
      where: { workspaceId: workspaceA, normalizedTitle },
      select: { workspaceId: true },
    })).resolves.toEqual([{ workspaceId: workspaceA }]);

    const planText = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET LOCAL enable_seqscan = off");
      const plans = await Promise.all([
        tx.$queryRawUnsafe(
          `EXPLAIN (FORMAT JSON) SELECT "id" FROM "conversations" WHERE "workspace_id" = $1 AND "deleted_at" IS NULL ORDER BY "updated_at" DESC, "id" DESC LIMIT 10`,
          workspaceA,
        ),
        tx.$queryRawUnsafe(
          `EXPLAIN (FORMAT JSON) SELECT "id" FROM "messages" WHERE "workspace_id" = $1 AND "conversation_id" = $2 AND "role" = 'assistant' AND "run_id" = $3 LIMIT 1`,
          workspaceA, conversationId, runId,
        ),
        tx.$queryRawUnsafe(
          `EXPLAIN (FORMAT JSON) SELECT "id" FROM "knowledge_documents" WHERE "workspace_id" = $1 AND "normalized_title" = $2`,
          workspaceA, normalizedTitle,
        ),
        tx.$queryRawUnsafe(
          `EXPLAIN (FORMAT JSON) SELECT "id" FROM "import_jobs" WHERE "workspace_id" = $1 AND "status" = 'processing' ORDER BY "updated_at" DESC, "id" DESC LIMIT 10`,
          workspaceA,
        ),
        tx.$queryRawUnsafe(
          `EXPLAIN (FORMAT JSON) SELECT "id" FROM "import_items" WHERE "workspace_id" = $1 AND "import_job_id" = $2 AND "status" = 'ready' ORDER BY "item_index" LIMIT 1`,
          workspaceA, jobId,
        ),
        tx.$queryRawUnsafe(
          `EXPLAIN (FORMAT JSON) SELECT "id" FROM "import_items" WHERE "workspace_id" = $1 AND "import_job_id" = $2 AND "status" = 'processing' AND "lease_expires_at" < $3 ORDER BY "lease_expires_at", "item_index" LIMIT 1`,
          workspaceA, jobId, nowDate,
        ),
        tx.$queryRawUnsafe(
          `EXPLAIN (FORMAT JSON) SELECT COUNT(*) FROM "import_items" WHERE "workspace_id" = $1 AND "status" = 'ready'`,
          workspaceA,
        ),
      ]);
      return JSON.stringify(plans);
    });
    for (const indexName of [
      "conversations_active_updated_idx",
      "messages_run_id_lookup_idx",
      "knowledge_documents_normalized_title_idx",
      "import_jobs_status_updated_idx",
      "import_items_job_status_order_idx",
      "import_items_claim_queue_idx",
      "import_items_workspace_status_idx",
    ]) {
      expect(planText).toContain(indexName);
    }
  });

  it("keeps bounded workspace queries correct with 100 conversations and 100 knowledge documents", async () => {
    const workspaceA = await createWorkspace("bounded-scale-a");
    const workspaceB = await createWorkspace("bounded-scale-b");
    const scalePrefix = randomUUID();
    const conversationIds = Array.from({ length: 100 }, (_, index) => `scale-conversation-${index}-${scalePrefix}`);
    const documentIds = Array.from({ length: 100 }, (_, index) => `scale-document-${index}-${scalePrefix}`);
    const packIds = Array.from({ length: 4 }, (_, index) => `scale-pack-${index}-${scalePrefix}`);
    const jobIds = Array.from({ length: 10 }, (_, index) => `scale-job-${index}-${scalePrefix}`);

    await prisma.knowledgePack.createMany({
      data: packIds.map((id, index) => ({
        workspaceId: workspaceA,
        id,
        name: `Scale Pack ${index}`,
        normalizedName: `scale pack ${index}`,
      })),
    });
    await prisma.conversation.createMany({
      data: conversationIds.map((id, index) => ({
        workspaceId: workspaceA,
        id,
        title: `Scale conversation ${index}`,
        createdAt: new Date(Date.parse(now) + index),
        updatedAt: new Date(Date.parse(now) + index),
      })),
    });
    await prisma.message.createMany({
      data: conversationIds.flatMap((conversationId, index) => ([
        {
          workspaceId: workspaceA,
          id: `scale-message-user-${index}-${scalePrefix}`,
          conversationId,
          role: "USER" as const,
          content: `Scale question ${index}`,
          messageOrder: 0,
        },
        {
          workspaceId: workspaceA,
          id: `scale-message-assistant-${index}-${scalePrefix}`,
          conversationId,
          role: "ASSISTANT" as const,
          content: `Scale answer ${index}`,
          runId: `scale-run-${index}-${scalePrefix}`,
          messageOrder: 1,
        },
      ])),
    });
    await prisma.knowledgeDocument.createMany({
      data: documentIds.map((id, index) => ({
        workspaceId: workspaceA,
        id,
        title: `Scale Policy ${index}`,
        normalizedTitle: `scalepolicy${index}`,
        content: `Workspace A policy ${index}: retain the approved evidence and do not delete it.`,
        sourceType: KnowledgeSourceType.USER_PASTE,
        enabled: index % 5 !== 0,
        checksum: `scale-checksum-${index}-${scalePrefix}`,
        contentChecksum: createHash("sha256").update(`scale-content-${index}-${scalePrefix}`).digest("hex"),
        knowledgePackId: packIds[index % packIds.length],
      })),
    });
    await prisma.knowledgeChunk.createMany({
      data: documentIds.map((documentId, index) => ({
        workspaceId: workspaceA,
        id: `scale-chunk-${index}-${scalePrefix}`,
        documentId,
        chunkIndex: 0,
        content: `Searchable scale policy ${index} for workspace A only.`,
        keywords: ["scale", `policy-${index}`],
      })),
    });
    await prisma.importJob.createMany({
      data: jobIds.map((id, index) => ({
        workspaceId: workspaceA,
        id,
        status: ImportJobStatus.PROCESSING,
        totalItems: 10,
        createdAt: new Date(Date.parse(now) + index),
        updatedAt: new Date(Date.parse(now) + index),
      })),
    });
    await prisma.importItem.createMany({
      data: jobIds.flatMap((importJobId, jobIndex) => Array.from({ length: 10 }, (_, itemIndex) => ({
        workspaceId: workspaceA,
        id: `scale-item-${jobIndex}-${itemIndex}-${scalePrefix}`,
        importJobId,
        itemIndex,
        originalFileName: `scale-${jobIndex}-${itemIndex}.txt`,
        normalizedTitle: `scale${jobIndex}${itemIndex}`,
        mimeType: "text/plain",
        sizeBytes: 128,
        checksum: createHash("sha256").update(`scale-item-${jobIndex}-${itemIndex}-${scalePrefix}`).digest("hex"),
        status: ImportItemStatus.READY,
      }))),
    });
    await prisma.knowledgeDocument.create({
      data: {
        workspaceId: workspaceB,
        id: `scale-isolated-${scalePrefix}`,
        title: "Scale Policy 42",
        normalizedTitle: "scalepolicy42",
        content: "Workspace B private data.",
        sourceType: KnowledgeSourceType.USER_PASTE,
        enabled: true,
        checksum: `scale-isolated-checksum-${scalePrefix}`,
        contentChecksum: createHash("sha256").update(`scale-content-42-${scalePrefix}`).digest("hex"),
      },
    });

    const [conversations, enabledDocuments, jobs, readyItems, checksumMatches, chunks] = await Promise.all([
      prisma.conversation.findMany({
        where: { workspaceId: workspaceA, deletedAt: null },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: 10,
        select: { workspaceId: true },
      }),
      prisma.knowledgeDocument.findMany({
        where: { workspaceId: workspaceA, enabled: true },
        orderBy: { updatedAt: "desc" },
        take: 25,
        select: { id: true, workspaceId: true },
      }),
      prisma.importJob.findMany({
        where: { workspaceId: workspaceA, status: ImportJobStatus.PROCESSING },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: 10,
        select: { id: true, workspaceId: true },
      }),
      prisma.importItem.findMany({
        where: { workspaceId: workspaceA, status: ImportItemStatus.READY },
        orderBy: [{ importJobId: "asc" }, { itemIndex: "asc" }],
        take: 20,
        select: { id: true, workspaceId: true },
      }),
      prisma.knowledgeDocument.findMany({
        where: {
          workspaceId: workspaceA,
          contentChecksum: createHash("sha256").update(`scale-content-42-${scalePrefix}`).digest("hex"),
        },
        select: { id: true, workspaceId: true },
      }),
      prisma.knowledgeChunk.findMany({
        where: { workspaceId: workspaceA, documentId: { in: documentIds.slice(0, 25) } },
        take: 25,
        select: { documentId: true, workspaceId: true },
      }),
    ]);

    expect(conversations).toHaveLength(10);
    expect(enabledDocuments).toHaveLength(25);
    expect(jobs).toHaveLength(10);
    expect(readyItems).toHaveLength(20);
    expect(checksumMatches).toEqual([{ id: documentIds[42], workspaceId: workspaceA }]);
    expect(chunks).toHaveLength(25);
    expect([...conversations, ...enabledDocuments, ...jobs, ...readyItems, ...checksumMatches, ...chunks]
      .every((record) => record.workspaceId === workspaceA)).toBe(true);
    await expect(prisma.message.count({ where: { workspaceId: workspaceA } })).resolves.toBe(200);
    await expect(prisma.knowledgeDocument.count({ where: { workspaceId: workspaceA } })).resolves.toBe(100);
    await expect(prisma.knowledgeChunk.count({ where: { workspaceId: workspaceA } })).resolves.toBe(100);
    await expect(prisma.importItem.count({ where: { workspaceId: workspaceA } })).resolves.toBe(100);
  });

  it("returns one durable result for concurrent identical migrations and cascades workspace deletion", async () => {
    const workspaceId = await createWorkspace("concurrent-migration");
    const conversationId = `concurrent-migration-conversation-${randomUUID()}`;
    const documentId = `concurrent-migration-document-${randomUUID()}`;
    const payload = sanitizeStorageMigrationInput({
      migrationId: `concurrent-migration-${randomUUID()}`,
      conversations: [{
        id: conversationId,
        title: "并发迁移会话",
        titleSource: "manual",
        createdAt: now,
        updatedAt: now,
        revision: 0,
        schemaVersion: 1,
        messages: [userMessage(`${conversationId}-user`, "并发迁移问题"), assistantMessage(`${conversationId}-assistant`, `${conversationId}-run`, "并发迁移回答")],
      }],
      knowledgeDocuments: [knowledgeDocument(documentId)],
    });
    if (!payload.ok) throw new Error("concurrent migration fixture invalid");

    const concurrent = await Promise.all([
      executeStorageMigration(workspaceId, payload.input, prisma),
      executeStorageMigration(workspaceId, payload.input, prisma),
    ]);
    expect(concurrent).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: "completed", imported: 2, idempotent: false }),
      expect.objectContaining({ status: "completed", imported: 2, idempotent: true }),
    ]));
    await expect(prisma.conversation.count({ where: { workspaceId, id: conversationId } })).resolves.toBe(1);
    await expect(prisma.message.count({ where: { workspaceId, conversationId } })).resolves.toBe(2);
    await expect(prisma.knowledgeDocument.count({ where: { workspaceId, id: documentId } })).resolves.toBe(1);
    await expect(prisma.storageMigration.count({ where: { workspaceId, migrationId: payload.input.migrationId } })).resolves.toBe(1);

    await prisma.workspace.delete({ where: { id: workspaceId } });
    workspaceIds.delete(workspaceId);
    await expect(prisma.conversation.count({ where: { workspaceId } })).resolves.toBe(0);
    await expect(prisma.message.count({ where: { workspaceId } })).resolves.toBe(0);
    await expect(prisma.knowledgeDocument.count({ where: { workspaceId } })).resolves.toBe(0);
    await expect(prisma.knowledgeChunk.count({ where: { workspaceId } })).resolves.toBe(0);
    await expect(prisma.importJob.count({ where: { workspaceId } })).resolves.toBe(0);
    await expect(prisma.storageMigration.count({ where: { workspaceId } })).resolves.toBe(0);
  });
});
