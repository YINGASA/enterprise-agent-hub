import { sanitizeImportJobId, KNOWLEDGE_IMPORT_JSON_BODY_CHARS } from "@/app/api/storage/knowledge/import/request";
import { PrismaKnowledgeImportRepository, sanitizeJobConfirmation } from "@/lib/server-storage/knowledgeImportRepository";
import { knowledgeRouteError, readStorageJsonBody, workspaceJson } from "@/lib/server-storage/knowledgeRequest";
import { requireSameOrigin } from "@/lib/server-storage/request";
import { resolveRequestWorkspace, type WorkspaceResolution } from "@/lib/server-storage/workspace";
import { KnowledgeRepositoryError } from "@/lib/storage/knowledgeRepository";

export const runtime = "nodejs";

export async function GET(request: Request) {
  let resolution: WorkspaceResolution | undefined;
  try {
    resolution = await resolveRequestWorkspace(request, { createIfMissing: false }) ?? undefined;
    if (!resolution) return workspaceJson({ ok: true, jobs: [] }, undefined);
    const jobs = await new PrismaKnowledgeImportRepository(resolution.workspaceId).listRecoverableJobs();
    return workspaceJson({ ok: true, jobs }, undefined, resolution);
  } catch (error) {
    return knowledgeRouteError(error, resolution);
  }
}

export async function POST(request: Request) {
  let resolution: WorkspaceResolution | undefined;
  try {
    requireSameOrigin(request);
    const body = await readStorageJsonBody(request, KNOWLEDGE_IMPORT_JSON_BODY_CHARS);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new KnowledgeRepositoryError("导入确认请求格式无效。", 400, "invalid_import_confirmation");
    }
    const { jobId: rawJobId, ...rawConfirmation } = body as Record<string, unknown>;
    const jobId = sanitizeImportJobId(rawJobId);
    const confirmation = sanitizeJobConfirmation(rawConfirmation);
    if (!confirmation) throw new KnowledgeRepositoryError("导入确认请求不符合规则。", 400, "invalid_import_confirmation");
    resolution = await resolveRequestWorkspace(request);
    const job = await new PrismaKnowledgeImportRepository(resolution.workspaceId).confirmJob(jobId, confirmation);
    return workspaceJson({ ok: true, job }, undefined, resolution);
  } catch (error) {
    return knowledgeRouteError(error, resolution);
  }
}
