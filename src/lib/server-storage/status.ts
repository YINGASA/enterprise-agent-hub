import type { PrismaClient } from "@prisma/client";
import { getServerStorageConfiguration, resolveStorageMode, type ServerStorageConfiguration, type StorageMode } from "@/lib/server-storage/config";
import { probeDatabaseHealth } from "@/lib/server-storage/prisma";

export type SafeStorageStatus = {
  configured: boolean;
  healthy: boolean;
  storageMode: StorageMode;
  databaseType: "postgresql";
};

export type SafeWorkspaceStorageMetrics = {
  storageMode: StorageMode;
  databaseConfigured: boolean;
  databaseHealthy: boolean;
  conversationCount: number;
  messageCount: number;
  knowledgeDocumentCount: number;
  migrationCount: number;
  storageErrorCount: number;
};

export function emptyWorkspaceStorageMetrics(status: SafeStorageStatus): SafeWorkspaceStorageMetrics {
  return {
    storageMode: status.storageMode,
    databaseConfigured: status.configured,
    databaseHealthy: status.healthy,
    conversationCount: 0,
    messageCount: 0,
    knowledgeDocumentCount: 0,
    migrationCount: 0,
    storageErrorCount: status.storageMode === "degraded" ? 1 : 0,
  };
}

export async function getSafeStorageStatus(
  healthProbe: () => Promise<boolean> = probeDatabaseHealth,
  configuration: ServerStorageConfiguration = getServerStorageConfiguration(),
): Promise<SafeStorageStatus> {
  const configured = configuration.databaseConfigured && configuration.sessionSecretConfigured;
  const healthy = configuration.storageEnabled && configured ? await healthProbe() : false;
  return {
    configured,
    healthy,
    storageMode: resolveStorageMode({ ...configuration, databaseHealthy: healthy }),
    databaseType: "postgresql",
  };
}

export async function getSafeWorkspaceStorageMetrics(
  prisma: PrismaClient,
  workspaceId: string,
  status: SafeStorageStatus,
): Promise<SafeWorkspaceStorageMetrics> {
  if (!status.healthy || status.storageMode !== "server") {
    return emptyWorkspaceStorageMetrics(status);
  }

  const [conversationCount, messageCount, knowledgeDocumentCount, migrationCount] = await Promise.all([
    prisma.conversation.count({ where: { workspaceId, deletedAt: null } }),
    prisma.message.count({ where: { workspaceId } }),
    prisma.knowledgeDocument.count({ where: { workspaceId } }),
    prisma.storageMigration.count({ where: { workspaceId } }),
  ]);
  return {
    storageMode: status.storageMode,
    databaseConfigured: status.configured,
    databaseHealthy: status.healthy,
    conversationCount,
    messageCount,
    knowledgeDocumentCount,
    migrationCount,
    storageErrorCount: 0,
  };
}
