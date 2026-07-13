import { afterEach, describe, expect, it } from "vitest";
import {
  appendConversationTurn,
  appendConversationTurnToConversation,
  clearCurrentConversation,
  CONVERSATION_STORAGE_KEY,
  createConversation,
  deleteConversation,
  deleteCurrentConversation,
  getLastCompletedTurn,
  loadConversationStore,
  renameConversation,
  replaceLastCompletedAssistant,
  replaceLastCompletedTurn,
  searchConversations,
  startNewConversation,
} from "@/lib/conversation/storage";
import { STORAGE_KEY as CHAT_HISTORY_KEY } from "@/lib/chat/history";
import type { AgentApiResponse } from "@/types";

const savedAt = "2026-01-01T00:00:00.000Z";

function installStorage() {
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, value: string) => data.set(key, value),
        removeItem: (key: string) => data.delete(key),
      },
    },
  });
  return data;
}

function envelope(store: object) {
  return JSON.stringify({ version: 1, data: [store], updatedAt: savedAt });
}

function result(runId = "run-1"): AgentApiResponse {
  return {
    question: "Can order 10001 be returned?",
    route: { scenario: "ecommerce", intent: "policy_check", needRag: true, toolsNeeded: [], confidence: 0.9, reason: "test" },
    steps: [],
    ragAnswer: null,
    toolResults: [],
    finalAnswer: "The order can be returned.",
    structuredOutput: { scenario: "ecommerce", intent: "policy_check", answer: "The order can be returned.", evidence: [], toolsUsed: [], sources: [], confidence: 0.9, riskLevel: "low", nextAction: "Prepare the required materials." },
    createdAt: new Date().toISOString(),
    mode: "mock-agent",
    api: { requestedMode: "mock", responseMode: "mock", contextApplied: true, contextMessageCount: 2, contextTruncated: false, contextCharacterCount: 80 },
    runId,
  };
}

afterEach(() => Reflect.deleteProperty(globalThis, "window"));

