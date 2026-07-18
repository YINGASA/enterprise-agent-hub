import { ImportItemStatus, type PrismaClient } from "@prisma/client";
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
  knowledgePackCount: number;
  importJobCount: number;
  importItemCount: number;
  importSuccessCount: number;
  importFailureCount: number;
  importConflictCount: number;
  importRetryCount: number;
  averageImportDuration: number;
  parserErrorDistribution: SafeStorageDistributionItem[];
  duplicateTypeDistribution: SafeStorageDistributionItem[];
  migrationCount: number;
  storageErrorCount: number;
};

export type SafeStorageDistributionItem = {
  key: string;
  count: number;
};

const SAFE_PARSER_ERROR_CODES = new Set([
  "invalid_file_name",
  "unsupported_file_type",
  "file_too_large",
  "mime_mismatch",
  "signature_mismatch",
  "empty_content",
  "invalid_encoding",
  "abnormal_control_characters",
  "extracted_content_too_large",
  "chunk_count_exceeded",
  "pdf_parse_error",
  "pdf_page_limit",
  "pdf_no_extractable_text",
  "docx_invalid_archive",
  "docx_unsafe_archive",
  "docx_missing_structure",
  "docx_parse_error",
  "parser_cancelled",
  "parser_timeout",
  "knowledge_import_item_failed",
]);

const SAFE_DUPLICATE_TYPES = new Set([
  "none",
  "exact_content",
  "same_title",
  "same_file_name",
  "possible_duplicate",
]);

function safeDistribution(
  values: Array<{ key: string | null; count: number }>,
  allowed: ReadonlySet<string>,
): SafeStorageDistributionItem[] {
  const totals = new Map<string, number>();
  for (const value of values) {
    if (!value.key || !Number.isFinite(value.count) || value.count <= 0) continue;
    const key = allowed.has(value.key) ? value.key : "other";
    totals.set(key, (totals.get(key) ?? 0) + Math.floor(value.count));
  }
  return [...totals.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
}

export function emptyWorkspaceStorageMetrics(status: SafeStorageStatus): SafeWorkspaceStorageMetrics {
  return {
    storageMode: status.storageMode,
    databaseConfigured: status.configured,
    databaseHealthy: status.healthy,
    conversationCount: 0,
    messageCount: 0,
    knowledgeDocumentCount: 0,
    knowledgePackCount: 0,
    importJobCount: 0,
    importItemCount: 0,
    importSuccessCount: 0,
    importFailureCount: 0,
    importConflictCount: 0,
    importRetryCount: 0,
    averageImportDuration: 0,
    parserErrorDistribution: [],
    duplicateTypeDistribution: [],
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

  const [
    conversationCount,
    messageCount,
    knowledgeDocumentCount,
    knowledgePackCount,
    importJobCount,
    importItemCount,
    importSuccessCount,
    importFailureCount,
    importConflictCount,
    importRetryAggregate,
    importDurationAggregate,
    parserErrorGroups,
    duplicateTypeGroups,
    migrationCount,
  ] = await Promise.all([
    prisma.conversation.count({ where: { workspaceId, deletedAt: null } }),
    prisma.message.count({ where: { workspaceId } }),
    prisma.knowledgeDocument.count({ where: { workspaceId } }),
    prisma.knowledgePack.count({ where: { workspaceId } }),
    prisma.importJob.count({ where: { workspaceId } }),
    prisma.importItem.count({ where: { workspaceId } }),
    prisma.importItem.count({ where: { workspaceId, status: ImportItemStatus.COMPLETED } }),
    prisma.importItem.count({ where: { workspaceId, status: ImportItemStatus.FAILED } }),
    prisma.importItem.count({ where: { workspaceId, conflictType: { notIn: ["none"] } } }),
    prisma.importItem.aggregate({ where: { workspaceId }, _sum: { retryCount: true } }),
    prisma.importJob.aggregate({ where: { workspaceId, durationMs: { not: null } }, _avg: { durationMs: true } }),
    prisma.importItem.groupBy({
      by: ["errorCode"],
      where: { workspaceId, errorCode: { not: null } },
      _count: { _all: true },
    }),
    prisma.importItem.groupBy({
      by: ["conflictType"],
      where: { workspaceId, conflictType: { not: null } },
      _count: { _all: true },
    }),
    prisma.storageMigration.count({ where: { workspaceId } }),
  ]);

  const parserErrorDistribution = safeDistribution(
    parserErrorGroups.map((item) => ({ key: item.errorCode, count: item._count._all })),
    SAFE_PARSER_ERROR_CODES,
  );
  const duplicateTypeDistribution = safeDistribution(
    duplicateTypeGroups.map((item) => ({ key: item.conflictType, count: item._count._all })),
    SAFE_DUPLICATE_TYPES,
  );
  return {
    storageMode: status.storageMode,
    databaseConfigured: status.configured,
    databaseHealthy: status.healthy,
    conversationCount,
    messageCount,
    knowledgeDocumentCount,
    knowledgePackCount,
    importJobCount,
    importItemCount,
    importSuccessCount,
    importFailureCount,
    importConflictCount,
    importRetryCount: importRetryAggregate._sum.retryCount ?? 0,
    averageImportDuration: Math.max(0, Math.round(importDurationAggregate._avg.durationMs ?? 0)),
    parserErrorDistribution,
    duplicateTypeDistribution,
    migrationCount,
    storageErrorCount: 0,
  };
}
