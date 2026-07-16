import { NextResponse } from "next/server";
import { StorageApiError, toStorageErrorResponse } from "@/lib/server-storage/errors";
import { readBoundedTextBody } from "@/lib/server-storage/request";
import { KnowledgeRepositoryError } from "@/lib/storage/knowledgeRepository";
import type { WorkspaceResolution } from "@/lib/server-storage/workspace";

export const KNOWLEDGE_REQUEST_BODY_CHARS = 400_000;
export const KNOWLEDGE_RESTORE_BODY_CHARS = 1_600_000;
export const MIGRATION_REQUEST_BODY_CHARS = 5_000_000;

export async function readStorageJsonBody(request: Request, maximumChars: number) {
  const raw = await readBoundedTextBody(request, maximumChars);
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new StorageApiError("invalid_request", 400, "请求体不是合法 JSON。", false);
  }
}

export function workspaceJson(body: unknown, init: ResponseInit | undefined, resolution?: WorkspaceResolution) {
  const response = NextResponse.json(body, init);
  response.headers.set("cache-control", "private, no-store");
  response.headers.set("vary", "Cookie");
  if (resolution?.setCookie) response.headers.append("set-cookie", resolution.setCookie);
  return response;
}

export function knowledgeRouteError(error: unknown, resolution?: WorkspaceResolution) {
  if (error instanceof KnowledgeRepositoryError) {
    const mappedError = error.status === 404 ? "not_found" : error.status === 409 ? "id_conflict" : error.status === 413 ? "payload_too_large" : error.status >= 500 ? "storage_unavailable" : "invalid_request";
    return workspaceJson({ ok: false, error: mappedError, message: error.message, retryable: error.status >= 500 }, { status: error.status }, resolution);
  }
  if (error && typeof error === "object") {
    const name = "name" in error && typeof error.name === "string" ? error.name : "";
    const code = "code" in error && typeof error.code === "string" ? error.code : "";
    if (name.startsWith("PrismaClient") || /^P\d{4}$/.test(code)) {
      return workspaceJson({ ok: false, error: "storage_unavailable", message: "服务端存储暂不可用，请稍后重试。", retryable: true }, { status: 503 }, resolution);
    }
  }
  const safe = toStorageErrorResponse(error);
  return workspaceJson(safe.body, { status: safe.status }, resolution);
}
