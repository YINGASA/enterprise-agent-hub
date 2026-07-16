import { describe, expect, it, vi } from "vitest";
import { KnowledgeSourceType } from "@prisma/client";
import { createKnowledgeChecksum, knowledgeChunkCreateData, PrismaKnowledgeRepository } from "@/lib/server-storage/knowledgeRepository";
import { sanitizeKnowledgeDocumentUpdate } from "@/lib/storage/knowledgeRepository";
import type { ImportedKnowledgeDocument } from "@/types";

const now = new Date("2026-07-16T00:00:00.000Z");

function document(): ImportedKnowledgeDocument {
  return {
    id: "doc-1", title: "退款规则", category: "售后", tags: ["退款"], summary: "退款摘要", content: "订单签收后 7 天内可以申请退款。",
    createdAt: now.toISOString(), updatedAt: now.toISOString(), importedAt: now.toISOString(), sourceType: "user_paste", isDefault: false, enabled: true,
  };
}

function record() {
  return {
    workspaceId: "ws-1", id: "doc-1", title: "退款规则", content: "订单签收后 7 天内可以申请退款。", sourceType: KnowledgeSourceType.USER_PASTE,
    enabled: true, tags: ["退款"], metadata: {}, checksum: createKnowledgeChecksum(document()), category: "售后", summary: "退款摘要", packId: null,
    originalFileName: null, importedAt: now, suggestedQuestions: [], createdAt: now, updatedAt: now,
  };
}

