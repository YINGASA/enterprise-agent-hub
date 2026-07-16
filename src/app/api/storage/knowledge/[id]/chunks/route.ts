import { resolveRequestWorkspace, type WorkspaceResolution } from "@/lib/server-storage/workspace";
import { PrismaKnowledgeRepository } from "@/lib/server-storage/knowledgeRepository";
import { knowledgeRouteError, workspaceJson } from "@/lib/server-storage/knowledgeRequest";
import { KnowledgeRepositoryError } from "@/lib/storage/knowledgeRepository";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  let resolution: WorkspaceResolution | undefined;
  try {
    const id = (await context.params).id.trim();
    if (!id || id.length > 128) throw new KnowledgeRepositoryError("知识文档标识无效。", 400, "invalid_document_id");
    resolution = await resolveRequestWorkspace(request, { createIfMissing: false }) ?? undefined;
    if (!resolution) throw new KnowledgeRepositoryError("知识文档不存在。", 404, "knowledge_document_not_found");
    const chunks = await new PrismaKnowledgeRepository(resolution.workspaceId).listChunks(id);
    return workspaceJson({ ok: true, chunks }, undefined, resolution);
  } catch (error) {
    return knowledgeRouteError(error, resolution);
  }
}
