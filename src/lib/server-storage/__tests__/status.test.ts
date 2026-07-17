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

  it("scopes aggregate counts to one workspace", async () => {
    const prisma = {
      conversation: { count: vi.fn(async () => 2) },
      message: { count: vi.fn(async () => 7) },
      knowledgeDocument: { count: vi.fn(async () => 3) },
      storageMigration: { count: vi.fn(async () => 1) },
    };
    const metrics = await getSafeWorkspaceStorageMetrics(prisma as never, "workspace-a", {
      configured: true,
      healthy: true,
      storageMode: "server",
      databaseType: "postgresql",
    });
    expect(metrics).toMatchObject({ conversationCount: 2, messageCount: 7, knowledgeDocumentCount: 3, migrationCount: 1 });
    expect(prisma.message.count).toHaveBeenCalledWith({ where: { workspaceId: "workspace-a" } });
  });
});
