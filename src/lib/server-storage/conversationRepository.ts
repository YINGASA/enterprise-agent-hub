import { MessageRole, Prisma, type Conversation as ConversationRecord, type Message as MessageRecord } from "@prisma/client";
import { isDeepStrictEqual } from "node:util";
import { sanitizeConversationSummaryPatch, validateConversationSummary } from "@/lib/conversation/context-summary";
import {
  MAX_CONVERSATION_MESSAGES,
  MAX_CONVERSATIONS,
  createCompletedAssistantMessage,
  sanitizeAssistantDetails,
  sanitizeConversation,
  sanitizeConversationMessage,
} from "@/lib/conversation/storage";
import { DEFAULT_CONVERSATION_TITLE, generateConversationTitle, validateManualConversationTitle } from "@/lib/conversation/title";
import { getPrismaClient } from "@/lib/server-storage/prisma";
import {
  ConversationRepositoryError,
  createPersistedTurnPayload,
  type AppendConversationTurnInput,
  type ConversationRepository,
  type CreateConversationInput,
  type EditAndResendConversationInput,
  type PersistedTurnPayload,
  type RegenerateConversationInput,
} from "@/lib/storage/conversationRepository";
import type { Conversation, ConversationAssistantDetails, ConversationMessage, ConversationSummaryPatch } from "@/types";

const conversationWithMessages = Prisma.validator<Prisma.ConversationDefaultArgs>()({
  include: { messages: { orderBy: { messageOrder: "asc" } } },
});

type ConversationWithMessages = Prisma.ConversationGetPayload<typeof conversationWithMessages>;
type TransactionClient = Prisma.TransactionClient;

type StoredAssistantMetadata = {
  details?: ConversationAssistantDetails;
  contextApplied?: boolean;
  contextMessageCount?: number;
  contextTruncated?: boolean;
  contextCharacterCount?: number;
};

export type PersistedAppendInput = {
  conversationId: string;
  expectedRevision: number;
  userMessage: ConversationMessage & { role: "user" };
  assistantMessage: ConversationMessage & { role: "assistant" };
  conversationSummaryPatch?: ConversationSummaryPatch;
};

export type PersistedRegenerateInput = {
  conversationId: string;
  expectedRevision: number;
  expectedAssistantMessageId: string;
  assistantMessage: ConversationMessage & { role: "assistant" };
  conversationSummaryPatch?: ConversationSummaryPatch;
};

export type PersistedEditAndResendInput = PersistedAppendInput & {
  expectedUserMessageId: string;
  expectedAssistantMessageId: string;
};

function storedAssistantMetadata(message: ConversationMessage): Prisma.InputJsonValue | undefined {
  const metadata: StoredAssistantMetadata = {
    details: message.details,
    contextApplied: message.contextApplied,
    contextMessageCount: message.contextMessageCount,
    contextTruncated: message.contextTruncated,
    contextCharacterCount: message.contextCharacterCount,
  };
  const compact = Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== undefined));
  return Object.keys(compact).length ? compact as Prisma.InputJsonObject : undefined;
}

function readStoredAssistantMetadata(value: Prisma.JsonValue | null): StoredAssistantMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const item = value as Prisma.JsonObject;
  const wrapped = Object.prototype.hasOwnProperty.call(item, "details");
  return {
    details: sanitizeAssistantDetails(wrapped ? item.details : item),
    contextApplied: typeof item.contextApplied === "boolean" ? item.contextApplied : undefined,
    contextMessageCount: typeof item.contextMessageCount === "number" && Number.isInteger(item.contextMessageCount) && item.contextMessageCount >= 0 ? item.contextMessageCount : undefined,
    contextTruncated: typeof item.contextTruncated === "boolean" ? item.contextTruncated : undefined,
    contextCharacterCount: typeof item.contextCharacterCount === "number" && Number.isInteger(item.contextCharacterCount) && item.contextCharacterCount >= 0 ? item.contextCharacterCount : undefined,
  };
}

function toMessage(record: MessageRecord): ConversationMessage {
  const base: ConversationMessage = {
    id: record.id,
    role: record.role === MessageRole.USER ? "user" : "assistant",
    content: record.content,
    createdAt: record.createdAt.toISOString(),
  };
  if (base.role === "user") return base;
  const metadata = readStoredAssistantMetadata(record.assistantDetails);
  return {
    ...base,
    runId: record.runId ?? undefined,
    responseMode: record.responseMode as ConversationMessage["responseMode"],
    intent: record.intent as ConversationMessage["intent"],
    scenario: record.scenario as ConversationMessage["scenario"],
    ...metadata,
  };
}

