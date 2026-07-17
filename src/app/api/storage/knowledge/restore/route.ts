import { requireSameOrigin } from "@/lib/server-storage/request";
import { resolveRequestWorkspace, type WorkspaceResolution } from "@/lib/server-storage/workspace";
import { PrismaKnowledgeRepository } from "@/lib/server-storage/knowledgeRepository";
import { KNOWLEDGE_RESTORE_BODY_CHARS, knowledgeRouteError, readStorageJsonBody, workspaceJson } from "@/lib/server-storage/knowledgeRequest";
import { sanitizeImportedKnowledgeDocument } from "@/lib/knowledge/storage";
import { agentRequestLimits } from "@/lib/ops/securityLimits";
import { KnowledgeRepositoryError } from "@/lib/storage/knowledgeRepository";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let resolution: WorkspaceResolution | undefined;
  try {
    requireSameOrigin(request);
    const body = await readStorageJsonBody(request, KNOWLEDGE_RESTORE_BODY_CHARS);
    if (!body || typeof body !== "object" || Array.isArray(body) || "workspaceId" in body) {
      throw new KnowledgeRepositoryError("知识库恢复请求格式无效。", 400, "invalid_knowledge_restore");
    }
    const rawDocuments = (body as { documents?: unknown }).documents;
    if (!Array.isArray(rawDocuments)) throw new KnowledgeRepositoryError("知识库恢复记录必须是数组。", 400, "invalid_knowledge_restore");
    if (rawDocuments.length > agentRequestLimits.userDocuments) {
      throw new KnowledgeRepositoryError(`知识文档最多保存 ${agentRequestLimits.userDocuments} 篇。`, 413, "knowledge_document_capacity");
    }
    const documents = rawDocuments.map((document) => sanitizeImportedKnowledgeDocument(document));
    if (documents.some((document) => !document)) throw new KnowledgeRepositoryError("知识库备份包含无效文档。", 400, "invalid_knowledge_restore");
    const safeDocuments = documents as NonNullable<(typeof documents)[number]>[];
    if (new Set(safeDocuments.map((document) => document.id)).size !== safeDocuments.length) {
      throw new KnowledgeRepositoryError("知识库备份包含重复文档标识。", 400, "invalid_knowledge_restore");
    }
    resolution = await resolveRequestWorkspace(request);
    const restored = await new PrismaKnowledgeRepository(resolution.workspaceId).replaceAll(safeDocuments);
    return workspaceJson({ ok: true, documents: restored }, undefined, resolution);
  } catch (error) {
    return knowledgeRouteError(error, resolution);
  }
}
