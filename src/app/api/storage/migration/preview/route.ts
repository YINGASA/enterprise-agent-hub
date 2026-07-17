import { requireSameOrigin } from "@/lib/server-storage/request";
import { resolveRequestWorkspace, type WorkspaceResolution } from "@/lib/server-storage/workspace";
import { MIGRATION_REQUEST_BODY_CHARS, knowledgeRouteError, readStorageJsonBody, workspaceJson } from "@/lib/server-storage/knowledgeRequest";
import { previewStorageMigration, sanitizeStorageMigrationInput } from "@/lib/server-storage/migration";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let resolution: WorkspaceResolution | undefined;
  try {
    requireSameOrigin(request);
    const body = await readStorageJsonBody(request, MIGRATION_REQUEST_BODY_CHARS);
    const validated = sanitizeStorageMigrationInput(body);
    if (!validated.ok) return workspaceJson({ ok: false, error: validated.error, message: validated.message }, { status: validated.status });
    resolution = await resolveRequestWorkspace(request);
    const result = await previewStorageMigration(resolution.workspaceId, validated.input);
    return workspaceJson({ ok: true, result }, undefined, resolution);
  } catch (error) {
    return knowledgeRouteError(error, resolution);
  }
}
