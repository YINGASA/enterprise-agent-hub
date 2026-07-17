import { createHash, randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaConversationRepository } from "@/lib/server-storage/conversationRepository";
import { PrismaKnowledgeRepository } from "@/lib/server-storage/knowledgeRepository";
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
