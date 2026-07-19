import { KNOWLEDGE_IMPORT_JSON_BODY_CHARS, sanitizeImportJobId } from "@/app/api/storage/knowledge/import/request";
import { PrismaKnowledgeImportRepository, sanitizeExpectedRevision } from "@/lib/server-storage/knowledgeImportRepository";
import { knowledgeRouteError, readStorageJsonBody, workspaceJson } from "@/lib/server-storage/knowledgeRequest";
import { requireSameOrigin } from "@/lib/server-storage/request";
import { resolveRequestWorkspace, type WorkspaceResolution } from "@/lib/server-storage/workspace";
import { KnowledgeRepositoryError } from "@/lib/storage/knowledgeRepository";

type RouteContext = { params: Promise<{ id: string }> };
type Action = "processNext" | "retryFailed" | "cancel";

export async function runKnowledgeImportAction(request: Request, context: RouteContext, action: Action) {
  let resolution: WorkspaceResolution | undefined;
  try {
    requireSameOrigin(request);
    const id = sanitizeImportJobId((await context.params).id);
    const expectedRevision = sanitizeExpectedRevision(await readStorageJsonBody(request, KNOWLEDGE_IMPORT_JSON_BODY_CHARS));
    if (expectedRevision === null) {
      throw new KnowledgeRepositoryError("导入任务操作请求不符合规则。", 400, "invalid_import_action");
    }
    resolution = await resolveRequestWorkspace(request);
    const repository = new PrismaKnowledgeImportRepository(resolution.workspaceId);
    const job = await repository[action](id, expectedRevision, request.signal);
    return workspaceJson({ ok: true, job }, undefined, resolution);
  } catch (error) {
    return knowledgeRouteError(error, resolution);
  }
}