function toConversation(record: ConversationRecord & { messages: MessageRecord[] }): Conversation {
  const candidate = sanitizeConversation({
    id: record.id,
    title: record.title,
    titleSource: record.titleSource,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    revision: record.revision,
    schemaVersion: 1,
    conversationSummary: record.conversationSummary,
    messages: record.messages.map(toMessage),
  });
  if (!candidate) throw new ConversationRepositoryError("request_failed", "服务端会话数据无法读取。", 500);
  return candidate;
}

function messageCreateData(workspaceId: string, conversationId: string, message: ConversationMessage, messageOrder: number) {
  return {
    workspaceId,
    conversationId,
    id: message.id,
    role: message.role === "user" ? MessageRole.USER : MessageRole.ASSISTANT,
    content: message.content,
    createdAt: new Date(message.createdAt),
    runId: message.role === "assistant" ? message.runId : undefined,
    responseMode: message.role === "assistant" ? message.responseMode : undefined,
    intent: message.role === "assistant" ? message.intent : undefined,
    scenario: message.role === "assistant" ? message.scenario : undefined,
    assistantDetails: message.role === "assistant" ? storedAssistantMetadata(message) : undefined,
    messageOrder,
  };
}

function sanitizePersistedMessage<Role extends "user" | "assistant">(value: unknown, role: Role): ConversationMessage & { role: Role } {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ConversationRepositoryError("invalid_input", "消息内容不符合存储规则。", 400);
  const raw = value as { id?: unknown };
  if (typeof raw.id !== "string" || !raw.id || raw.id.length > 128) throw new ConversationRepositoryError("invalid_input", "消息标识不符合存储规则。", 400);
  const message = sanitizeConversationMessage(value);
  if (!message || message.role !== role) throw new ConversationRepositoryError("invalid_input", "消息内容不符合存储规则。", 400);
  if (message.id.length > 128 || message.content.length === 0) throw new ConversationRepositoryError("invalid_input", "消息标识或内容不符合存储规则。", 400);
  return message as ConversationMessage & { role: Role };
}

function summaryData(patch: ConversationSummaryPatch | undefined, messages?: ConversationMessage[]) {
  if (!patch) return undefined;
  const safe = sanitizeConversationSummaryPatch(patch);
  if (!safe) throw new ConversationRepositoryError("invalid_input", "滚动摘要补丁无效。", 400);
  if (safe.set && messages && !validateConversationSummary(safe.set, messages).valid) {
    throw new ConversationRepositoryError("invalid_input", "滚动摘要游标不属于当前有效会话历史。", 400);
  }
  return safe.clear ? Prisma.DbNull : safe.set as Prisma.InputJsonObject;
}

function isIdempotentAppendRetry(
  current: Conversation,
  expectedRevision: number,
  userMessage: ConversationMessage & { role: "user" },
  assistantMessage: ConversationMessage & { role: "assistant" },
  patch?: ConversationSummaryPatch,
) {
  if (current.revision !== expectedRevision + 1) return false;
  const assistantIndex = current.messages.findIndex((message) => message.id === assistantMessage.id && message.runId === assistantMessage.runId);
  if (assistantIndex <= 0 || assistantIndex !== current.messages.length - 1) return false;
  const persistedUser = current.messages[assistantIndex - 1];
  const persistedAssistant = current.messages[assistantIndex];
  if (!persistedUser || persistedUser.role !== "user" || !persistedAssistant || persistedAssistant.role !== "assistant") return false;
  if (!isDeepStrictEqual(persistedUser, userMessage) || !isDeepStrictEqual(persistedAssistant, assistantMessage)) return false;
  if (!patch) return true;
  const safePatch = sanitizeConversationSummaryPatch(patch);
  if (!safePatch) throw new ConversationRepositoryError("invalid_input", "滚动摘要补丁无效。", 400);
  return safePatch.clear
    ? current.conversationSummary === undefined
    : isDeepStrictEqual(current.conversationSummary, safePatch.set);
}

function translatePrismaError(error: unknown): never {
  if (error instanceof ConversationRepositoryError) throw error;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") throw new ConversationRepositoryError("conflict", "会话或消息标识已存在。", 409);
    if (error.code === "P2034") throw new ConversationRepositoryError("conflict", "会话并发写入冲突，请刷新后重试。", 409);
    if (error.code === "P2025") throw new ConversationRepositoryError("not_found", "会话不存在。", 404);
  }
  throw new ConversationRepositoryError("unavailable", "服务端会话存储暂不可用。", 503);
}

