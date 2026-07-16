import { createHash, randomUUID } from "node:crypto";
import { ImportJobStatus, MessageRole, Prisma, StorageMigrationStatus } from "@prisma/client";
import { sanitizeConversation, sanitizeConversationMessage } from "@/lib/conversation/storage";
import { sanitizeImportedKnowledgeDocument } from "@/lib/knowledge/storage";
import { agentRequestLimits } from "@/lib/ops/securityLimits";
import { getPrismaClient } from "@/lib/server-storage/prisma";
import { createKnowledgeChecksum, knowledgeChunkCreateData, knowledgeDocumentCreateData } from "@/lib/server-storage/knowledgeRepository";
import { isPrismaErrorWithCode, StorageApiError } from "@/lib/server-storage/errors";
import type { Conversation, ImportedKnowledgeDocument } from "@/types";

export const storageMigrationLimits = {
  migrationIdChars: 128,
  recordIdChars: 128,
  conversations: 10,
  messagesPerConversation: 100,
  knowledgeDocuments: 12,
} as const;

export type StorageMigrationInput = {
  migrationId: string;
  conversations: Conversation[];
  knowledgeDocuments: ImportedKnowledgeDocument[];
  invalidCount: number;
  invalidConversationCount: number;
  invalidKnowledgeDocumentCount: number;
};

export type StorageMigrationResult = {
  migrationId: string;
  status: "completed" | "failed" | "conflict";
  imported: number;
  skipped: number;
  conflicted: number;
  failed: number;
  conversations: { imported: number; skipped: number; conflicted: number; failed: number };
  knowledgeDocuments: { imported: number; skipped: number; conflicted: number; failed: number };
};

export type StorageMigrationValidation =
  | { ok: true; input: StorageMigrationInput }
  | { ok: false; status: 400 | 413; error: string; message: string };

function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validMigrationRecordId(value: unknown): value is string {
  return typeof value === "string" && Boolean(value.trim()) && value.length <= storageMigrationLimits.recordIdChars;
}

/**
 * Client storage sanitizers intentionally repair legacy data. Migration input
 * is stricter: silently dropping one bad message would import an incomplete
 * conversation while reporting success.
 */
function hasValidRawConversationMessages(value: unknown) {
  if (!object(value) || !validMigrationRecordId(value.id) || !Array.isArray(value.messages)) return false;
  return value.messages.every((message) => (
    object(message)
    && validMigrationRecordId(message.id)
    && sanitizeConversationMessage(message) !== null
  ));
}

/**
 * PostgreSQL JSONB does not preserve object key order. Checksums therefore use
 * a canonical JSON representation so equivalent summaries/details never turn
 * into false migration conflicts after a database round-trip.
 */
function canonicalJson(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalJson);
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalJson(item)]),
  );
}

function sha256(value: unknown) {
  return createHash("sha256").update(JSON.stringify(canonicalJson(value)), "utf8").digest("hex");
}