describe("PrismaKnowledgeRepository", () => {
  it("uses SHA-256 checksums and strict update whitelisting", () => {
    const base = document();
    const checksum = createKnowledgeChecksum(base);
    expect(checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(checksum).toBe(createKnowledgeChecksum({ ...base }));
    for (const changed of [
      { ...base, enabled: false },
      { ...base, summary: "更新摘要" },
      { ...base, sourceType: "user_upload" as const },
      { ...base, packId: "pack-2" },
      { ...base, originalFileName: "policy.txt" },
      { ...base, suggestedQuestions: ["如何退款？"] },
      { ...base, updatedAt: "2026-07-16T00:00:01.000Z" },
    ]) expect(createKnowledgeChecksum(changed)).not.toBe(checksum);
    expect(sanitizeKnowledgeDocumentUpdate({ enabled: false })).toEqual(expect.objectContaining({ enabled: false }));
    expect(sanitizeKnowledgeDocumentUpdate({ enabled: false, workspaceId: "other" })).toBeNull();
    expect(sanitizeKnowledgeDocumentUpdate({ content: "x".repeat(120_001) })).toBeNull();
  });

  it("creates stable database chunk ids within the 128 character schema limit", () => {
    const longIdDocument = { ...document(), id: "d".repeat(128), content: "第一段\n第二段" };
    const first = knowledgeChunkCreateData("ws-1", longIdDocument);
    const second = knowledgeChunkCreateData("ws-1", longIdDocument);
    expect(first.map((chunk) => chunk.id)).toEqual(second.map((chunk) => chunk.id));
    expect(new Set(first.map((chunk) => chunk.id)).size).toBe(first.length);
    expect(first.every((chunk) => chunk.id.length <= 128)).toBe(true);
  });

  it("scopes list/get/remove to the resolved workspace", async () => {
    const prisma = {
      knowledgeDocument: {
        findMany: vi.fn().mockResolvedValue([record()]),
        findUnique: vi.fn().mockResolvedValue(record()),
        delete: vi.fn().mockResolvedValue(record()),
      },
      knowledgeChunk: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const repository = new PrismaKnowledgeRepository("ws-1", prisma as never);
    await repository.list();
    await repository.get("doc-1");
    await repository.remove("doc-1");
    expect(prisma.knowledgeDocument.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { workspaceId: "ws-1" } }));
    expect(prisma.knowledgeDocument.findUnique).toHaveBeenCalledWith({ where: { workspaceId_id: { workspaceId: "ws-1", id: "doc-1" } } });
    expect(prisma.knowledgeDocument.delete).toHaveBeenCalledWith({ where: { workspaceId_id: { workspaceId: "ws-1", id: "doc-1" } } });
  });

  it("creates the document, rebuilt chunks and import job in one transaction", async () => {
    const tx = {
      knowledgeDocument: { count: vi.fn().mockResolvedValue(0), create: vi.fn().mockResolvedValue(record()) },
      knowledgeChunk: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
      importJob: { create: vi.fn().mockResolvedValue({}) },
    };
    const prisma = { $transaction: vi.fn(async (operation: (client: typeof tx) => unknown, _options?: unknown) => operation(tx)) };
    const repository = new PrismaKnowledgeRepository("ws-1", prisma as never);
    await expect(repository.create(document())).resolves.toMatchObject({ id: "doc-1" });
    expect(tx.knowledgeDocument.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ workspaceId: "ws-1", checksum: expect.stringMatching(/^[a-f0-9]{64}$/) }) }));
    expect(tx.knowledgeChunk.createMany).toHaveBeenCalledWith({ data: [expect.objectContaining({ workspaceId: "ws-1", documentId: "doc-1", chunkIndex: 1 })] });
    expect(tx.importJob.create).toHaveBeenCalledWith({ data: expect.objectContaining({ workspaceId: "ws-1", documentId: "doc-1" }) });
    expect(prisma.$transaction.mock.calls[0]?.[1]).toMatchObject({ isolationLevel: "Serializable" });
  });

  it("updates only supplied document fields and does not rebuild chunks for enabled-only changes", async () => {
    const update = vi.fn().mockResolvedValue({ ...record(), enabled: false });
    const tx = {
      knowledgeDocument: { findUnique: vi.fn().mockResolvedValue(record()), update },
      knowledgeChunk: { deleteMany: vi.fn(), createMany: vi.fn() },
    };
    const prisma = { $transaction: vi.fn(async (operation: (client: typeof tx) => unknown, _options?: unknown) => operation(tx)) };
    const repository = new PrismaKnowledgeRepository("ws-1", prisma as never);
    await expect(repository.update("doc-1", { enabled: false })).resolves.toMatchObject({ id: "doc-1", enabled: false });
    const data = update.mock.calls[0]?.[0]?.data;
    expect(data).toMatchObject({ enabled: false, checksum: expect.stringMatching(/^[a-f0-9]{64}$/), updatedAt: expect.any(Date) });
    expect(data).not.toHaveProperty("title");
    expect(data).not.toHaveProperty("content");
    expect(data).not.toHaveProperty("metadata");
    expect(data).not.toHaveProperty("importedAt");
    expect(tx.knowledgeChunk.deleteMany).not.toHaveBeenCalled();
    expect(prisma.$transaction.mock.calls[0]?.[1]).toMatchObject({ isolationLevel: "Serializable" });
  });

  it("replaces a workspace knowledge backup atomically and rebuilds all chunks", async () => {
    const restored = { ...document(), id: "doc-restored", summary: "", packId: undefined, originalFileName: undefined };
    const restoredRecord = {
      ...record(), id: restored.id, summary: "", metadata: { source: "pasted text", owner: "用户导入" }, checksum: createKnowledgeChecksum(restored),
    };
    const tx = {
      importJob: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }), create: vi.fn().mockResolvedValue({}) },
      knowledgeDocument: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }), create: vi.fn().mockResolvedValue(restoredRecord) },
      knowledgeChunk: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    const prisma = { $transaction: vi.fn(async (operation: (client: typeof tx) => unknown, _options?: unknown) => operation(tx)) };
    const repository = new PrismaKnowledgeRepository("ws-1", prisma as never);
    await expect(repository.replaceAll([restored])).resolves.toEqual([expect.objectContaining({ id: "doc-restored", summary: "", owner: "用户导入", packId: undefined, originalFileName: undefined })]);
    expect(tx.importJob.deleteMany).toHaveBeenCalledWith({ where: { workspaceId: "ws-1" } });
    expect(tx.knowledgeDocument.deleteMany).toHaveBeenCalledWith({ where: { workspaceId: "ws-1" } });
    expect(tx.knowledgeDocument.create).toHaveBeenCalledWith({ data: expect.objectContaining({ workspaceId: "ws-1", id: "doc-restored", summary: "", packId: undefined, originalFileName: undefined, metadata: { source: "pasted text", owner: "用户导入" } }) });
    expect(tx.knowledgeChunk.createMany).toHaveBeenCalledWith({ data: [expect.objectContaining({ workspaceId: "ws-1", documentId: "doc-restored" })] });
    expect(prisma.$transaction.mock.calls[0]?.[1]).toMatchObject({ isolationLevel: "Serializable" });
  });

  it("does not expose a partial restore when the transaction fails", async () => {
    const prisma = { $transaction: vi.fn().mockRejectedValue(new Error("database failed")) };
    const repository = new PrismaKnowledgeRepository("ws-1", prisma as never);
    await expect(repository.replaceAll([document()])).rejects.toMatchObject({ status: 503, code: "server_storage_unavailable" });
  });
});
