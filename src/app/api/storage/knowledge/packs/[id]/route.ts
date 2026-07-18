import { requireSameOrigin } from "@/lib/server-storage/request";
import { resolveRequestWorkspace, type WorkspaceResolution } from "@/lib/server-storage/workspace";
import { PrismaKnowledgePackRepository } from "@/lib/server-storage/knowledgePackRepository";
import { knowledgeRouteError, readStorageJsonBody, workspaceJson } from "@/lib/server-storage/knowledgeRequest";
import {
  KnowledgePackRepositoryError,
  knowledgePackLimits,
  sanitizeDeleteKnowledgePackInput,
  sanitizeUpdateKnowledgePackInput,
} from "@/lib/storage/knowledgePackRepository";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

async function packId(context: RouteContext) {
  const id = (await context.params).id.trim();
  if (!id || id.length > knowledgePackLimits.idChars || /[\u0000-\u001f\u007f]/.test(id)) {
    throw new KnowledgePackRepositoryError("知识包标识无效。", 400, "invalid_knowledge_pack_id");
  }
  return id;
}

export async function GET(request: Request, context: RouteContext) {
  let resolution: WorkspaceResolution | undefined;
  try {
    const id = await packId(context);
    resolution = await resolveRequestWorkspace(request, { createIfMissing: false }) ?? undefined;
    if (!resolution) throw new KnowledgePackRepositoryError("知识包不存在。", 404, "knowledge_pack_not_found");
    const pack = await new PrismaKnowledgePackRepository(resolution.workspaceId).get(id);
    if (!pack) throw new KnowledgePackRepositoryError("知识包不存在。", 404, "knowledge_pack_not_found");
    return workspaceJson({ ok: true, pack }, undefined, resolution);
  } catch (error) {
    return knowledgeRouteError(error, resolution);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  let resolution: WorkspaceResolution | undefined;
  try {
    requireSameOrigin(request);
    const id = await packId(context);
    const body = await readStorageJsonBody(request, knowledgePackLimits.requestBodyChars);
    const input = sanitizeUpdateKnowledgePackInput(body);
    if (!input) throw new KnowledgePackRepositoryError("知识包更新请求不符合规则。", 400, "invalid_knowledge_pack_update");
    resolution = await resolveRequestWorkspace(request);
    const pack = await new PrismaKnowledgePackRepository(resolution.workspaceId).update(id, input);
    return workspaceJson({ ok: true, pack }, undefined, resolution);
  } catch (error) {
    return knowledgeRouteError(error, resolution);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  let resolution: WorkspaceResolution | undefined;
  try {
    requireSameOrigin(request);
    const id = await packId(context);
    const body = await readStorageJsonBody(request, knowledgePackLimits.requestBodyChars);
    const input = sanitizeDeleteKnowledgePackInput(body);
    if (!input) throw new KnowledgePackRepositoryError("知识包删除请求不符合规则。", 400, "invalid_knowledge_pack_delete");
    resolution = await resolveRequestWorkspace(request);
    const result = await new PrismaKnowledgePackRepository(resolution.workspaceId).remove(id, input);
    return workspaceJson({ ok: true, result }, undefined, resolution);
  } catch (error) {
    return knowledgeRouteError(error, resolution);
  }
}