export function sanitizeStorageMigrationInput(value: unknown): StorageMigrationValidation {
  if (!object(value)) return { ok: false, status: 400, error: "invalid_migration", message: "迁移数据格式无效。" };
  const migrationId = typeof value.migrationId === "string" ? value.migrationId.trim() : "";
  if (!migrationId) return { ok: false, status: 400, error: "invalid_migration_id", message: "缺少迁移标识。" };
  if (migrationId.length > storageMigrationLimits.migrationIdChars) return { ok: false, status: 413, error: "migration_id_too_long", message: "迁移标识过长。" };
  if ("workspaceId" in value) return { ok: false, status: 400, error: "workspace_not_allowed", message: "工作区由服务端会话确定。" };

  const rawConversations = value.conversations === undefined ? [] : value.conversations;
  const rawDocuments = value.knowledgeDocuments === undefined ? [] : value.knowledgeDocuments;
  if (!Array.isArray(rawConversations) || !Array.isArray(rawDocuments)) {
    return { ok: false, status: 400, error: "invalid_migration_records", message: "迁移记录必须是数组。" };
  }
  if (rawConversations.length > storageMigrationLimits.conversations || rawDocuments.length > storageMigrationLimits.knowledgeDocuments) {
    return { ok: false, status: 413, error: "migration_capacity_exceeded", message: "迁移记录超过单次容量上限。" };
  }
  if (rawConversations.some((conversation) => (
    object(conversation)
    && Array.isArray(conversation.messages)
    && conversation.messages.length > storageMigrationLimits.messagesPerConversation
  ))) {
    return { ok: false, status: 413, error: "migration_messages_exceeded", message: "单个会话的消息数量超过迁移上限。" };
  }

  const conversations: Conversation[] = [];
  const conversationIds = new Set<string>();
  const messageIds = new Set<string>();
  let invalidConversationCount = 0;
  for (const rawConversation of rawConversations) {
    if (!hasValidRawConversationMessages(rawConversation)) {
      invalidConversationCount += 1;
      continue;
    }
    const conversation = sanitizeConversation(rawConversation);
    const currentMessageIds = new Set(conversation?.messages.map((message) => message.id) ?? []);
    const duplicateMessageId = Boolean(conversation) && (currentMessageIds.size !== conversation!.messages.length || conversation!.messages.some((message) => messageIds.has(message.id)));
    if (!conversation || conversationIds.has(conversation.id) || duplicateMessageId) {
      invalidConversationCount += 1;
      continue;
    }
    conversationIds.add(conversation.id);
    conversation.messages.forEach((message) => messageIds.add(message.id));
    conversations.push(conversation);
  }
  const knowledgeDocuments: ImportedKnowledgeDocument[] = [];
  const documentIds = new Set<string>();
  let invalidKnowledgeDocumentCount = 0;
  for (const rawDocument of rawDocuments) {
    const document = sanitizeImportedKnowledgeDocument(rawDocument);
    if (!document || documentIds.has(document.id)) {
      invalidKnowledgeDocumentCount += 1;
      continue;
    }
    documentIds.add(document.id);
    knowledgeDocuments.push(document);
  }
  return {
    ok: true,
    input: {
      migrationId,
      conversations,
      knowledgeDocuments,
      invalidCount: invalidConversationCount + invalidKnowledgeDocumentCount,
      invalidConversationCount,
      invalidKnowledgeDocumentCount,
    },
  };
}

function conversationChecksum(conversation: Conversation) {
  const normalized = {
    title: conversation.title,
    titleSource: conversation.titleSource,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    revision: conversation.revision,
    conversationSummary: conversation.conversationSummary ?? null,
    messages: conversation.messages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt,
      runId: message.runId ?? null,
      responseMode: message.responseMode ?? null,
      intent: message.intent ?? null,
      scenario: message.scenario ?? null,
      details: message.details ?? null,
      contextApplied: message.contextApplied ?? null,
      contextMessageCount: message.contextMessageCount ?? null,
      contextTruncated: message.contextTruncated ?? null,
      contextCharacterCount: message.contextCharacterCount ?? null,
    })),
  };
  return sha256(normalized);
}

function storedAssistantMetadata(value: Prisma.JsonValue | null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { details: null, contextApplied: null, contextMessageCount: null, contextTruncated: null, contextCharacterCount: null };
  }
  const item = value as Prisma.JsonObject;
  const wrapped = Object.prototype.hasOwnProperty.call(item, "details");
  return {
    details: wrapped ? item.details ?? null : item,
    contextApplied: typeof item.contextApplied === "boolean" ? item.contextApplied : null,
    contextMessageCount: typeof item.contextMessageCount === "number" ? item.contextMessageCount : null,
    contextTruncated: typeof item.contextTruncated === "boolean" ? item.contextTruncated : null,
    contextCharacterCount: typeof item.contextCharacterCount === "number" ? item.contextCharacterCount : null,
  };
}

function assistantMetadataForMigration(message: Conversation["messages"][number]): Prisma.InputJsonValue | undefined {
  if (message.role !== "assistant") return undefined;
  const value = Object.fromEntries(Object.entries({
    details: message.details,
    contextApplied: message.contextApplied,
    contextMessageCount: message.contextMessageCount,
    contextTruncated: message.contextTruncated,
    contextCharacterCount: message.contextCharacterCount,
  }).filter(([, item]) => item !== undefined));
  return Object.keys(value).length ? value as Prisma.InputJsonObject : undefined;
}

