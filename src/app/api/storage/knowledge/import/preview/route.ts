import { readKnowledgeImportMultipart } from "@/app/api/storage/knowledge/import/request";
import { knowledgeImportLimits } from "@/lib/knowledge/import-limits";
import { tryAcquireKnowledgeImportPreviewSlot } from "@/lib/server-storage/knowledgeImportConcurrency";
import { PrismaKnowledgeImportRepository } from "@/lib/server-storage/knowledgeImportRepository";
import { knowledgeRouteError, workspaceJson } from "@/lib/server-storage/knowledgeRequest";
import { requireSameOrigin } from "@/lib/server-storage/request";
import { resolveRequestWorkspace, type WorkspaceResolution } from "@/lib/server-storage/workspace";
import { KnowledgeRepositoryError } from "@/lib/storage/knowledgeRepository";

export const runtime = "nodejs";

async function previewWithDeadline(
  request: Request,
  workspaceId: string,
  input: Awaited<ReturnType<typeof readKnowledgeImportMultipart>>,
) {
  const controller = new AbortController();
  let timedOut = false;
  const onRequestAbort = () => controller.abort();
  if (request.signal.aborted) controller.abort();
  request.signal.addEventListener("abort", onRequestAbort, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, knowledgeImportLimits.previewTimeoutMs);
  try {
    return await new PrismaKnowledgeImportRepository(workspaceId).preview({ ...input, signal: controller.signal });
  } catch (error) {
    if (timedOut) {
      throw new KnowledgeRepositoryError("导入预览处理超时，请缩小批次后重试。", 504, "knowledge_import_preview_timeout");
    }
    throw error;
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener("abort", onRequestAbort);
  }
}

export async function POST(request: Request) {
  let resolution: WorkspaceResolution | undefined;
  let releasePreviewSlot: (() => void) | undefined;
  try {
    requireSameOrigin(request);
    resolution = await resolveRequestWorkspace(request);
    const slot = tryAcquireKnowledgeImportPreviewSlot(resolution.workspaceId);
    if (!slot.ok) {
      throw new KnowledgeRepositoryError(
        slot.reason === "workspace_limit"
          ? "当前工作区已有文件正在生成导入预览，请稍后重试。"
          : "当前导入预览请求较多，请稍后重试。",
        429,
        "knowledge_import_concurrency_limit",
      );
    }
    releasePreviewSlot = slot.release;
    const input = await readKnowledgeImportMultipart(request);
    const job = await previewWithDeadline(request, resolution.workspaceId, input);
    return workspaceJson({ ok: true, job }, { status: 201 }, resolution);
  } catch (error) {
    return knowledgeRouteError(error, resolution);
  } finally {
    releasePreviewSlot?.();
  }
}
