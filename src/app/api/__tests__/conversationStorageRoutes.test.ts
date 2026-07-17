import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConversationRepositoryError } from "@/lib/storage/conversationRepository";

const { repository, PrismaConversationRepository, resolveRequestWorkspace } = vi.hoisted(() => ({
  repository: {
    list: vi.fn(), get: vi.fn(), create: vi.fn(), rename: vi.fn(), clear: vi.fn(), remove: vi.fn(),
    appendPersistedTurn: vi.fn(), regeneratePersistedAssistant: vi.fn(), editAndResendPersistedTurn: vi.fn(),
  },
  PrismaConversationRepository: vi.fn(),
  resolveRequestWorkspace: vi.fn(),
}));

vi.mock("@/lib/server-storage/conversationRepository", () => ({ PrismaConversationRepository }));
vi.mock("@/lib/server-storage/workspace", () => ({ resolveRequestWorkspace }));

import { GET as listConversations, POST as createConversation } from "@/app/api/storage/conversations/route";
import { POST as appendTurn } from "@/app/api/storage/conversations/[id]/turns/route";
import { POST as regenerate } from "@/app/api/storage/conversations/[id]/regenerate/route";

const routeContext = { params: Promise.resolve({ id: "conversation-a" }) };
const origin = "http://test.local";
const messageTime = "2026-07-16T00:00:00.000Z";

function request(path: string, body?: unknown, options: { origin?: boolean } = { origin: true }) {
  const headers = new Headers();
  if (body !== undefined) headers.set("content-type", "application/json");
  if (options.origin !== false) headers.set("origin", origin);
  return new Request(`${origin}${path}`, { method: body === undefined ? "GET" : "POST", headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

beforeEach(() => {
  vi.clearAllMocks();
  PrismaConversationRepository.mockImplementation(() => repository);
  resolveRequestWorkspace.mockResolvedValue({ workspaceId: "workspace-a", setCookie: "workspace=session; HttpOnly; SameSite=Lax" });
  repository.list.mockResolvedValue([]);
  repository.create.mockResolvedValue({ id: "conversation-a", revision: 0 });
  repository.appendPersistedTurn.mockResolvedValue({ id: "conversation-a", revision: 1 });
  repository.regeneratePersistedAssistant.mockResolvedValue({ id: "conversation-a", revision: 2 });
});

describe("conversation storage routes", () => {
  it("resolves the anonymous workspace server-side and never accepts a client workspace id", async () => {
    const response = await listConversations(request("/api/storage/conversations"));
    expect(response.status).toBe(200);
    expect(PrismaConversationRepository).toHaveBeenCalledWith("workspace-a");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");

    await createConversation(request("/api/storage/conversations", { id: "conversation-a", workspaceId: "attacker" }));
    expect(repository.create).toHaveBeenCalledWith({ id: "conversation-a", title: undefined, createdAt: undefined });
  });

  it("returns an empty read model without creating a workspace for a first-time GET", async () => {
    resolveRequestWorkspace.mockResolvedValueOnce(null);
    const response = await listConversations(request("/api/storage/conversations"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, conversations: [] });
    expect(PrismaConversationRepository).not.toHaveBeenCalled();
    expect(resolveRequestWorkspace).toHaveBeenCalledWith(expect.any(Request), { createIfMissing: false });
  });

  it("requires same-origin metadata for every write", async () => {
    const response = await createConversation(request("/api/storage/conversations", {}, { origin: false }));
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: "forbidden_origin" });
    expect(resolveRequestWorkspace).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("validates minimal turn payloads and rejects system or oversized messages", async () => {
    const validBody = {
      expectedRevision: 0,
      userMessage: { id: "u-1", role: "user", content: "问题", createdAt: messageTime },
      assistantMessage: { id: "a-1", role: "assistant", content: "回答", createdAt: messageTime, runId: "run-1" },
    };
    expect((await appendTurn(request("/api/storage/conversations/conversation-a/turns", validBody), routeContext)).status).toBe(200);
    expect(repository.appendPersistedTurn).toHaveBeenCalledWith(expect.objectContaining({ conversationId: "conversation-a", expectedRevision: 0 }));

    const system = await appendTurn(request("/api/storage/conversations/conversation-a/turns", { ...validBody, userMessage: { ...validBody.userMessage, role: "system" } }), routeContext);
    expect(system.status).toBe(400);
    const oversized = await appendTurn(request("/api/storage/conversations/conversation-a/turns", { ...validBody, userMessage: { ...validBody.userMessage, content: "x".repeat(2_001) } }), routeContext);
    expect(oversized.status).toBe(413);
  });

  it("returns 409 for revision or message CAS without exposing internal details", async () => {
    repository.regeneratePersistedAssistant.mockRejectedValueOnce(new ConversationRepositoryError("conflict", "会话尾部已变化。", 409));
    const response = await regenerate(request("/api/storage/conversations/conversation-a/regenerate", {
      expectedRevision: 1,
      expectedAssistantMessageId: "a-old",
      assistantMessage: { id: "a-new", role: "assistant", content: "新回答", createdAt: messageTime, runId: "run-new" },
    }), routeContext);
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ ok: false, error: "revision_conflict", message: "会话尾部已变化。", retryable: false });
  });
});
