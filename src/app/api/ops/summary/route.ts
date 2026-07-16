import { NextResponse } from "next/server";
import { getLlmConfig } from "@/lib/llm";
import { isOpsTokenConfigured, validateOpsToken } from "@/lib/ops/auth";
import { getOpsSummary } from "@/lib/ops/storage";
import { getPrismaClient } from "@/lib/server-storage/prisma";
import { emptyWorkspaceStorageMetrics, getSafeStorageStatus, getSafeWorkspaceStorageMetrics } from "@/lib/server-storage/status";
import { resolveRequestWorkspace } from "@/lib/server-storage/workspace";

export const runtime = "nodejs";

const privateResponseHeaders = { "cache-control": "private, no-store", vary: "Cookie, x-ops-token" };

function opsJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: privateResponseHeaders });
}

export async function GET(request: Request) {
  if (!isOpsTokenConfigured()) {
    return opsJson({ ok: false, error: "unauthorized", message: "运维口令不正确。" }, 401);
  }

  if (!validateOpsToken(request)) {
    return opsJson({ ok: false, error: "unauthorized", message: "运维口令不正确。" }, 401);
  }

  const status = await getSafeStorageStatus();
  let metrics = emptyWorkspaceStorageMetrics(status);
  let setCookie: string | undefined;
  if (status.storageMode === "server") {
    try {
      const workspace = await resolveRequestWorkspace(request, { createIfMissing: false });
      if (workspace) {
        setCookie = workspace.setCookie;
        metrics = await getSafeWorkspaceStorageMetrics(getPrismaClient(), workspace.workspaceId, status);
      }
    } catch {
      metrics = emptyWorkspaceStorageMetrics({ ...status, healthy: false, storageMode: "degraded" });
    }
  }
  const summary = await getOpsSummary(getLlmConfig().isConfigured, metrics);
  const response = opsJson({ ok: true, summary });
  if (setCookie) response.headers.append("Set-Cookie", setCookie);
  return response;
}