describe("conversation storage", () => {
  it("migrates legacy flat chat history without changing its key", () => {
    const storage = installStorage();
    const legacy = [{ id: "old", createdAt: savedAt, question: "旧问题", finalAnswer: "旧回答", responseMode: "mock", scenario: "enterprise", intent: "knowledge_qa" }];
    storage.set(CHAT_HISTORY_KEY, JSON.stringify(legacy));
    const loaded = loadConversationStore().data;
    expect(loaded.conversations[0]?.messages.map((item) => item.content)).toEqual(["旧问题", "旧回答"]);
    expect(loaded.conversations[0]).toMatchObject({ title: "旧问题", titleSource: "auto" });
    expect(storage.get(CHAT_HISTORY_KEY)).toContain("旧问题");
  });

  it("recovers corrupted storage and filters invalid messages", () => {
    const storage = installStorage();
    storage.set(CONVERSATION_STORAGE_KEY, "{");
    expect(loadConversationStore().data.conversations[0]?.messages).toEqual([]);
    storage.set(CONVERSATION_STORAGE_KEY, envelope({ activeConversationId: "c", conversations: [{ id: "c", createdAt: savedAt, updatedAt: savedAt, messages: [{ id: "bad", role: "system", content: "secret", createdAt: savedAt }, { id: "ok", role: "user", content: "valid", createdAt: savedAt }] }] }));
    expect(loadConversationStore().data.conversations[0]?.messages.map((item) => item.content)).toEqual(["valid"]);
    expect(storage.get(CONVERSATION_STORAGE_KEY)).not.toMatch(/secret|system/);
  });

  it("fills a stable title for V2.0.0 conversations without title", () => {
    const storage = installStorage();
    storage.set(CONVERSATION_STORAGE_KEY, envelope({ activeConversationId: "c", conversations: [{ id: "c", createdAt: savedAt, updatedAt: savedAt, schemaVersion: 1, messages: [{ id: "q", role: "user", content: "  把项目升级到 2.0 版本  ", createdAt: savedAt }] }], legacyHistoryMigrated: true }));
    const first = loadConversationStore().data;
    const second = loadConversationStore().data;
    expect(first.conversations[0]).toMatchObject({ title: "把项目升级到 2.0 版本", titleSource: "auto" });
    expect(second.conversations[0]?.title).toBe(first.conversations[0]?.title);
  });

  it("persists successful turns, context metadata and deduplicates runId", () => {
    const storage = installStorage();
    const initial = loadConversationStore().data;
    const response = result();
    response.steps = [{ id: "rag", name: "retrieve", type: "rag", status: "success", input: { secret: "step-input" }, output: { secret: "step-output" }, durationMs: 4 }];
    response.toolResults = [{ tool: "searchPolicy", status: "success", input: { secret: "tool-input" }, data: { secret: "tool-data" }, executedAt: savedAt }];
    response.ragAnswer = { question: response.question, answer: response.finalAnswer, retrievedChunks: [], sources: [{ documentId: "policy", title: "Return Policy", category: "return", sourceType: "default", score: 0.8, contentPreview: "source-secret", chunkIndexes: [0] }], mode: "mock-rag", createdAt: savedAt, retrievalConfidence: "high" };
    const saved = appendConversationTurn(initial, "Can order 10001 be returned?", response).data;
    expect(saved.conversations[0]?.messages).toHaveLength(2);
    expect(saved.conversations[0]?.messages[0]).not.toHaveProperty("contextApplied");
    expect(saved.conversations[0]?.messages[1]).toMatchObject({ contextApplied: true, contextMessageCount: 2, contextTruncated: false, contextCharacterCount: 80, details: { sources: [{ documentId: "policy", title: "Return Policy", category: "return", sourceType: "default", score: 0.8, chunkIndexes: [0] }], tools: [{ tool: "searchPolicy", status: "success" }], steps: [{ id: "rag", name: "retrieve", type: "rag", status: "success", durationMs: 4 }], retrievalConfidence: "high", confidence: 0.9, riskLevel: "low" } });
    expect(storage.get(CONVERSATION_STORAGE_KEY)).not.toMatch(/step-input|step-output|tool-input|tool-data|source-secret|contentPreview/);
    expect(appendConversationTurn(saved, "duplicate", result()).data.conversations[0]?.messages).toHaveLength(2);
    const next = startNewConversation(saved).data;
    expect(next.activeConversationId).not.toBe(saved.activeConversationId);
    expect(next.conversations[0]?.messages).toEqual([]);
  });

  it("generates, renames, searches and clears titles without overwriting manual titles", () => {
    installStorage();
    const initial = loadConversationStore().data;
    const saved = appendConversationTurn(initial, "这是一个超过十八个字符的首条用户问题用于生成标题", result()).data;
    expect(saved.conversations[0]?.title).toBe("这是一个超过十八个字符的首条用户问题…");
    const renamed = renameConversation(saved, saved.activeConversationId, "  发布准备  ").data;
    const continued = appendConversationTurn(renamed, "continue", result("run-2")).data;
    expect(continued.conversations[0]).toMatchObject({ title: "发布准备", titleSource: "manual" });
    expect(searchConversations(continued.conversations, "发布").map((item) => item.id)).toEqual([continued.activeConversationId]);
    expect(renameConversation(continued, continued.activeConversationId, "   ").ok).toBe(false);
    expect(renameConversation(continued, continued.activeConversationId, "x".repeat(41)).ok).toBe(false);
    const cleared = clearCurrentConversation(continued).data;
    expect(cleared.conversations[0]).toMatchObject({ id: continued.activeConversationId, title: "新对话", titleSource: "auto", messages: [] });
  });

  it("keeps empty conversations idempotent and does not resurrect deleted targets", () => {
    installStorage();
    const initial = loadConversationStore().data;
    expect(startNewConversation(initial).data).toEqual(initial);
    const replacement = deleteCurrentConversation(initial).data;
    expect(replacement.conversations).toHaveLength(1);
    expect(replacement.activeConversationId).not.toBe(initial.activeConversationId);
    const saved = appendConversationTurn(replacement, "first", result()).data;
    const second = startNewConversation(saved).data;
    expect(deleteConversation(second, saved.activeConversationId).data.activeConversationId).toBe(second.activeConversationId);
    const deletedId = second.activeConversationId;
    const afterDelete = deleteCurrentConversation(second).data;
    const late = appendConversationTurnToConversation(afterDelete, deletedId, "late", result("run-late"));
    expect(afterDelete.conversations.some((item) => item.id === deletedId)).toBe(false);
    expect(late.ok).toBe(false);
    expect(late.data).toEqual(afterDelete);
  });

  it("keeps only whitelisted compact assistant details", () => {
    const storage = installStorage();
    storage.set(CONVERSATION_STORAGE_KEY, envelope({ activeConversationId: "c", conversations: [{ id: "c", title: "test", titleSource: "auto", createdAt: savedAt, updatedAt: savedAt, messages: [
      { id: "u", role: "user", content: "valid", createdAt: savedAt, contextApplied: true, details: { prompt: "secret-user" } },
      { id: "a", role: "assistant", content: "answer", createdAt: "2026-01-01T00:00:01.000Z", contextMessageCount: 999, details: { sources: [{ documentId: "d", title: "Policy", category: "expense", sourceType: "default", score: 0.8, chunkIndexes: [1], contentPreview: "secret-source" }], tools: [{ tool: "searchPolicy", status: "success", data: { token: "secret-tool" } }], steps: [{ id: "s", name: "route", type: "router", status: "success", durationMs: 3, input: { prompt: "secret-step" } }], prompt: "secret-prompt" } },
    ] }], legacyHistoryMigrated: true }));
    const loaded = loadConversationStore().data;
    expect(loaded.conversations[0]?.messages[0]).not.toHaveProperty("details");
    expect(loaded.conversations[0]?.messages[1]).toMatchObject({ contextMessageCount: 12, details: { sources: [{ documentId: "d", title: "Policy", category: "expense", sourceType: "default", score: 0.8, chunkIndexes: [1] }], tools: [{ tool: "searchPolicy", status: "success" }], steps: [{ id: "s", name: "route", type: "router", status: "success", durationMs: 3 }] } });
    expect(storage.get(CONVERSATION_STORAGE_KEY)).not.toMatch(/secret-|contentPreview|\"input\"|\"prompt\"/);
    expect(JSON.stringify(loaded.conversations[0]?.messages[1])).not.toContain('"data"');
  });

  it("caps conversations and messages from the recent end", () => {
    installStorage();
    let store = loadConversationStore().data;
    for (let index = 0; index < 12; index += 1) {
      store = appendConversationTurn(store, `seed-${index}`, result(`seed-run-${index}`)).data;
      store = startNewConversation(store).data;
    }
    expect(store.conversations).toHaveLength(10);
    for (let index = 0; index < 55; index += 1) store = appendConversationTurn(store, `question-${index}`, result(`run-${index}`)).data;
    expect(store.conversations[0]?.messages).toHaveLength(100);
    expect(store.conversations[0]?.messages.at(-2)?.content).toBe("question-54");
  });

  it("materializes an in-memory draft without replacing the existing conversation", () => {
    installStorage();
    const initial = loadConversationStore().data;
    const first = appendConversationTurn(initial, "第一段会话", result("run-first")).data;
    const draft = createConversation();
    const working = { ...first, activeConversationId: draft.id, conversations: [draft, ...first.conversations] };
    const second = appendConversationTurnToConversation(working, draft.id, "第二段会话", result("run-second"));
    expect(second.ok).toBe(true);
    expect(second.data.conversations).toHaveLength(2);
    expect(second.data.activeConversationId).toBe(draft.id);
    expect(second.data.conversations.find((conversation) => conversation.id === initial.activeConversationId)?.messages).toHaveLength(2);
  });

  it("identifies the tail completed turn and atomically replaces only its assistant", () => {
    installStorage();
    const initial = loadConversationStore().data;
    const first = appendConversationTurn(initial, "first question", result("run-first")).data;
    const second = appendConversationTurn(first, "second question", result("run-second")).data;
    const conversation = second.conversations.find((item) => item.id === second.activeConversationId)!;
    const originalTurn = getLastCompletedTurn(conversation)!;
    expect(originalTurn.contextMessages).toHaveLength(2);
    expect(originalTurn.userMessage.content).toBe("second question");
    expect(originalTurn.assistantMessage.runId).toBe("run-second");

    const replacementResult = result("run-regenerated");
    replacementResult.finalAnswer = "Regenerated answer.";
    replacementResult.structuredOutput.answer = replacementResult.finalAnswer;
    const replaced = replaceLastCompletedAssistant(second, conversation.id, replacementResult, originalTurn.assistantMessage.id);
    const replacedConversation = replaced.data.conversations.find((item) => item.id === conversation.id)!;
    const replacedTurn = getLastCompletedTurn(replacedConversation)!;
    expect(replaced.ok).toBe(true);
    expect(replacedConversation.messages).toHaveLength(4);
    expect(replacedTurn.userMessage.id).toBe(originalTurn.userMessage.id);
    expect(replacedTurn.assistantMessage.id).not.toBe(originalTurn.assistantMessage.id);
    expect(replacedTurn.assistantMessage).toMatchObject({ content: "Regenerated answer.", runId: "run-regenerated" });
    expect(replacedConversation.messages.filter((message) => message.role === "user" && message.content === "second question")).toHaveLength(1);

    expect(replaceLastCompletedAssistant(second, conversation.id, replacementResult, "stale-message")).toMatchObject({ ok: false, data: second });
    expect(replaceLastCompletedAssistant(second, conversation.id, result("run-second"), originalTurn.assistantMessage.id)).toMatchObject({ ok: false, data: second });
  });

  it("atomically replaces the last turn and updates only a first auto title", () => {
    installStorage();
    const initial = loadConversationStore().data;
    const first = appendConversationTurn(initial, "original first question", result("run-original")).data;
    const originalConversation = first.conversations[0]!;
    const originalTurn = getLastCompletedTurn(originalConversation)!;
    const editedResult = result("run-edited");
    editedResult.finalAnswer = "Edited answer.";
    editedResult.structuredOutput.answer = editedResult.finalAnswer;
    const edited = replaceLastCompletedTurn(first, originalConversation.id, "edited first question", editedResult, {
      userMessageId: originalTurn.userMessage.id,
      assistantMessageId: originalTurn.assistantMessage.id,
    });
    const editedConversation = edited.data.conversations[0]!;
    const editedTurn = getLastCompletedTurn(editedConversation)!;
    expect(edited.ok).toBe(true);
    expect(editedConversation).toMatchObject({ title: "edited first quest…", titleSource: "auto" });
    expect(editedConversation.messages).toHaveLength(2);
    expect(editedTurn.userMessage).toMatchObject({ content: "edited first question" });
    expect(editedTurn.userMessage.id).not.toBe(originalTurn.userMessage.id);
    expect(editedTurn.assistantMessage).toMatchObject({ content: "Edited answer.", runId: "run-edited" });
    expect(editedTurn.assistantMessage.id).not.toBe(originalTurn.assistantMessage.id);

    const renamed = renameConversation(edited.data, editedConversation.id, "Manual title").data;
    const manualTurn = getLastCompletedTurn(renamed.conversations[0]!)!;
    const manualEdit = replaceLastCompletedTurn(renamed, editedConversation.id, "another first question", result("run-manual-edit"), {
      userMessageId: manualTurn.userMessage.id,
      assistantMessageId: manualTurn.assistantMessage.id,
    });
    expect(manualEdit.data.conversations[0]).toMatchObject({ title: "Manual title", titleSource: "manual" });

    const continued = appendConversationTurn(edited.data, "second question", result("run-second")).data;
    const continuedConversation = continued.conversations[0]!;
    const continuedTurn = getLastCompletedTurn(continuedConversation)!;
    const editedSecond = replaceLastCompletedTurn(continued, continuedConversation.id, "edited second question", result("run-second-edited"), {
      userMessageId: continuedTurn.userMessage.id,
      assistantMessageId: continuedTurn.assistantMessage.id,
    });
    expect(editedSecond.data.conversations[0]).toMatchObject({ title: editedConversation.title, titleSource: "auto" });
  });

  it("rejects invalid or stale replacement input without changing storage", () => {
    const storage = installStorage();
    storage.set(CONVERSATION_STORAGE_KEY, envelope({ activeConversationId: "c", conversations: [{ id: "c", title: "test", titleSource: "auto", createdAt: savedAt, updatedAt: savedAt, schemaVersion: 1, messages: [{ id: "u", role: "user", content: "unpaired", createdAt: savedAt }] }], legacyHistoryMigrated: true }));
    const unpaired = loadConversationStore().data;
    expect(getLastCompletedTurn(unpaired.conversations[0]!)).toBeNull();
    expect(replaceLastCompletedAssistant(unpaired, "c", result("run-new"))).toMatchObject({ ok: false, data: unpaired });
    expect(replaceLastCompletedTurn(unpaired, "c", "replacement", result("run-new"))).toMatchObject({ ok: false, data: unpaired });

    const completed = appendConversationTurn(unpaired, "paired", result("run-paired")).data;
    const before = JSON.stringify(completed);
    const emptyAnswer = result("run-empty");
    emptyAnswer.finalAnswer = " ";
    emptyAnswer.structuredOutput.answer = " ";
    expect(replaceLastCompletedAssistant(completed, "c", emptyAnswer).ok).toBe(false);
    expect(replaceLastCompletedTurn(completed, "c", " ", result("run-edit")).ok).toBe(false);
    const missingRunId = result();
    delete missingRunId.runId;
    expect(replaceLastCompletedAssistant(completed, "c", missingRunId).ok).toBe(false);
    expect(replaceLastCompletedTurn(completed, "c", "replacement", missingRunId).ok).toBe(false);
    expect(JSON.stringify(completed)).toBe(before);
  });
});
