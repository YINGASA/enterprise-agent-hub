import { afterEach, describe, expect, it, vi } from "vitest";
import { CONVERSATION_STORAGE_KEY, getLastCompletedTurn } from "@/lib/conversation/storage";
import { ConversationRepositoryError, LocalConversationRepository, ServerConversationRepository } from "@/lib/storage/conversationRepository";
import type { AgentApiResponse } from "@/types";

const savedAt = "2026-07-16T00:00:00.000Z";

function installStorage() {
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage: { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value), removeItem: (key: string) => data.delete(key) } },
  });
  return data;
}

function result(runId: string, answer = "已完成。") : AgentApiResponse {
  return {
    question: "请处理订单 ORD-10001",
    route: { scenario: "ecommerce", intent: "order_query", needRag: false, toolsNeeded: [], confidence: 0.9, reason: "test" },
    steps: [{ id: "safe", name: "route", type: "router", status: "success", input: { prompt: "secret" }, output: {}, durationMs: 1 }],
    ragAnswer: null,
    toolResults: [],
    finalAnswer: answer,
    structuredOutput: { scenario: "ecommerce", intent: "order_query", answer, evidence: [], toolsUsed: [], sources: [], confidence: 0.9, riskLevel: "low", nextAction: "done" },
    createdAt: savedAt,
    mode: "mock-agent",
    api: { requestedMode: "mock", responseMode: "mock", contextApplied: true, contextMessageCount: 2, contextTruncated: false, contextCharacterCount: 32 },
    runId,
  };
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, "window");
  vi.unstubAllGlobals();
});

describe("LocalConversationRepository", () => {
  it("defaults legacy revision to zero and increments each successful atomic mutation", async () => {
    const storage = installStorage();
    storage.set(CONVERSATION_STORAGE_KEY, JSON.stringify({ version: 1, updatedAt: savedAt, data: [{
      activeConversationId: "c-1",
      legacyHistoryMigrated: true,
      conversations: [{ id: "c-1", title: "旧会话", titleSource: "manual", createdAt: savedAt, updatedAt: savedAt, schemaVersion: 1, messages: [] }],
    }] }));
    const repository = new LocalConversationRepository();
    expect((await repository.get("c-1"))?.revision).toBe(0);

    const appended = await repository.appendTurn({ conversationId: "c-1", expectedRevision: 0, question: "问题", result: result("run-1") });
    expect(appended).toMatchObject({ revision: 1 });
    expect(appended.messages).toHaveLength(2);

    const renamed = await repository.rename({ conversationId: "c-1", expectedRevision: 1, title: "已更新" });
    expect(renamed).toMatchObject({ title: "已更新", revision: 2 });
  });

  it("rejects stale revision and message CAS without partially applying a summary patch", async () => {
    installStorage();
    const repository = new LocalConversationRepository();
    const conversation = (await repository.list())[0]!;
    const appended = await repository.appendTurn({ conversationId: conversation.id, expectedRevision: 0, question: "问题", result: result("run-1") });
    const turn = getLastCompletedTurn(appended)!;

    await expect(repository.regenerateLastAssistant({
      conversationId: appended.id,
      expectedRevision: 0,
      expectedAssistantMessageId: turn.assistantMessage.id,
      result: result("run-2"),
      conversationSummaryPatch: { clear: true },
    })).rejects.toMatchObject({ code: "conflict", status: 409 });
    expect(await repository.get(appended.id)).toEqual(appended);
  });
});

describe("ServerConversationRepository", () => {
  it("uses the native fetch function without an illegal receiver", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ conversations: [] }));
    vi.stubGlobal("fetch", fetchImpl);
    const repository = new ServerConversationRepository();

    await expect(repository.list()).resolves.toEqual([]);
    expect(fetchImpl).toHaveBeenCalledWith("/api/storage/conversations", expect.objectContaining({ credentials: "same-origin" }));
  });

  it("sends only minimal completed messages and safe assistant details", async () => {
    const responseConversation = { id: "c", revision: 1 };
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => new Response(JSON.stringify({ conversation: responseConversation }), { status: 200, headers: { "content-type": "application/json" } }));
    const repository = new ServerConversationRepository(fetchImpl);
    await repository.appendTurn({ conversationId: "c", expectedRevision: 0, question: "问题", result: result("run-1") });
    const [, init] = fetchImpl.mock.calls[0]!;
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({ expectedRevision: 0, userMessage: { role: "user", content: "问题" }, assistantMessage: { role: "assistant", content: "已完成。", runId: "run-1" } });
    expect(JSON.stringify(body)).not.toContain("secret");
    expect(body).not.toHaveProperty("result");
  });

  it("maps CAS and degraded failures without silently falling back to local storage", async () => {
    const conflict = new ServerConversationRepository(async () => new Response(JSON.stringify({ message: "conflict" }), { status: 409 }));
    await expect(conflict.rename({ conversationId: "c", expectedRevision: 0, title: "x" })).rejects.toMatchObject({ code: "conflict", status: 409 });

    const unavailable = new ServerConversationRepository(async () => { throw new Error("offline"); });
    await expect(unavailable.list()).rejects.toEqual(expect.objectContaining<Partial<ConversationRepositoryError>>({ code: "unavailable", status: 503 }));

    const missing = new ServerConversationRepository(async () => new Response(JSON.stringify({ message: "missing" }), { status: 404 }));
    await expect(missing.get("missing")).resolves.toBeNull();
  });
});