function validateExpectedRevision(value: number) {
  if (!Number.isInteger(value) || value < 0) throw new ConversationRepositoryError("invalid_input", "会话版本无效。", 400);
}

async function claimRevision(tx: TransactionClient, workspaceId: string, conversationId: string, expectedRevision: number) {
  validateExpectedRevision(expectedRevision);
  const claimed = await tx.conversation.updateMany({
    where: { workspaceId, id: conversationId, revision: expectedRevision, deletedAt: null },
    data: { revision: { increment: 1 }, updatedAt: new Date() },
  });
  if (claimed.count !== 1) {
    const exists = await tx.conversation.count({ where: { workspaceId, id: conversationId, deletedAt: null } });
    throw new ConversationRepositoryError(exists ? "conflict" : "not_found", exists ? "会话已发生变化，请刷新后重试。" : "会话不存在。", exists ? 409 : 404);
  }
}

async function getRequiredConversation(tx: TransactionClient, workspaceId: string, conversationId: string) {
  const record = await tx.conversation.findUnique({ where: { workspaceId_id: { workspaceId, id: conversationId } }, ...conversationWithMessages });
  if (!record || record.deletedAt) throw new ConversationRepositoryError("not_found", "会话不存在。", 404);
  return record;
}

async function enforceMessageLimit(tx: TransactionClient, workspaceId: string, conversationId: string) {
  const excess = await tx.message.findMany({
    where: { workspaceId, conversationId },
    orderBy: { messageOrder: "asc" },
    take: Math.max(0, await tx.message.count({ where: { workspaceId, conversationId } }) - MAX_CONVERSATION_MESSAGES),
    select: { id: true },
  });
  if (excess.length) await tx.message.deleteMany({ where: { workspaceId, conversationId, id: { in: excess.map((item) => item.id) } } });
}

async function readResult(tx: TransactionClient, workspaceId: string, conversationId: string) {
  return toConversation(await getRequiredConversation(tx, workspaceId, conversationId));
}

export class PrismaConversationRepository implements ConversationRepository {
  constructor(private readonly workspaceId: string, private readonly prisma = getPrismaClient()) {}

  async list() {
    try {
      const records = await this.prisma.conversation.findMany({
        where: { workspaceId: this.workspaceId, deletedAt: null },
        orderBy: { updatedAt: "desc" },
        take: MAX_CONVERSATIONS,
        ...conversationWithMessages,
      });
      return records.map(toConversation);
    } catch (error) {
      return translatePrismaError(error);
    }
  }

  async get(id: string) {
    try {
      const record = await this.prisma.conversation.findUnique({ where: { workspaceId_id: { workspaceId: this.workspaceId, id } }, ...conversationWithMessages });
      return record && !record.deletedAt ? toConversation(record) : null;
    } catch (error) {
      return translatePrismaError(error);
    }
  }

