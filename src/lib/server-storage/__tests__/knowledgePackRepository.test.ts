import { describe, expect, it, vi } from "vitest";
import { ImportJobStatus, KnowledgePackStatus } from "@prisma/client";
import { PrismaKnowledgePackRepository } from "@/lib/server-storage/knowledgePackRepository";

const now = new Date("2026-07-17T00:00:00.000Z");
const record = {
  workspaceId: "ws-1",
  id: "pack-1",
  name: "售后制度",
  normalizedName: "售后制度",
  description: null,
  status: KnowledgePackStatus.ACTIVE,
  revision: 0,
  createdAt: now,
  updatedAt: now,
  _count: { documents: 2 },
};

describe("PrismaKnowledgePackRepository", () => {
  it("scopes list/get/create to one workspace and returns reliable document counts", async () => {
    const prisma = {
      knowledgePack: {
        findMany: vi.fn().mockResolvedValue([record]),
        findUnique: vi.fn().mockResolvedValue(record),
        create: vi.fn().mockResolvedValue(record),
      },
    };
    const repository = new PrismaKnowledgePackRepository("ws-1", prisma as never);
    await expect(repository.list()).resolves.toEqual([expect.objectContaining({ id: "pack-1", documentCount: 2 })]);
    await expect(repository.get("pack-1")).resolves.toMatchObject({ id: "pack-1" });
    await expect(repository.create({ name: " 售后制度 " })).resolves.toMatchObject({ id: "pack-1" });
    expect(prisma.knowledgePack.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { workspaceId: "ws-1" } }));
    expect(prisma.knowledgePack.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { workspaceId_id: { workspaceId: "ws-1", id: "pack-1" } } }));
    expect(prisma.knowledgePack.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ workspaceId: "ws-1", normalizedName: "售后制度" }) }));
  });

  it("updates by expected revision in a serializable transaction", async () => {
    const updated = { ...record, name: "售后流程", normalizedName: "售后流程", revision: 1 };
    const tx = {
      knowledgePack: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        count: vi.fn(),
        update: vi.fn().mockResolvedValue(updated),
        findUnique: vi.fn().mockResolvedValue(updated),
      },
    };
    const prisma = { $transaction: vi.fn(async (operation: (client: typeof tx) => unknown, _options?: unknown) => operation(tx)) };
    const repository = new PrismaKnowledgePackRepository("ws-1", prisma as never);
    await expect(repository.update("pack-1", { expectedRevision: 0, name: "售后流程" })).resolves.toMatchObject({ revision: 1, name: "售后流程" });
    expect(tx.knowledgePack.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { workspaceId: "ws-1", id: "pack-1", revision: 0 } }));
    expect(prisma.$transaction.mock.calls[0]?.[1]).toMatchObject({ isolationLevel: "Serializable" });
  });

  it("preserves documents by default and detaches jobs in the same transaction", async () => {
    const tx = {
      knowledgePack: { updateMany: vi.fn().mockResolvedValue({ count: 1 }), count: vi.fn(), delete: vi.fn().mockResolvedValue(record) },
      knowledgeDocument: { count: vi.fn().mockResolvedValue(2), updateMany: vi.fn().mockResolvedValue({ count: 2 }), deleteMany: vi.fn() },
      importJob: {
        count: vi.fn().mockResolvedValue(0),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = { $transaction: vi.fn(async (operation: (client: typeof tx) => unknown, _options?: unknown) => operation(tx)) };
    const repository = new PrismaKnowledgePackRepository("ws-1", prisma as never);
    await expect(repository.remove("pack-1", { expectedRevision: 0 })).resolves.toEqual({ detachedDocumentCount: 2, deletedDocumentCount: 0 });
    expect(tx.knowledgeDocument.updateMany).toHaveBeenCalledWith({ where: { workspaceId: "ws-1", knowledgePackId: "pack-1" }, data: { knowledgePackId: null, revision: { increment: 1 } } });
    expect(tx.knowledgeDocument.deleteMany).not.toHaveBeenCalled();
    expect(tx.importJob.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { workspaceId: "ws-1", knowledgePackId: "pack-1" } }));
  });

  it("refuses to remove a pack while workspace-scoped imports are active", async () => {
    const tx = {
      knowledgePack: { updateMany: vi.fn().mockResolvedValue({ count: 1 }), count: vi.fn(), delete: vi.fn() },
      knowledgeDocument: { count: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
      importJob: {
        count: vi.fn().mockResolvedValue(1),
        updateMany: vi.fn(),
      },
    };
    const prisma = { $transaction: vi.fn(async (operation: (client: typeof tx) => unknown) => operation(tx)) };
    const repository = new PrismaKnowledgePackRepository("ws-1", prisma as never);

    await expect(repository.remove("pack-1", { expectedRevision: 0 })).rejects.toMatchObject({
      status: 409,
      code: "knowledge_pack_has_active_imports",
    });
    expect(tx.importJob.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        workspaceId: "ws-1",
        status: { in: [
          ImportJobStatus.PENDING,
          ImportJobStatus.RUNNING,
          ImportJobStatus.PREVIEW_READY,
          ImportJobStatus.PROCESSING,
          ImportJobStatus.PARTIAL_FAILED,
          ImportJobStatus.FAILED,
        ] },
        OR: [
          { knowledgePackId: "pack-1" },
          { items: { some: { previewMetadata: { path: ["knowledgePackId"], equals: "pack-1" } } } },
        ],
      }),
    });
    expect(tx.knowledgeDocument.updateMany).not.toHaveBeenCalled();
    expect(tx.knowledgePack.delete).not.toHaveBeenCalled();
  });

  it("does not let an active import for another pack block removal", async () => {
    const tx = {
      knowledgePack: { updateMany: vi.fn().mockResolvedValue({ count: 1 }), count: vi.fn(), delete: vi.fn().mockResolvedValue(record) },
      knowledgeDocument: { count: vi.fn().mockResolvedValue(0), updateMany: vi.fn().mockResolvedValue({ count: 0 }), deleteMany: vi.fn() },
      importJob: {
        count: vi.fn().mockResolvedValue(0),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const prisma = { $transaction: vi.fn(async (operation: (client: typeof tx) => unknown) => operation(tx)) };
    const repository = new PrismaKnowledgePackRepository("ws-1", prisma as never);

    await expect(repository.remove("pack-1", { expectedRevision: 0 })).resolves.toEqual({
      detachedDocumentCount: 0,
      deletedDocumentCount: 0,
    });
    expect(tx.knowledgePack.delete).toHaveBeenCalledTimes(1);
  });

  it.each([
    [ImportJobStatus.PARTIAL_FAILED, true],
    [ImportJobStatus.FAILED, true],
    [ImportJobStatus.COMPLETED, false],
    [ImportJobStatus.CANCELLED, false],
  ] as const)("applies the pack deletion blocker policy to %s jobs", async (storedStatus, shouldBlock) => {
    const countImportReferences = vi.fn(async ({ where }: { where: { status: { in: ImportJobStatus[] } } }) => (
      where.status.in.includes(storedStatus) ? 1 : 0
    ));
    const tx = {
      knowledgePack: { updateMany: vi.fn().mockResolvedValue({ count: 1 }), count: vi.fn(), delete: vi.fn().mockResolvedValue(record) },
      knowledgeDocument: { count: vi.fn().mockResolvedValue(0), updateMany: vi.fn().mockResolvedValue({ count: 0 }), deleteMany: vi.fn() },
      importJob: { count: countImportReferences, updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    };
    const prisma = { $transaction: vi.fn(async (operation: (client: typeof tx) => unknown) => operation(tx)) };
    const operation = new PrismaKnowledgePackRepository("ws-1", prisma as never).remove("pack-1", { expectedRevision: 0 });

    if (shouldBlock) {
      await expect(operation).rejects.toMatchObject({ status: 409, code: "knowledge_pack_has_active_imports" });
      expect(tx.knowledgePack.delete).not.toHaveBeenCalled();
    } else {
      await expect(operation).resolves.toEqual({ detachedDocumentCount: 0, deletedDocumentCount: 0 });
      expect(tx.knowledgePack.delete).toHaveBeenCalledTimes(1);
    }
  });

  it("requires explicit confirmation to delete documents and rejects stale revisions atomically", async () => {
    const repository = new PrismaKnowledgePackRepository("ws-1", {} as never);
    await expect(repository.remove("pack-1", { expectedRevision: 0, deleteDocuments: true })).rejects.toMatchObject({ status: 400 });

    const tx = {
      knowledgePack: { updateMany: vi.fn().mockResolvedValue({ count: 0 }), count: vi.fn().mockResolvedValue(1), delete: vi.fn() },
      knowledgeDocument: { count: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
      importJob: { count: vi.fn(), updateMany: vi.fn() },
    };
    const prisma = { $transaction: vi.fn(async (operation: (client: typeof tx) => unknown) => operation(tx)) };
    const stale = new PrismaKnowledgePackRepository("ws-1", prisma as never);
    await expect(stale.remove("pack-1", { expectedRevision: 0 })).rejects.toMatchObject({ status: 409 });
    expect(tx.knowledgeDocument.updateMany).not.toHaveBeenCalled();
    expect(tx.knowledgePack.delete).not.toHaveBeenCalled();
  });
});
