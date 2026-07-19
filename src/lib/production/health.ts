import type { PrismaClient } from "@prisma/client";
import { appVersion } from "@/lib/appVersion";
import { getLlmConfig } from "@/lib/llm";
import { getPrismaClient } from "@/lib/server-storage/prisma";
import { getSafeStorageStatus, type SafeStorageStatus } from "@/lib/server-storage/status";

export const requiredProductionMigration = "20260718000000_v222_production_hardening";
export const expectedProductionNodeVersion = "20.19.5";

export type SafeApplicationHealth = {
  applicationHealthy: boolean;
  databaseConfigured: boolean;
  databaseHealthy: boolean;
  migrationReady: boolean | null;
  storageMode: SafeStorageStatus["storageMode"];
  realApiConfigured: boolean;
  realApiHealthy: boolean | null;
  parserReady: boolean;
  nodeCompatible: boolean;
  version: string;
};

type MigrationRow = {
  finished_at: Date | null;
  rolled_back_at: Date | null;
};

export function isNode20Compatible(version: string = process.versions.node): boolean {
  return version.trim() === expectedProductionNodeVersion;
}

export async function isProductionMigrationReady(prisma: PrismaClient): Promise<boolean> {
  try {
    const rows = await prisma.$queryRaw<MigrationRow[]>`
      SELECT finished_at, rolled_back_at
      FROM "_prisma_migrations"
      WHERE migration_name = ${requiredProductionMigration}
      ORDER BY started_at DESC
      LIMIT 1
    `;
    const row = rows[0];
    return Boolean(row?.finished_at && !row.rolled_back_at);
  } catch {
    return false;
  }
}

export async function areKnowledgeParsersReady(
  load: () => Promise<unknown> = async () => Promise.all([
    import("mammoth"),
    import("pdfjs-dist/legacy/build/pdf.mjs"),
    import("yauzl"),
  ]),
): Promise<boolean> {
  try {
    await load();
    return true;
  } catch {
    return false;
  }
}

export async function getSafeApplicationHealth(input: {
  storageStatus?: SafeStorageStatus;
  parserReady?: boolean;
  migrationReady?: boolean | null;
  nodeVersion?: string;
  realApiConfigured?: boolean;
} = {}): Promise<SafeApplicationHealth> {
  const storageStatus = input.storageStatus ?? await getSafeStorageStatus();
  const parserReady = input.parserReady ?? await areKnowledgeParsersReady();
  const nodeCompatible = isNode20Compatible(input.nodeVersion);
  const realApiConfigured = input.realApiConfigured ?? getLlmConfig().isConfigured;
  let migrationReady = input.migrationReady;

  if (migrationReady === undefined) {
    migrationReady = storageStatus.storageMode === "local"
      ? null
      : storageStatus.healthy
        ? await isProductionMigrationReady(getPrismaClient())
        : false;
  }

  const storageReady = storageStatus.storageMode === "local"
    || (storageStatus.storageMode === "server" && migrationReady === true);

  return {
    applicationHealthy: nodeCompatible && parserReady && storageReady,
    databaseConfigured: storageStatus.configured,
    databaseHealthy: storageStatus.healthy,
    migrationReady,
    storageMode: storageStatus.storageMode,
    realApiConfigured,
    // The aggregate endpoint never probes a paid upstream. /api/llm/health owns
    // that explicit check, so null safely means "not probed".
    realApiHealthy: null,
    parserReady,
    nodeCompatible,
    version: appVersion,
  };
}
