import { requireSameOrigin } from "@/lib/server-storage/request";
import { resolveRequestWorkspace, type WorkspaceResolution } from "@/lib/server-storage/workspace";
import { PrismaKnowledgePackRepository } from "@/lib/server-storage/knowledgePackRepository";
import { knowledgeRouteError, readStorageJsonBody, workspaceJson } from "@/lib/server-storage/knowledgeRequest";
import {
  KnowledgePackRepositoryError,
  knowledgePackLimits,
  sanitizeCreateKnowledgePackInput,
} from "@/lib/storage/knowledgePackRepository";

export const runtime = "nodejs";

export async function GET(request: Request) {
  let resolution: WorkspaceResolution | undefined;
  try {
    resolution = await resolveRequestWorkspace(request, { createIfMissing: false }) ?? undefined;
    if (!resolution) return workspaceJson({ ok: true, packs: [] }, undefined);
    const packs = await new PrismaKnowledgePackRepository(resolution.workspaceId).list();
    return workspaceJson({ ok: true, packs }, undefined, resolution);
  } catch (error) {
    return knowledgeRouteError(error, resolution);
  }
}

export async function POST(request: Request) {
  let resolution: WorkspaceResolution | undefined;
  try {
    requireSameOrigin(request);
    const body = await readStorageJsonBody(request, knowledgePackLimits.requestBodyChars);
    const input = sanitizeCreateKnowledgePackInput(body);
    if (!input) throw new KnowledgePackRepositoryError("知识包创建请求不符合规则。", 400, "invalid_knowledge_pack");
    resolution = await resolveRequestWorkspace(request);
    const pack = await new PrismaKnowledgePackRepository(resolution.workspaceId).create(input);
    return workspaceJson({ ok: true, pack }, { status: 201 }, resolution);
  } catch (error) {
    return knowledgeRouteError(error, resolution);
  }
}
