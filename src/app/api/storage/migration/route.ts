import { requireSameOrigin } from "@/lib/server-storage/request";
import { resolveRequestWorkspace, type WorkspaceResolution } from "@/lib/server-storage/workspace";
import { MIGRATION_REQUEST_BODY_CHARS, knowledgeRouteError, readStorageJsonBody, workspaceJson } from "@/lib/server-storage/knowledgeRequest";
import { executeStorageMigration, getStorageMigrationResult, sanitizeStorageMigrationInput, storageMigrationLimits } from "@/lib/server-storage/migration";

export const runtime = "nodejs";

export async function GET(request: Request) {
  let resolution: WorkspaceResolution | undefined;
  try {
    const migrationId = new URL(request.url).searchParams.get("migrationId")?.trim() ?? "";
    if (!migrationId || migrationId.length > storageMigrationLimits.migrationIdChars) {
      return workspaceJson({ ok: false, error: "invalid_migration_id", message: "迁移标识无效。" }, { status: 400 });
    }
    resolution = await resolveRequestWorkspace(request, { createIfMissing: false }) ?? undefined;
    if (!resolution) return workspaceJson({ ok: false, error: "not_found", message: "迁移记录不存在。" }, { status: 404 });
    const result = await getStorageMigrationResult(resolution.workspaceId, migrationId);
    if (!result) return workspaceJson({ ok: false, error: "not_found", message: "迁移记录不存在。" }, { status: 404 }, resolution);
    return workspaceJson({ ok: true, result }, undefined, resolution);
  } catch (error) {
    return knowledgeRouteError(error, resolution);
  }
}

export async function POST(request: Request) {
  let resolution: WorkspaceResolution | undefined;
  try {
    requireSameOrigin(request);
    const body = await readStorageJsonBody(request, MIGRATION_REQUEST_BODY_CHARS);
    if (!body || typeof body !== "object" || Array.isArray(body) || (body as Record<string, unknown>).confirmed !== true) {
      return workspaceJson({ ok: false, error: "migration_confirmation_required", message: "执行迁移前需要用户明确确认。" }, { status: 400 });
    }
    const validated = sanitizeStorageMigrationInput(body);
    if (!validated.ok) return workspaceJson({ ok: false, error: validated.error, message: validated.message }, { status: validated.status });
    resolution = await resolveRequestWorkspace(request);
    const result = await executeStorageMigration(resolution.workspaceId, validated.input);
    return workspaceJson({ ok: true, result }, undefined, resolution);
  } catch (error) {
    return knowledgeRouteError(error, resolution);
  }
}
