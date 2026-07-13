import { afterEach, describe, expect, it } from "vitest";
import { appendConversationTurn, CONVERSATION_STORAGE_KEY, loadConversationStore, startNewConversation } from "@/lib/conversation/storage";
import { STORAGE_KEY as CHAT_HISTORY_KEY } from "@/lib/chat/history";
import type { AgentApiResponse } from "@/types";

function installStorage() {
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value), removeItem: (key: string) => data.delete(key) } } });
  return data;
}

function result(runId = "run-1"): AgentApiResponse {
  return { question: "订单10001可以退货吗？", route: { scenario: "ecommerce", intent: "policy_check", needRag: true, toolsNeeded: [], confidence: 0.9, reason: "test" }, steps: [], ragAnswer: null, toolResults: [], finalAnswer: "可以申请退货。", structuredOutput: { scenario: "ecommerce", intent: "policy_check", answer: "可以申请退货。", evidence: [], toolsUsed: [], sources: [], confidence: 0.9, riskLevel: "low", nextAction: "准备材料" }, createdAt: new Date().toISOString(), mode: "mock-agent", api: { requestedMode: "mock", responseMode: "mock" }, runId };
}

afterEach(() => Reflect.deleteProperty(globalThis, "window"));

describe("conversation storage", () => {
  it("migrates legacy flat chat history without changing its key", () => {
    const storage = installStorage();
    const legacy = [{ id: "old", createdAt: "2026-01-01T00:00:00.000Z", question: "旧问题", finalAnswer: "旧回答", responseMode: "mock", scenario: "enterprise", intent: "knowledge_qa" }];
    storage.set(CHAT_HISTORY_KEY, JSON.stringify(legacy));
    const loaded = loadConversationStore().data;
    expect(loaded.conversations[0]?.messages.map((item) => item.content)).toEqual(["旧问题", "旧回答"]);
    expect(storage.get(CHAT_HISTORY_KEY)).toContain("旧问题");
  });

  it("recovers corrupted storage and filters invalid messages", () => {
    const storage = installStorage();
    storage.set(CONVERSATION_STORAGE_KEY, "{");
    expect(loadConversationStore().data.conversations[0]?.messages).toEqual([]);
    storage.set(CONVERSATION_STORAGE_KEY, JSON.stringify({ version: 1, data: [{ activeConversationId: "c", conversations: [{ id: "c", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", messages: [{ id: "bad", role: "system", content: "secret", createdAt: "2026-01-01T00:00:00.000Z" }, { id: "ok", role: "user", content: "valid", createdAt: "2026-01-01T00:00:00.000Z" }] }] }], updatedAt: "2026-01-01T00:00:00.000Z" }));
    expect(loadConversationStore().data.conversations[0]?.messages.map((item) => item.content)).toEqual(["valid"]);
    expect(storage.get(CONVERSATION_STORAGE_KEY)).not.toMatch(/secret|system/);
  });

  it("persists successful turns, deduplicates runId and isolates a new conversation", () => {
    installStorage();
    const initial = loadConversationStore().data;
    const saved = appendConversationTurn(initial, "订单10001可以退货吗？", result()).data;
    expect(saved.conversations[0]?.messages).toHaveLength(2);
    expect(appendConversationTurn(saved, "重复", result()).data.conversations[0]?.messages).toHaveLength(2);
    const next = startNewConversation(saved).data;
    expect(next.activeConversationId).not.toBe(saved.activeConversationId);
    expect(next.conversations[0]?.messages).toEqual([]);
  });

  it("caps conversations and messages from the recent end", () => {
    installStorage();
    let store = loadConversationStore().data;
    for (let index = 0; index < 12; index += 1) store = startNewConversation(store).data;
    expect(store.conversations).toHaveLength(10);
    for (let index = 0; index < 55; index += 1) store = appendConversationTurn(store, `question-${index}`, result(`run-${index}`)).data;
    expect(store.conversations[0]?.messages).toHaveLength(100);
    expect(store.conversations[0]?.messages.at(-2)?.content).toBe("question-54");
  });
});
