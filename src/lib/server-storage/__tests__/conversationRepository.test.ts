import { MessageRole } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { PrismaConversationRepository } from "@/lib/server-storage/conversationRepository";

const now = new Date("2026-07-16T00:00:00.000Z");

function record(overrides: Record<string, unknown> = {}) {
  return {
    workspaceId: "workspace-a",
    id: "conversation-a",
    title: "会话",
    titleSource: "auto",
    createdAt: now,
    updatedAt: now,
    revision: 0,
    schemaVersion: 1,
    conversationSummary: null,
    deletedAt: null,
    messages: [],
    ...overrides,
  };
}

describe("PrismaConversationRepository", () => {
  it("scopes list and get queries to the resolved workspace", async () => {
    const findMany = vi.fn().mockResolvedValue([record()]);
    const findUnique = vi.fn().mockResolvedValue(record());
    const prisma = { conversation: { findMany, findUnique } };
    const repository = new PrismaConversationRepository("workspace-a", prisma as never);
    await expect(repository.list()).resolves.toEqual([expect.objectContaining({ id: "conversation-a", revision: 0 })]);
    await expect(repository.get("conversation-a")).resolves.toEqual(expect.objectContaining({ id: "conversation-a" }));
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { workspaceId: "workspace-a", deletedAt: null } }));
    expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { workspaceId_id: { workspaceId: "workspace-a", id: "conversation-a" } } }));
  });

  it("returns a 409 CAS conflict before writing messages or summary", async () => {
    const createMany = vi.fn();
    const tx = {
      conversation: { updateMany: vi.fn().mockResolvedValue({ count: 0 }), count: vi.fn().mockResolvedValue(1) },
      message: { findFirst: vi.fn().mockResolvedValue(null), createMany },
    };
    const prisma = { $transaction: vi.fn(async (operation: (client: typeof tx) => unknown) => operation(tx)) };
    const repository = new PrismaConversationRepository("workspace-a", prisma as never);
    await expect(repository.appendPersistedTurn({
      conversationId: "conversation-a",
      expectedRevision: 3,
      userMessage: { id: "u-1", role: "user", content: "问题", createdAt: now.toISOString() },
      assistantMessage: { id: "a-1", role: "assistant", content: "回答", createdAt: now.toISOString(), runId: "run-1" },
      conversationSummaryPatch: { clear: true },
    })).rejects.toMatchObject({ code: "conflict", status: 409 });
    expect(createMany).not.toHaveBeenCalled();
  });

  it("writes a complete turn and summary in one serializable transaction with stable order", async () => {
    const history = Array.from({ length: 5 }, (_, index) => [
      { workspaceId: "workspace-a", conversationId: "conversation-a", id: `u-${index}`, role: MessageRole.USER, content: `问题${index}`, createdAt: now, runId: null, responseMode: null, intent: null, scenario: null, assistantDetails: null, messageOrder: index * 2 },
      { workspaceId: "workspace-a", conversationId: "conversation-a", id: `a-${index}`, role: MessageRole.ASSISTANT, content: `回答${index}`, createdAt: now, runId: `old-run-${index}`, responseMode: "mock", intent: null, scenario: null, assistantDetails: null, messageOrder: index * 2 + 1 },
    ]).flat();
    const before = record({
      revision: 1,
      messages: history,
    });
    const after = record({ revision: 2, conversationSummary: { text: "摘要", throughMessageId: "a-0", updatedAt: now.toISOString(), version: 1, sourceMessageCount: 2 }, messages: before.messages });
    const findUnique = vi.fn().mockResolvedValueOnce(before).mockResolvedValueOnce(after);
    const createMany = vi.fn().mockResolvedValue({ count: 2 });
    const tx = {
      conversation: { updateMany: vi.fn().mockResolvedValue({ count: 1 }), findUnique, update: vi.fn().mockResolvedValue({}) },
      message: { findFirst: vi.fn().mockResolvedValue(null), createMany, count: vi.fn().mockResolvedValue(4), findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
    };
    const transaction = vi.fn(async (operation: (client: typeof tx) => unknown, _options?: unknown) => operation(tx));
    const repository = new PrismaConversationRepository("workspace-a", { $transaction: transaction } as never);
    await repository.appendPersistedTurn({
      conversationId: "conversation-a",
      expectedRevision: 1,
      userMessage: { id: "u-2", role: "user", content: "新问题", createdAt: now.toISOString() },
      assistantMessage: { id: "a-2", role: "assistant", content: "新回答", createdAt: now.toISOString(), runId: "run-2" },
      conversationSummaryPatch: { set: { text: "摘要", throughMessageId: "a-0", updatedAt: now.toISOString(), version: 1, sourceMessageCount: 2 } },
    });
    expect(transaction.mock.calls[0]?.[1]).toMatchObject({ isolationLevel: "Serializable" });
    expect(createMany).toHaveBeenCalledWith({ data: [expect.objectContaining({ workspaceId: "workspace-a", messageOrder: 10 }), expect.objectContaining({ workspaceId: "workspace-a", messageOrder: 11 })] });
    expect(tx.conversation.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ conversationSummary: expect.objectContaining({ text: "摘要" }) }) }));
  });

  it("accepts only an identical immediate append retry for the same run id", async () => {
    const user = { workspaceId: "workspace-a", conversationId: "conversation-a", id: "u-1", role: MessageRole.USER, content: "问题", createdAt: now, runId: null, responseMode: null, intent: null, scenario: null, assistantDetails: null, messageOrder: 0 };
    const assistant = { workspaceId: "workspace-a", conversationId: "conversation-a", id: "a-1", role: MessageRole.ASSISTANT, content: "回答", createdAt: now, runId: "run-1", responseMode: "mock", intent: null, scenario: null, assistantDetails: null, messageOrder: 1 };
    const current = record({ revision: 1, messages: [user, assistant] });
    const tx = {
      conversation: { findUnique: vi.fn().mockResolvedValue(current), updateMany: vi.fn() },
      message: { findFirst: vi.fn().mockResolvedValue(assistant), createMany: vi.fn() },
    };
    const prisma = { $transaction: vi.fn(async (operation: (client: typeof tx) => unknown) => operation(tx)) };
    const repository = new PrismaConversationRepository("workspace-a", prisma as never);
    await expect(repository.appendPersistedTurn({
      conversationId: "conversation-a",
      expectedRevision: 0,
      userMessage: { id: "u-1", role: "user", content: "问题", createdAt: now.toISOString() },
      assistantMessage: { id: "a-1", role: "assistant", content: "回答", createdAt: now.toISOString(), runId: "run-1", responseMode: "mock" },
    })).resolves.toMatchObject({ revision: 1, messages: [{ id: "u-1" }, { id: "a-1", runId: "run-1" }] });
    expect(tx.conversation.updateMany).not.toHaveBeenCalled();
    expect(tx.message.createMany).not.toHaveBeenCalled();
  });

  it("rejects a reused run id when the append payload differs", async () => {
    const user = { workspaceId: "workspace-a", conversationId: "conversation-a", id: "u-1", role: MessageRole.USER, content: "原问题", createdAt: now, runId: null, responseMode: null, intent: null, scenario: null, assistantDetails: null, messageOrder: 0 };
    const assistant = { workspaceId: "workspace-a", conversationId: "conversation-a", id: "a-1", role: MessageRole.ASSISTANT, content: "原回答", createdAt: now, runId: "run-1", responseMode: "mock", intent: null, scenario: null, assistantDetails: null, messageOrder: 1 };
    const tx = {
      conversation: { findUnique: vi.fn().mockResolvedValue(record({ revision: 1, messages: [user, assistant] })), updateMany: vi.fn() },
      message: { findFirst: vi.fn().mockResolvedValue(assistant), createMany: vi.fn() },
    };
    const prisma = { $transaction: vi.fn(async (operation: (client: typeof tx) => unknown) => operation(tx)) };
    const repository = new PrismaConversationRepository("workspace-a", prisma as never);
    await expect(repository.appendPersistedTurn({
      conversationId: "conversation-a",
      expectedRevision: 0,
      userMessage: { id: "u-2", role: "user", content: "不同问题", createdAt: now.toISOString() },
      assistantMessage: { id: "a-2", role: "assistant", content: "不同回答", createdAt: now.toISOString(), runId: "run-1", responseMode: "mock" },
    })).rejects.toMatchObject({ code: "conflict", status: 409 });
    expect(tx.conversation.updateMany).not.toHaveBeenCalled();
    expect(tx.message.createMany).not.toHaveBeenCalled();
  });

  it("rejects replay of an identical run that is no longer the latest turn", async () => {
    const oldUser = { workspaceId: "workspace-a", conversationId: "conversation-a", id: "u-1", role: MessageRole.USER, content: "旧问题", createdAt: now, runId: null, responseMode: null, intent: null, scenario: null, assistantDetails: null, messageOrder: 0 };
    const oldAssistant = { workspaceId: "workspace-a", conversationId: "conversation-a", id: "a-1", role: MessageRole.ASSISTANT, content: "旧回答", createdAt: now, runId: "run-1", responseMode: "mock", intent: null, scenario: null, assistantDetails: null, messageOrder: 1 };
    const latestUser = { ...oldUser, id: "u-2", content: "新问题", messageOrder: 2 };
    const latestAssistant = { ...oldAssistant, id: "a-2", content: "新回答", runId: "run-2", messageOrder: 3 };
    const tx = {
      conversation: { findUnique: vi.fn().mockResolvedValue(record({ revision: 1, messages: [oldUser, oldAssistant, latestUser, latestAssistant] })), updateMany: vi.fn() },
      message: { findFirst: vi.fn().mockResolvedValue(oldAssistant), createMany: vi.fn() },
    };
    const prisma = { $transaction: vi.fn(async (operation: (client: typeof tx) => unknown) => operation(tx)) };
    const repository = new PrismaConversationRepository("workspace-a", prisma as never);

    await expect(repository.appendPersistedTurn({
      conversationId: "conversation-a",
      expectedRevision: 0,
      userMessage: { id: "u-1", role: "user", content: "旧问题", createdAt: now.toISOString() },
      assistantMessage: { id: "a-1", role: "assistant", content: "旧回答", createdAt: now.toISOString(), runId: "run-1", responseMode: "mock" },
    })).rejects.toMatchObject({ code: "conflict", status: 409 });
    expect(tx.conversation.updateMany).not.toHaveBeenCalled();
    expect(tx.message.createMany).not.toHaveBeenCalled();
  });
});
