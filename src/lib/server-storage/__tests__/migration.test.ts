import { describe, expect, it, vi } from "vitest";
import { createStorageMigrationFingerprint, executeStorageMigration, previewStorageMigration, sanitizeStorageMigrationInput } from "@/lib/server-storage/migration";

const now = "2026-07-16T00:00:00.000Z";

function conversation(id = "conversation-1") {
  return {
    id, title: "退款咨询", titleSource: "manual", createdAt: now, updatedAt: now, revision: 2, schemaVersion: 1,
    messages: [
      { id: `${id}-u`, role: "user", content: "订单 10001 能退款吗？", createdAt: now },
      { id: `${id}-a`, role: "assistant", content: "符合条件可以退款。", createdAt: now, runId: "run-1" },
    ],
  };
}

function knowledgeDocument(id = "doc-1") {
  return {
    id, title: "退款规则", category: "售后", tags: ["退款"], summary: "退款摘要", content: "订单签收后 7 天内可以申请退款。",
    createdAt: now, updatedAt: now, importedAt: now, sourceType: "user_paste", isDefault: false, enabled: true,
  };
}

describe("server storage migration", () => {
  it("sanitizes legacy-compatible records and never accepts a client workspace id", () => {
    expect(sanitizeStorageMigrationInput({ migrationId: "migration-1", workspaceId: "other" })).toMatchObject({ ok: false, error: "workspace_not_allowed" });
    const result = sanitizeStorageMigrationInput({ migrationId: "migration-1", conversations: [conversation(), { id: "bad" }], knowledgeDocuments: [knowledgeDocument()] });
    expect(result).toMatchObject({ ok: true, input: { migrationId: "migration-1", invalidCount: 1 } });
    if (result.ok) {
      expect(result.input.conversations[0]?.messages).toHaveLength(2);
      expect(result.input.knowledgeDocuments[0]).toMatchObject({ id: "doc-1", enabled: true });
    }
  });

  it("rejects oversized packages before database work", () => {
    expect(sanitizeStorageMigrationInput({ migrationId: "m", conversations: Array.from({ length: 11 }, (_, index) => conversation(`c-${index}`)) })).toMatchObject({ ok: false, status: 413 });
    expect(sanitizeStorageMigrationInput({ migrationId: "x".repeat(129) })).toMatchObject({ ok: false, status: 413 });
    expect(sanitizeStorageMigrationInput({
      migrationId: "too-many-messages",
      conversations: [{
        ...conversation(),
        messages: Array.from({ length: 101 }, (_, index) => ({ id: `message-${index}`, role: "user", content: `message ${index}`, createdAt: now })),
      }],
    })).toMatchObject({ ok: false, status: 413, error: "migration_messages_exceeded" });
  });

  it("counts malformed messages and unsafe record ids instead of silently repairing them", () => {
    const malformedMessage = {
      ...conversation("bad-message"),
      messages: [{ id: "bad-message-id", role: "system", content: "unsafe", createdAt: now }],
    };
    const emptyMessageId = {
      ...conversation("empty-message-id"),
      messages: [{ id: "   ", role: "user", content: "question", createdAt: now }],
    };
    const longMessageId = {
      ...conversation("long-message-id"),
      messages: [{ id: "m".repeat(129), role: "user", content: "question", createdAt: now }],
    };
    const result = sanitizeStorageMigrationInput({
      migrationId: "strict-records",
      conversations: [
        malformedMessage,
        emptyMessageId,
        longMessageId,
        { ...conversation(), id: "" },
        { ...conversation(), id: "c".repeat(129) },
      ],
    });

    expect(result).toMatchObject({
      ok: true,
      input: { conversations: [], invalidConversationCount: 5, invalidCount: 5 },
    });
  });

  it("keeps a valid conversation while dropping only its damaged summary", () => {
    const result = sanitizeStorageMigrationInput({
      migrationId: "damaged-summary",
      conversations: [{
        ...conversation(),
        conversationSummary: {
          text: "old summary",
          throughMessageId: "missing-message",
          updatedAt: now,
          version: 1,
          sourceMessageCount: 2,
        },
      }],
    });

    expect(result).toMatchObject({ ok: true, input: { invalidCount: 0 } });
    if (result.ok) {
      expect(result.input.conversations).toHaveLength(1);
      expect(result.input.conversations[0]?.conversationSummary).toBeUndefined();
      expect(result.input.conversations[0]?.messages).toHaveLength(2);
    }
  });

  it("previews server-wins conflicts without exposing record bodies", async () => {
    const prisma = {
      conversation: { count: vi.fn().mockResolvedValue(1), findMany: vi.fn().mockResolvedValue([{ ...conversation(), createdAt: new Date(now), updatedAt: new Date(now), conversationSummary: null, messages: [] }]) },
      message: { findMany: vi.fn().mockResolvedValue([]) },
      knowledgeDocument: { count: vi.fn().mockResolvedValue(1), findMany: vi.fn().mockResolvedValue([{ id: "doc-1", checksum: "different" }]) },
    };
    const validated = sanitizeStorageMigrationInput({ migrationId: "migration-1", conversations: [conversation()], knowledgeDocuments: [knowledgeDocument()] });
    if (!validated.ok) throw new Error("fixture invalid");
    const result = await previewStorageMigration("ws-1", validated.input, prisma as never);
    expect(result).toMatchObject({ imported: 0, conflicted: 2, status: "conflict" });
    expect(JSON.stringify(result)).not.toContain("订单 10001");
    expect(prisma.conversation.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ workspaceId: "ws-1" }) }));
  });

  it("returns a completed migration result idempotently", async () => {
    const storedResult = {
      migrationId: "migration-1", status: "completed", imported: 1, skipped: 0, conflicted: 0, failed: 0,
      conversations: { imported: 1, skipped: 0, conflicted: 0, failed: 0 }, knowledgeDocuments: { imported: 0, skipped: 0, conflicted: 0, failed: 0 },
    };
    const validated = sanitizeStorageMigrationInput({ migrationId: "migration-1", conversations: [conversation()] });
    if (!validated.ok) throw new Error("fixture invalid");
    const prisma = { storageMigration: { findUnique: vi.fn().mockResolvedValue({ result: { ...storedResult, payloadFingerprint: createStorageMigrationFingerprint(validated.input) } }) }, $transaction: vi.fn() };
    await expect(executeStorageMigration("ws-1", validated.input, prisma as never)).resolves.toEqual({ ...storedResult, idempotent: true });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects reuse of a migration id for a different payload", async () => {
    const original = sanitizeStorageMigrationInput({ migrationId: "migration-1", conversations: [conversation()] });
    const changed = sanitizeStorageMigrationInput({ migrationId: "migration-1", conversations: [conversation("conversation-2")] });
    if (!original.ok || !changed.ok) throw new Error("fixture invalid");
    const storedResult = {
      migrationId: "migration-1", status: "completed", imported: 1, skipped: 0, conflicted: 0, failed: 0,
      conversations: { imported: 1, skipped: 0, conflicted: 0, failed: 0 }, knowledgeDocuments: { imported: 0, skipped: 0, conflicted: 0, failed: 0 },
      payloadFingerprint: createStorageMigrationFingerprint(original.input),
    };
    const prisma = { storageMigration: { findUnique: vi.fn().mockResolvedValue({ result: storedResult }) }, $transaction: vi.fn() };
    await expect(executeStorageMigration("ws-1", changed.input, prisma as never)).rejects.toMatchObject({ code: "id_conflict", status: 409 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each(["P2002", "P2034"])("reconciles a concurrent %s migration as an idempotent result", async (code) => {
    const validated = sanitizeStorageMigrationInput({ migrationId: "migration-race", conversations: [conversation()] });
    if (!validated.ok) throw new Error("fixture invalid");
    const storedResult = {
      migrationId: "migration-race", status: "completed", imported: 1, skipped: 0, conflicted: 0, failed: 0,
      conversations: { imported: 1, skipped: 0, conflicted: 0, failed: 0 }, knowledgeDocuments: { imported: 0, skipped: 0, conflicted: 0, failed: 0 },
      payloadFingerprint: createStorageMigrationFingerprint(validated.input),
    };
    const findUnique = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ result: storedResult });
    const prisma = {
      storageMigration: { findUnique },
      $transaction: vi.fn().mockRejectedValue({ code }),
    };

    await expect(executeStorageMigration("ws-1", validated.input, prisma as never)).resolves.toMatchObject({
      migrationId: "migration-race",
      imported: 1,
      idempotent: true,
    });
    expect(findUnique).toHaveBeenCalledTimes(2);
  });

  it("rejects a concurrent migration result with a different payload fingerprint", async () => {
    const original = sanitizeStorageMigrationInput({ migrationId: "migration-race", conversations: [conversation()] });
    const concurrent = sanitizeStorageMigrationInput({ migrationId: "migration-race", conversations: [conversation("different")] });
    if (!original.ok || !concurrent.ok) throw new Error("fixture invalid");
    const storedResult = {
      migrationId: "migration-race", status: "completed", imported: 1, skipped: 0, conflicted: 0, failed: 0,
      conversations: { imported: 1, skipped: 0, conflicted: 0, failed: 0 }, knowledgeDocuments: { imported: 0, skipped: 0, conflicted: 0, failed: 0 },
      payloadFingerprint: createStorageMigrationFingerprint(concurrent.input),
    };
    const prisma = {
      storageMigration: { findUnique: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ result: storedResult }) },
      $transaction: vi.fn().mockRejectedValue({ code: "P2002" }),
    };

    await expect(executeStorageMigration("ws-1", original.input, prisma as never)).rejects.toMatchObject({
      code: "id_conflict",
      status: 409,
    });
  });

  it("bounds concurrent migration reconciliation when no committed result appears", async () => {
    const validated = sanitizeStorageMigrationInput({ migrationId: "migration-busy", conversations: [conversation()] });
    if (!validated.ok) throw new Error("fixture invalid");
    const findUnique = vi.fn().mockResolvedValue(null);
    const prisma = {
      storageMigration: { findUnique },
      $transaction: vi.fn().mockRejectedValue({ code: "P2034" }),
    };

    await expect(executeStorageMigration("ws-1", validated.input, prisma as never)).rejects.toMatchObject({
      code: "revision_conflict",
      status: 409,
      retryable: true,
    });
    expect(findUnique).toHaveBeenCalledTimes(5);
  });

  it("treats JSON objects with different key order as the same conversation", async () => {
    const messages = Array.from({ length: 5 }, (_, index) => {
      const turn = index + 1;
      return [
        { id: `conversation-1-u-${turn}`, role: "user" as const, content: `问题 ${turn}`, createdAt: now },
        { id: `conversation-1-a-${turn}`, role: "assistant" as const, content: `回答 ${turn}`, createdAt: now, runId: `run-${turn}`, ...(turn === 1 ? { details: { riskLevel: "low" as const, needsClarification: false, confidence: 0.8 } } : {}) },
      ];
    }).flat();
    const migrated = {
      ...conversation(),
      conversationSummary: { text: "摘要", throughMessageId: "conversation-1-a-1", updatedAt: now, version: 1 as const, sourceMessageCount: 2 },
      messages,
    };
    const stored = {
      ...migrated,
      createdAt: new Date(now),
      updatedAt: new Date(now),
      conversationSummary: { version: 1, updatedAt: now, sourceMessageCount: 2, throughMessageId: "conversation-1-a-1", text: "摘要" },
      messages: migrated.messages.map((message) => ({
        ...message,
        role: message.role === "user" ? "USER" : "ASSISTANT",
        createdAt: new Date(message.createdAt),
        runId: "runId" in message ? message.runId : null,
        responseMode: null,
        intent: null,
        scenario: null,
        assistantDetails: message.role === "assistant" && message.id === "conversation-1-a-1" ? { details: { confidence: 0.8, needsClarification: false, riskLevel: "low" } } : null,
      })),
    };
    const validated = sanitizeStorageMigrationInput({ migrationId: "migration-order", conversations: [migrated] });
    if (!validated.ok) throw new Error("fixture invalid");
    const prisma = {
      conversation: { count: vi.fn().mockResolvedValue(1), findMany: vi.fn().mockResolvedValue([stored]) },
      message: { findMany: vi.fn().mockResolvedValue([]) },
      knowledgeDocument: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
    };
    await expect(previewStorageMigration("ws-1", validated.input, prisma as never)).resolves.toMatchObject({ skipped: 1, conflicted: 0 });
  });
});
