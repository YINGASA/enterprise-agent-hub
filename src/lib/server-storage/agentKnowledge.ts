import { getPrismaClient } from "@/lib/server-storage/prisma";
import { StorageApiError } from "@/lib/server-storage/errors";
import { PrismaKnowledgeRepository } from "@/lib/server-storage/knowledgeRepository";
import { getSafeStorageStatus } from "@/lib/server-storage/status";
import { resolveRequestWorkspace } from "@/lib/server-storage/workspace";
import type { ImportedKnowledgeDocument, KnowledgeChunk } from "@/types";

export type AgentKnowledgeResolution = {
  documents: ImportedKnowledgeDocument[];
  chunks?: KnowledgeChunk[];
  setCookie?: string;
  source: "local" | "server";
};

/**
 * In server mode the authenticated anonymous workspace is the only knowledge
 * source. Local mode keeps the already validated browser documents for
 * compatibility. A configured but unavailable database fails explicitly so a
 * request can never appear successful after silently dropping workspace
 * knowledge. No workspace identifier is accepted from the request body.
 */
export async function resolveAgentKnowledge(
  request: Request,
  localDocuments: ImportedKnowledgeDocument[],
): Promise<AgentKnowledgeResolution> {
  const status = await getSafeStorageStatus();
  if (status.storageMode === "local") return { documents: localDocuments, source: "local" };
  if (status.storageMode === "degraded") {
    throw new StorageApiError("storage_unavailable", 503, "服务端存储暂不可用，本次回答未执行，请恢复后重试。", true);
  }

  try {
    const workspace = await resolveRequestWorkspace(request);
    const repository = new PrismaKnowledgeRepository(workspace.workspaceId, getPrismaClient());
    const { documents, chunks } = await repository.listEnabledWithChunks();
    return { documents, chunks, setCookie: workspace.setCookie, source: "server" };
  } catch (error) {
    if (error instanceof StorageApiError) throw error;
    throw new StorageApiError("storage_unavailable", 503, "服务端知识存储暂不可用，本次回答未执行，请恢复后重试。", true);
  }
}