function storedConversationChecksum(record: {
  title: string;
  titleSource: string;
  createdAt: Date;
  updatedAt: Date;
  revision: number;
  conversationSummary: Prisma.JsonValue | null;
  messages: Array<{
    id: string;
    role: MessageRole;
    content: string;
    createdAt: Date;
    runId: string | null;
    responseMode: string | null;
    intent: string | null;
    scenario: string | null;
    assistantDetails: Prisma.JsonValue | null;
  }>;
}) {
  return sha256({
    title: record.title,
    titleSource: record.titleSource,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    revision: record.revision,
    conversationSummary: record.conversationSummary,
    messages: record.messages.map((message) => ({
      id: message.id,
      role: message.role === MessageRole.USER ? "user" : "assistant",
      content: message.content,
      createdAt: message.createdAt.toISOString(),
      runId: message.runId,
      responseMode: message.responseMode,
      intent: message.intent,
      scenario: message.scenario,
      ...storedAssistantMetadata(message.assistantDetails),
    })),
  });
}

export function createStorageMigrationFingerprint(input: StorageMigrationInput) {
  return sha256({
    conversations: input.conversations,
    knowledgeDocuments: input.knowledgeDocuments,
    invalidConversationCount: input.invalidConversationCount,
    invalidKnowledgeDocumentCount: input.invalidKnowledgeDocumentCount,
  });
}

function emptyResult(input: Pick<StorageMigrationInput, "migrationId" | "invalidCount" | "invalidConversationCount" | "invalidKnowledgeDocumentCount">): StorageMigrationResult {
  return {
    migrationId: input.migrationId,
    status: input.invalidCount ? "failed" : "completed",
    imported: 0,
    skipped: 0,
    conflicted: 0,
    failed: input.invalidCount,
    conversations: { imported: 0, skipped: 0, conflicted: 0, failed: input.invalidConversationCount },
    knowledgeDocuments: { imported: 0, skipped: 0, conflicted: 0, failed: input.invalidKnowledgeDocumentCount },
  };
}

function finalize(result: StorageMigrationResult) {
  result.imported = result.conversations.imported + result.knowledgeDocuments.imported;
  result.skipped = result.conversations.skipped + result.knowledgeDocuments.skipped;
  result.conflicted = result.conversations.conflicted + result.knowledgeDocuments.conflicted;
  result.failed = result.conversations.failed + result.knowledgeDocuments.failed;
  result.status = result.conflicted ? "conflict" : result.failed ? "failed" : "completed";
  return result;
}

export async function previewStorageMigration(workspaceId: string, input: StorageMigrationInput, prisma = getPrismaClient()) {
  const result = emptyResult(input);
  let conversationSlots = Math.max(0, storageMigrationLimits.conversations - await prisma.conversation.count({ where: { workspaceId, deletedAt: null } }));
  let documentSlots = Math.max(0, agentRequestLimits.userDocuments - await prisma.knowledgeDocument.count({ where: { workspaceId } }));
  const conversationRecords = input.conversations.length ? await prisma.conversation.findMany({
    where: { workspaceId, id: { in: input.conversations.map((item) => item.id) } },
    include: { messages: { orderBy: { messageOrder: "asc" } } },
  }) : [];
  const conversationsById = new Map(conversationRecords.map((record) => [record.id, record]));
  const existingMessageRecords = input.conversations.length ? await prisma.message.findMany({
    where: { workspaceId, id: { in: input.conversations.flatMap((item) => item.messages.map((message) => message.id)) } },
    select: { id: true, conversationId: true },
  }) : [];
  const existingMessageIds = new Set(existingMessageRecords.map((message) => message.id));
  for (const conversation of input.conversations) {
    const existing = conversationsById.get(conversation.id);
    if (!existing && conversation.messages.some((message) => existingMessageIds.has(message.id))) result.conversations.conflicted += 1;
    else if (!existing && conversationSlots <= 0) result.conversations.failed += 1;
    else if (!existing) { result.conversations.imported += 1; conversationSlots -= 1; }
    else if (storedConversationChecksum(existing) === conversationChecksum(conversation)) result.conversations.skipped += 1;
    else result.conversations.conflicted += 1;
  }

  const documentRecords = input.knowledgeDocuments.length ? await prisma.knowledgeDocument.findMany({
    where: { workspaceId, id: { in: input.knowledgeDocuments.map((item) => item.id) } },
    select: { id: true, checksum: true },
  }) : [];
  const documentsById = new Map(documentRecords.map((record) => [record.id, record]));
  for (const document of input.knowledgeDocuments) {
    const existing = documentsById.get(document.id);
    if (!existing && documentSlots <= 0) result.knowledgeDocuments.failed += 1;
    else if (!existing) { result.knowledgeDocuments.imported += 1; documentSlots -= 1; }
    else if (existing.checksum === createKnowledgeChecksum(document)) result.knowledgeDocuments.skipped += 1;
    else result.knowledgeDocuments.conflicted += 1;
  }
  return finalize(result);
}

