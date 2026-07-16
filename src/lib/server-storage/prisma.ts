import { PrismaClient } from "@prisma/client";
import { getServerStorageConfiguration } from "@/lib/server-storage/config";
import { StorageApiError } from "@/lib/server-storage/errors";

const globalPrisma = globalThis as typeof globalThis & { enterpriseAgentHubPrisma?: PrismaClient };

export function getPrismaClient(): PrismaClient {
  const configuration = getServerStorageConfiguration();
  if (!configuration.databaseConfigured) {
    throw new StorageApiError("storage_misconfigured", 503, "服务端存储尚未配置。", false);
  }

  if (!globalPrisma.enterpriseAgentHubPrisma) {
    globalPrisma.enterpriseAgentHubPrisma = new PrismaClient({ log: [] });
  }
  return globalPrisma.enterpriseAgentHubPrisma;
}

export async function probeDatabaseHealth(client?: PrismaClient): Promise<boolean> {
  try {
    const prisma = client ?? getPrismaClient();
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
