import { sanitizeImportJobId } from "@/app/api/storage/knowledge/import/request";
import { PrismaKnowledgeImportRepository } from "@/lib/server-storage/knowledgeImportRepository";
import { knowledgeRouteError, workspaceJson } from "@/lib/server-storage/knowledgeRequest";
import { resolveRequestWorkspace, type WorkspaceResolution } from "@/lib/server-storage/workspace";
import { KnowledgeRepositoryError } from "@/lib/storage/knowledgeRepository";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  let resolution: WorkspaceResolution | undefined;
  try {
    const id = sanitizeImportJobId((await context.params).id);
    resolution = await resolveRequestWorkspace(request, { createIfMissing: false }) ?? undefined;
    if (!resolution) throw new KnowledgeRepositoryError("导入任务不存在。", 404, "knowledge_import_not_found");
    const job = await new PrismaKnowledgeImportRepository(resolution.workspaceId).getJob(id);
    return workspaceJson({ ok: true, job }, undefined, resolution);
  } catch (error) {
    return knowledgeRouteError(error, resolution);
  }
}