  async create(input: CreateConversationInput = {}) {
    const now = input.createdAt ? new Date(input.createdAt) : new Date();
    if (!Number.isFinite(now.valueOf())) throw new ConversationRepositoryError("invalid_input", "会话创建时间无效。", 400);
    const title = input.title === undefined ? null : validateManualConversationTitle(input.title);
    if (title && !title.ok) throw new ConversationRepositoryError("invalid_input", title.error, 400);
    const id = input.id ?? `conversation-${crypto.randomUUID()}`;
    if (!id || id.length > 128) throw new ConversationRepositoryError("invalid_input", "会话标识无效。", 400);
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.conversation.create({
          data: {
            workspaceId: this.workspaceId,
            id,
            title: title?.ok ? title.title : DEFAULT_CONVERSATION_TITLE,
            titleSource: title?.ok ? "manual" : "auto",
            createdAt: now,
            updatedAt: now,
          },
        });
        const overflow = await tx.conversation.findMany({
          where: { workspaceId: this.workspaceId, deletedAt: null },
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
          skip: MAX_CONVERSATIONS,
          select: { id: true },
        });
        if (overflow.length) await tx.conversation.updateMany({ where: { workspaceId: this.workspaceId, id: { in: overflow.map((item) => item.id) } }, data: { deletedAt: new Date() } });
        return readResult(tx, this.workspaceId, id);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      return translatePrismaError(error);
    }
  }

  async rename(input: { conversationId: string; expectedRevision: number; title: string }) {
    const title = validateManualConversationTitle(input.title);
    if (!title.ok) throw new ConversationRepositoryError("invalid_input", title.error, 400);
    try {
      return await this.prisma.$transaction(async (tx) => {
        await claimRevision(tx, this.workspaceId, input.conversationId, input.expectedRevision);
        await tx.conversation.update({ where: { workspaceId_id: { workspaceId: this.workspaceId, id: input.conversationId } }, data: { title: title.title, titleSource: "manual" } });
        return readResult(tx, this.workspaceId, input.conversationId);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      return translatePrismaError(error);
    }
  }

  async clear(input: { conversationId: string; expectedRevision: number }) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await claimRevision(tx, this.workspaceId, input.conversationId, input.expectedRevision);
        await tx.message.deleteMany({ where: { workspaceId: this.workspaceId, conversationId: input.conversationId } });
        await tx.conversation.update({ where: { workspaceId_id: { workspaceId: this.workspaceId, id: input.conversationId } }, data: { title: DEFAULT_CONVERSATION_TITLE, titleSource: "auto", conversationSummary: Prisma.DbNull } });
        return readResult(tx, this.workspaceId, input.conversationId);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      return translatePrismaError(error);
    }
  }

  async remove(input: { conversationId: string; expectedRevision: number }) {
    try {
      await this.prisma.$transaction(async (tx) => {
        await claimRevision(tx, this.workspaceId, input.conversationId, input.expectedRevision);
        await tx.conversation.update({ where: { workspaceId_id: { workspaceId: this.workspaceId, id: input.conversationId } }, data: { deletedAt: new Date(), conversationSummary: Prisma.DbNull } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      return translatePrismaError(error);
    }
  }

  async appendTurn(input: AppendConversationTurnInput) {
    return this.appendPersistedTurn({
      conversationId: input.conversationId,
      expectedRevision: input.expectedRevision,
      ...createPersistedTurnPayload(input.question, input.result),
      conversationSummaryPatch: input.conversationSummaryPatch,
    });
  }

  async appendPersistedTurn(input: PersistedAppendInput) {
    const userMessage = sanitizePersistedMessage(input.userMessage, "user");
    const assistantMessage = sanitizePersistedMessage(input.assistantMessage, "assistant");
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (assistantMessage.runId) {
          const duplicate = await tx.message.findFirst({ where: { workspaceId: this.workspaceId, conversationId: input.conversationId, role: MessageRole.ASSISTANT, runId: assistantMessage.runId } });
          if (duplicate) {
            const current = toConversation(await getRequiredConversation(tx, this.workspaceId, input.conversationId));
            if (isIdempotentAppendRetry(current, input.expectedRevision, userMessage, assistantMessage, input.conversationSummaryPatch)) return current;
            throw new ConversationRepositoryError("conflict", "运行标识已用于不同的会话写入。", 409);
          }
        }
        await claimRevision(tx, this.workspaceId, input.conversationId, input.expectedRevision);
        const current = await getRequiredConversation(tx, this.workspaceId, input.conversationId);
        const nextOrder = (current.messages.at(-1)?.messageOrder ?? -1) + 1;
        const resultingMessages = [...current.messages.map(toMessage), userMessage, assistantMessage].slice(-MAX_CONVERSATION_MESSAGES);
        await tx.message.createMany({ data: [
          messageCreateData(this.workspaceId, input.conversationId, userMessage, nextOrder),
          messageCreateData(this.workspaceId, input.conversationId, assistantMessage, nextOrder + 1),
        ] });
        const summary = summaryData(input.conversationSummaryPatch, resultingMessages);
        await tx.conversation.update({
          where: { workspaceId_id: { workspaceId: this.workspaceId, id: input.conversationId } },
          data: {
            title: current.titleSource !== "manual" && !current.messages.some((message) => message.role === MessageRole.USER) ? generateConversationTitle(userMessage.content) : undefined,
            conversationSummary: summary,
          },
        });
        await enforceMessageLimit(tx, this.workspaceId, input.conversationId);
        return readResult(tx, this.workspaceId, input.conversationId);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      return translatePrismaError(error);
    }
  }

  async regenerateLastAssistant(input: RegenerateConversationInput) {
    const assistantMessage = createCompletedAssistantMessage(input.result, new Date().toISOString(), `message-${crypto.randomUUID()}`);
    return this.regeneratePersistedAssistant({ ...input, assistantMessage });
  }

  async regeneratePersistedAssistant(input: PersistedRegenerateInput) {
    const assistantMessage = sanitizePersistedMessage(input.assistantMessage, "assistant");
    if (!assistantMessage.runId) throw new ConversationRepositoryError("invalid_input", "重生成回答必须包含新的运行标识。", 400);
    try {
      return await this.prisma.$transaction(async (tx) => {
        await claimRevision(tx, this.workspaceId, input.conversationId, input.expectedRevision);
        const current = await getRequiredConversation(tx, this.workspaceId, input.conversationId);
        const tail = current.messages.at(-1);
        const user = current.messages.at(-2);
        if (!tail || tail.role !== MessageRole.ASSISTANT || user?.role !== MessageRole.USER || tail.id !== input.expectedAssistantMessageId) {
          throw new ConversationRepositoryError("conflict", "会话尾部已发生变化，请刷新后重试。", 409);
        }
        if (current.messages.some((message) => message.role === MessageRole.ASSISTANT && message.runId === assistantMessage.runId)) {
          throw new ConversationRepositoryError("conflict", "新的运行标识已被使用。", 409);
        }
        const resultingMessages = [...current.messages.slice(0, -1).map(toMessage), assistantMessage];
        const summary = summaryData(input.conversationSummaryPatch, resultingMessages);
        await tx.message.delete({ where: { workspaceId_id: { workspaceId: this.workspaceId, id: tail.id } } });
        await tx.message.create({ data: messageCreateData(this.workspaceId, input.conversationId, assistantMessage, tail.messageOrder) });
        if (summary !== undefined) await tx.conversation.update({ where: { workspaceId_id: { workspaceId: this.workspaceId, id: input.conversationId } }, data: { conversationSummary: summary } });
        return readResult(tx, this.workspaceId, input.conversationId);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      return translatePrismaError(error);
    }
  }

  async editAndResendLastTurn(input: EditAndResendConversationInput) {
    const turn: PersistedTurnPayload = createPersistedTurnPayload(input.question, input.result);
    return this.editAndResendPersistedTurn({ ...input, ...turn });
  }

  async editAndResendPersistedTurn(input: PersistedEditAndResendInput) {
    const userMessage = sanitizePersistedMessage(input.userMessage, "user");
    const assistantMessage = sanitizePersistedMessage(input.assistantMessage, "assistant");
    if (!assistantMessage.runId) throw new ConversationRepositoryError("invalid_input", "编辑重发回答必须包含新的运行标识。", 400);
    try {
      return await this.prisma.$transaction(async (tx) => {
        await claimRevision(tx, this.workspaceId, input.conversationId, input.expectedRevision);
        const current = await getRequiredConversation(tx, this.workspaceId, input.conversationId);
        const tail = current.messages.at(-1);
        const user = current.messages.at(-2);
        if (!tail || tail.role !== MessageRole.ASSISTANT || user?.role !== MessageRole.USER || tail.id !== input.expectedAssistantMessageId || user.id !== input.expectedUserMessageId) {
          throw new ConversationRepositoryError("conflict", "会话尾部已发生变化，请刷新后重试。", 409);
        }
        if (current.messages.some((message) => message.role === MessageRole.ASSISTANT && message.runId === assistantMessage.runId)) {
          throw new ConversationRepositoryError("conflict", "新的运行标识已被使用。", 409);
        }
        const resultingMessages = [...current.messages.slice(0, -2).map(toMessage), userMessage, assistantMessage];
        const summary = summaryData(input.conversationSummaryPatch, resultingMessages);
        await tx.message.deleteMany({ where: { workspaceId: this.workspaceId, conversationId: input.conversationId, messageOrder: { gte: user.messageOrder } } });
        await tx.message.createMany({ data: [
          messageCreateData(this.workspaceId, input.conversationId, userMessage, user.messageOrder),
          messageCreateData(this.workspaceId, input.conversationId, assistantMessage, user.messageOrder + 1),
        ] });
        await tx.conversation.update({
          where: { workspaceId_id: { workspaceId: this.workspaceId, id: input.conversationId } },
          data: {
            title: current.titleSource !== "manual" && !current.messages.slice(0, -2).some((message) => message.role === MessageRole.USER) ? generateConversationTitle(userMessage.content) : undefined,
            conversationSummary: summary,
          },
        });
        return readResult(tx, this.workspaceId, input.conversationId);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      return translatePrismaError(error);
    }
  }
}
