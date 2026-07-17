import { requireSameOrigin } from "@/lib/server-storage/request";
import { resolveRequestWorkspace, type WorkspaceResolution } from "@/lib/server-storage/workspace";
import { PrismaKnowledgeRepository } from "@/lib/server-storage/knowledgeRepository";
import { KNOWLEDGE_REQUEST_BODY_CHARS, knowledgeRouteError, readStorageJsonBody, workspaceJson } from "@/lib/server-storage/knowledgeRequest";
import { sanitizeImportedKnowledgeDocument } from "@/lib/knowledge/storage";
import { KnowledgeRepositoryError } from "@/lib/storage/knowledgeRepository";

export const runtime = "nodejs";

export async function GET(request: Request) {
  let resolution: WorkspaceResolution | undefined;
  try {
    resolution = await resolveRequestWorkspace(request, { createIfMissing: false }) ?? undefined;
    if (!resolution) return workspaceJson({ ok: true, documents: [] }, undefined);
    const documents = await new PrismaKnowledgeRepository(resolution.workspaceId).list();
    return workspaceJson({ ok: true, documents }, undefined, resolution);
  } catch (error) {
    return knowledgeRouteError(error, resolution);
  }
}

export async function POST(request: Request) {
  let resolution: WorkspaceResolution | undefined;
  try {
    requireSameOrigin(request);
    const body = await readStorageJsonBody(request, KNOWLEDGE_REQUEST_BODY_CHARS);
    if (!body || typeof body !== "object" || Array.isArray(body) || !("document" in body) || "workspaceId" in body) {
      throw new KnowledgeRepositoryError("知识文档请求格式无效。", 400, "invalid_knowledge_document");
    }
    const rawDocument = (body as { document: unknown }).document;
    if (rawDocument && typeof rawDocument === "object" && !Array.isArray(rawDocument) && "workspaceId" in rawDocument) {
      throw new KnowledgeRepositoryError("工作区由服务端会话确定。", 400, "workspace_not_allowed");
    }
    const document = sanitizeImportedKnowledgeDocument(rawDocument);
    if (!document) throw new KnowledgeRepositoryError("知识文档不符合导入规则。", 400, "invalid_knowledge_document");
    resolution = await resolveRequestWorkspace(request);
    const created = await new PrismaKnowledgeRepository(resolution.workspaceId).create(document);
    return workspaceJson({ ok: true, document: created }, { status: 201 }, resolution);
  } catch (error) {
    return knowledgeRouteError(error, resolution);
  }
}
