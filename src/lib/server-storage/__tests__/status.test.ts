import { describe, expect, it, vi } from "vitest";
import { getSafeStorageStatus, getSafeWorkspaceStorageMetrics } from "@/lib/server-storage/status";

describe("safe storage status", () => {
  it("reports only safe scalar status fields", async () => {
    const status = await getSafeStorageStatus(async () => true, {
      storageEnabled: true,
      databaseConfigured: true,
      sessionSecretConfigured: true,
    });
    expect(status).toEqual({ configured: true, healthy: true, storageMode: "server", databaseType: "postgresql" });
  });

  it("does not probe the database in local mode", async () => {
    const probe = vi.fn(async () => true);
    const status = await getSafeStorageStatus(probe, {
      storageEnabled: false,
      databaseConfigured: false,
      sessionSecretConfigured: false,
    });
    expect(status.storageMode).toBe("local");
    expect(probe).not.toHaveBeenCalled();
  });

  it("moves from degraded back to server after a later healthy probe", async () => {
    const probes = [false, true];
    const configuration = { storageEnabled: true, databaseConfigured: true, sessionSecretConfigured: true };
    const first = await getSafeStorageStatus(async () => probes.shift() ?? false, configuration);
    const recovered = await getSafeStorageStatus(async () => probes.shift() ?? false, configuration);
    expect(first).toMatchObject({ storageMode: "degraded", healthy: false });
    expect(recovered).toMatchObject({ storageMode: "server", healthy: true });
    expect(JSON.stringify([first, recovered])).not.toMatch(/url|password|secret|connection/i);
  });

  it("scopes aggregate counts to one workspace", async () => {
    const prisma = {
      conversation: { count: vi.fn(async () => 2) },
      message: { count: vi.fn(async () => 7) },
      knowledgeDocument: { count: vi.fn(async () => 3) },
      knowledgePack: { count: vi.fn(async () => 2) },
      importJob: {
        count: vi.fn(async () => 4),
        aggregate: vi.fn(async () => ({ _avg: { durationMs: 1250.4 } })),
      },
      importItem: {
        count: vi.fn()
          .mockResolvedValueOnce(8)
          .mockResolvedValueOnce(5)
          .mockResolvedValueOnce(2)
          .mockResolvedValueOnce(3),
        aggregate: vi.fn(async () => ({ _sum: { retryCount: 6 } })),
        groupBy: vi.fn()
          .mockResolvedValueOnce([
            { errorCode: "pdf_parse_error", _count: { _all: 2 } },
            { errorCode: "parser_timeout", _count: { _all: 3 } },
            { errorCode: "private-internal-code", _count: { _all: 1 } },
          ])
          .mockResolvedValueOnce([
            { conflictType: "exact_content", _count: { _all: 2 } },
            { conflictType: "unexpected-private-value", _count: { _all: 1 } },
          ]),
      },
      storageMigration: { count: vi.fn(async () => 1) },
    };
    const metrics = await getSafeWorkspaceStorageMetrics(prisma as never, "workspace-a", {
      configured: true,
      healthy: true,
      storageMode: "server",
      databaseType: "postgresql",
    });
    expect(metrics).toMatchObject({
      conversationCount: 2,
      messageCount: 7,
      knowledgeDocumentCount: 3,
      knowledgePackCount: 2,
      importJobCount: 4,
      importItemCount: 8,
      importSuccessCount: 5,
      importFailureCount: 2,
      importConflictCount: 3,
      importRetryCount: 6,
      averageImportDuration: 1250,
      parserErrorDistribution: [
        { key: "parser_timeout", count: 3 },
        { key: "pdf_parse_error", count: 2 },
        { key: "other", count: 1 },
      ],
      duplicateTypeDistribution: [
        { key: "exact_content", count: 2 },
        { key: "other", count: 1 },
      ],
      migrationCount: 1,
    });
    expect(prisma.message.count).toHaveBeenCalledWith({ where: { workspaceId: "workspace-a" } });
    expect(prisma.importItem.count).toHaveBeenNthCalledWith(1, { where: { workspaceId: "workspace-a" } });
  });
});
