import { requireSameOrigin } from "@/lib/server-storage/request";
import { resolveRequestWorkspace, type WorkspaceResolution } from "@/lib/server-storage/workspace";
import { PrismaKnowledgeRepository } from "@/lib/server-storage/knowledgeRepository";
import { KNOWLEDGE_REQUEST_BODY_CHARS, knowledgeRouteError, readStorageJsonBody, workspaceJson } from "@/lib/server-storage/knowledgeRequest";
import { KnowledgeRepositoryError, sanitizeKnowledgeDocumentUpdate } from "@/lib/storage/knowledgeRepository";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

async function documentId(context: RouteContext) {
  const id = (await context.params).id.trim();
  if (!id || id.length > 128) throw new KnowledgeRepositoryError("知识文档标识无效。", 400, "invalid_document_id");
  return id;
}

export async function GET(request: Request, context: RouteContext) {
  let resolution: WorkspaceResolution | undefined;
  try {
    const id = await documentId(context);
    resolution = await resolveRequestWorkspace(request, { createIfMissing: false }) ?? undefined;
    if (!resolution) throw new KnowledgeRepositoryError("知识文档不存在。", 404, "knowledge_document_not_found");
    const document = await new PrismaKnowledgeRepository(resolution.workspaceId).get(id);
    if (!document) throw new KnowledgeRepositoryError("知识文档不存在。", 404, "knowledge_document_not_found");
    return workspaceJson({ ok: true, document }, undefined, resolution);
  } catch (error) {
    return knowledgeRouteError(error, resolution);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  let resolution: WorkspaceResolution | undefined;
  try {
    requireSameOrigin(request);
    const id = await documentId(context);
    const body = await readStorageJsonBody(request, KNOWLEDGE_REQUEST_BODY_CHARS);
    if (!body || typeof body !== "object" || Array.isArray(body) || !("update" in body) || "workspaceId" in body) {
      throw new KnowledgeRepositoryError("知识文档更新请求格式无效。", 400, "invalid_knowledge_update");
    }
    const update = sanitizeKnowledgeDocumentUpdate((body as { update: unknown }).update);
    if (!update) throw new KnowledgeRepositoryError("知识文档更新不符合规则。", 400, "invalid_knowledge_update");
    resolution = await resolveRequestWorkspace(request);
    const document = await new PrismaKnowledgeRepository(resolution.workspaceId).update(id, update);
    return workspaceJson({ ok: true, document }, undefined, resolution);
  } catch (error) {
    return knowledgeRouteError(error, resolution);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  let resolution: WorkspaceResolution | undefined;
  try {
    requireSameOrigin(request);
    const id = await documentId(context);
    resolution = await resolveRequestWorkspace(request);
    await new PrismaKnowledgeRepository(resolution.workspaceId).remove(id);
    return workspaceJson({ ok: true }, undefined, resolution);
  } catch (error) {
    return knowledgeRouteError(error, resolution);
  }
}