function storedResultFromJson(value: Prisma.JsonValue | null): { result: StorageMigrationResult; payloadFingerprint: string | null } | null {
  if (!object(value)) return null;
  if (typeof value.migrationId !== "string" || typeof value.imported !== "number" || typeof value.skipped !== "number" || typeof value.conflicted !== "number" || typeof value.failed !== "number") return null;
  const payloadFingerprint = typeof value.payloadFingerprint === "string" && /^[a-f0-9]{64}$/.test(value.payloadFingerprint)
    ? value.payloadFingerprint
    : null;
  const { payloadFingerprint: _payloadFingerprint, ...safeResult } = value;
  return { result: safeResult as unknown as StorageMigrationResult, payloadFingerprint };
}

function assertMatchingMigrationPayload(storedFingerprint: string | null, inputFingerprint: string) {
  if (storedFingerprint !== inputFingerprint) {
    throw new StorageApiError("id_conflict", 409, "迁移标识已用于不同的数据包，请重新预检。", false);
  }
}

export async function executeStorageMigration(workspaceId: string, input: StorageMigrationInput, prisma = getPrismaClient()) {
  const payloadFingerprint = createStorageMigrationFingerprint(input);
  const previous = await prisma.storageMigration.findUnique({ where: { workspaceId_migrationId: { workspaceId, migrationId: input.migrationId } } });
  const previousStoredResult = previous ? storedResultFromJson(previous.result) : null;
  if (previousStoredResult) {
    assertMatchingMigrationPayload(previousStoredResult.payloadFingerprint, payloadFingerprint);
    return { ...previousStoredResult.result, idempotent: true as const };
  }

  try {
    return await prisma.$transaction(async (tx) => {
    const existingMigration = await tx.storageMigration.findUnique({ where: { workspaceId_migrationId: { workspaceId, migrationId: input.migrationId } } });
    const existingStoredResult = existingMigration ? storedResultFromJson(existingMigration.result) : null;
    if (existingStoredResult) {
      assertMatchingMigrationPayload(existingStoredResult.payloadFingerprint, payloadFingerprint);
      return { ...existingStoredResult.result, idempotent: true as const };
    }
    if (!existingMigration) {
      await tx.storageMigration.create({ data: { workspaceId, migrationId: input.migrationId, status: StorageMigrationStatus.RUNNING } });
    }

    const result = emptyResult(input);
    let conversationSlots = Math.max(0, storageMigrationLimits.conversations - await tx.conversation.count({ where: { workspaceId, deletedAt: null } }));
    let documentSlots = Math.max(0, agentRequestLimits.userDocuments - await tx.knowledgeDocument.count({ where: { workspaceId } }));
    for (const conversation of input.conversations) {
      const existing = await tx.conversation.findUnique({
        where: { workspaceId_id: { workspaceId, id: conversation.id } },
        include: { messages: { orderBy: { messageOrder: "asc" } } },
      });
      if (existing) {
        if (storedConversationChecksum(existing) === conversationChecksum(conversation)) result.conversations.skipped += 1;
        else result.conversations.conflicted += 1;
        continue;
      }
      const messageIdConflict = conversation.messages.length ? await tx.message.findFirst({
        where: { workspaceId, id: { in: conversation.messages.map((message) => message.id) } },
        select: { id: true },
      }) : null;
      if (messageIdConflict) { result.conversations.conflicted += 1; continue; }
      if (conversationSlots <= 0) { result.conversations.failed += 1; continue; }
      await tx.conversation.create({
        data: {
          workspaceId,
          id: conversation.id,
          title: conversation.title,
          titleSource: conversation.titleSource,
          createdAt: new Date(conversation.createdAt),
          updatedAt: new Date(conversation.updatedAt),
          revision: conversation.revision,
          schemaVersion: 1,
          conversationSummary: conversation.conversationSummary ? conversation.conversationSummary as unknown as Prisma.InputJsonValue : undefined,
        },
      });
      if (conversation.messages.length) {
        await tx.message.createMany({ data: conversation.messages.map((message, messageOrder) => ({
          workspaceId,
          id: message.id,
          conversationId: conversation.id,
          role: message.role === "user" ? MessageRole.USER : MessageRole.ASSISTANT,
          content: message.content,
          createdAt: new Date(message.createdAt),
          runId: message.runId,
          responseMode: message.responseMode,
          intent: message.intent,
          scenario: message.scenario,
          assistantDetails: assistantMetadataForMigration(message),
          messageOrder,
        })) });
      }
      result.conversations.imported += 1;
      conversationSlots -= 1;
    }

    for (const document of input.knowledgeDocuments) {
      const existing = await tx.knowledgeDocument.findUnique({ where: { workspaceId_id: { workspaceId, id: document.id } }, select: { checksum: true } });
      if (existing) {
        if (existing.checksum === createKnowledgeChecksum(document)) result.knowledgeDocuments.skipped += 1;
        else result.knowledgeDocuments.conflicted += 1;
        continue;
      }
      if (documentSlots <= 0) { result.knowledgeDocuments.failed += 1; continue; }
      await tx.knowledgeDocument.create({ data: knowledgeDocumentCreateData(workspaceId, document) });
      const chunks = knowledgeChunkCreateData(workspaceId, document);
      if (chunks.length) await tx.knowledgeChunk.createMany({ data: chunks });
      await tx.importJob.create({ data: { workspaceId, id: `migration-import-${randomUUID()}`, status: ImportJobStatus.COMPLETED, documentId: document.id } });
      result.knowledgeDocuments.imported += 1;
      documentSlots -= 1;
    }

    finalize(result);
    await tx.storageMigration.update({
      where: { workspaceId_migrationId: { workspaceId, migrationId: input.migrationId } },
      data: {
        status: result.status === "conflict" ? StorageMigrationStatus.CONFLICT : result.status === "failed" ? StorageMigrationStatus.FAILED : StorageMigrationStatus.COMPLETED,
        importedCount: result.imported,
        skippedCount: result.skipped,
        conflictedCount: result.conflicted,
        failedCount: result.failed,
        result: { ...result, payloadFingerprint } as unknown as Prisma.InputJsonValue,
      },
    });
    return { ...result, idempotent: false as const };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (!isPrismaErrorWithCode(error, "P2002") && !isPrismaErrorWithCode(error, "P2034")) throw error;

    // A concurrent request with the same migration id may win either the
    // unique insert or serializable transaction race. Reconcile from its
    // committed result with bounded, delayed reads instead of spinning.
    for (const delayMs of [0, 10, 25, 50]) {
      if (delayMs) await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
      const concurrent = await prisma.storageMigration.findUnique({
        where: { workspaceId_migrationId: { workspaceId, migrationId: input.migrationId } },
      });
      const stored = concurrent ? storedResultFromJson(concurrent.result) : null;
      if (!stored) continue;
      assertMatchingMigrationPayload(stored.payloadFingerprint, payloadFingerprint);
      return { ...stored.result, idempotent: true as const };
    }

    throw new StorageApiError("revision_conflict", 409, "同一迁移正在处理中，请稍后重试。", true);
  }
}

export async function getStorageMigrationResult(workspaceId: string, migrationId: string, prisma = getPrismaClient()) {
  const record = await prisma.storageMigration.findUnique({ where: { workspaceId_migrationId: { workspaceId, migrationId } } });
  return record ? storedResultFromJson(record.result)?.result ?? null : null;
}
