import { NextResponse } from "next/server";
import { MAX_MESSAGE_CHARACTERS } from "@/lib/conversation/context";
import { sanitizeConversationSummaryPatch } from "@/lib/conversation/context-summary";
import { sanitizeConversationMessage } from "@/lib/conversation/storage";
import { ConversationRepositoryError } from "@/lib/storage/conversationRepository";
import { PrismaConversationRepository } from "@/lib/server-storage/conversationRepository";
import { StorageApiError, toStorageErrorResponse } from "@/lib/server-storage/errors";
import { readBoundedTextBody, requireSameOrigin } from "@/lib/server-storage/request";
import { resolveRequestWorkspace } from "@/lib/server-storage/workspace";
import type { ConversationMessage, ConversationSummaryPatch } from "@/types";

export const CONVERSATION_API_BODY_CHARACTERS = 32_000;

export function safeConversationId(value: unknown) {
  if (typeof value !== "string" || !value.trim() || value.length > 128) throw new StorageApiError("invalid_request", 400, "会话标识无效。");
  return value;
}

export function safeExpectedRevision(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > Number.MAX_SAFE_INTEGER) {
    throw new StorageApiError("invalid_request", 400, "会话版本无效。");
  }
  return value;
}

export function safeSummaryPatch(value: unknown): ConversationSummaryPatch | undefined {
  if (value === undefined) return undefined;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const set = (value as { set?: unknown }).set;
    if (set && typeof set === "object" && !Array.isArray(set)) {
      const summary = set as { text?: unknown; throughMessageId?: unknown };
      if (typeof summary.text === "string" && summary.text.length > 8_000 || typeof summary.throughMessageId === "string" && summary.throughMessageId.length > 128) {
        throw new StorageApiError("payload_too_large", 413, "滚动摘要内容超过限制。");
      }
    }
  }
  const patch = sanitizeConversationSummaryPatch(value);
  if (!patch) throw new StorageApiError("invalid_request", 400, "滚动摘要补丁无效。");
  return patch;
}

export function safePersistedMessage<Role extends "user" | "assistant">(value: unknown, role: Role): ConversationMessage & { role: Role } {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new StorageApiError("invalid_request", 400, "消息数据无效。");
  const raw = value as { id?: unknown; content?: unknown };
  if (typeof raw.id === "string" && raw.id.length > 128 || typeof raw.content === "string" && raw.content.length > MAX_MESSAGE_CHARACTERS) {
    throw new StorageApiError("payload_too_large", 413, "消息内容超过限制。");
  }
  const message = sanitizeConversationMessage(value);
  if (!message || message.role !== role) throw new StorageApiError("invalid_request", 400, "消息数据无效。");
  return message as ConversationMessage & { role: Role };
}

export async function readConversationJson(request: Request): Promise<Record<string, unknown>> {
  const raw = await readBoundedTextBody(request, CONVERSATION_API_BODY_CHARACTERS);
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid shape");
    return value as Record<string, unknown>;
  } catch {
    throw new StorageApiError("invalid_request", 400, "请求体不是合法 JSON 对象。");
  }
}

function mapRepositoryError(error: ConversationRepositoryError) {
  const code = error.code === "conflict" ? "revision_conflict" : error.code === "not_found" ? "not_found" : error.code === "unavailable" ? "storage_unavailable" : "invalid_request";
  return new StorageApiError(code, error.status, error.message, error.code === "unavailable");
}

export function storageRouteError(error: unknown) {
  const normalized = error instanceof ConversationRepositoryError ? mapRepositoryError(error) : error;
  const response = toStorageErrorResponse(normalized);
  return NextResponse.json(response.body, { status: response.status, headers: { "cache-control": "no-store" } });
}

export async function withConversationRepository(
  request: Request,
  operation: (repository: PrismaConversationRepository) => Promise<NextResponse>,
  missingWorkspace?: () => NextResponse,
) {
  try {
    const readOnly = request.method === "GET" || request.method === "HEAD";
    if (!readOnly) requireSameOrigin(request);
    const workspace = readOnly
      ? await resolveRequestWorkspace(request, { createIfMissing: false })
      : await resolveRequestWorkspace(request);
    if (!workspace) {
      const response = missingWorkspace
        ? missingWorkspace()
        : NextResponse.json({ ok: false, error: "not_found", message: "会话不存在。", retryable: false }, { status: 404 });
      response.headers.set("cache-control", "private, no-store");
      response.headers.set("vary", "Cookie");
      return response;
    }
    const response = await operation(new PrismaConversationRepository(workspace.workspaceId));
    response.headers.set("cache-control", "private, no-store");
    response.headers.set("vary", "Cookie");
    if (workspace.setCookie) response.headers.append("set-cookie", workspace.setCookie);
    return response;
  } catch (error) {
    return storageRouteError(error);
  }
}
