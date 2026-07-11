import { afterEach, describe, expect, it } from "vitest";
import { STORAGE_KEY as chatKey, clearChatHistory, loadChatHistory } from "@/lib/chat/history";
import { STORAGE_KEY as feedbackKey, clearChatFeedback, loadChatFeedback } from "@/lib/chat/feedback";
import { STORAGE_KEY as evaluationKey, clearEvaluationHistory, loadEvaluationHistory } from "@/lib/evaluation/history";

function installStorage() {
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value), removeItem: (key: string) => data.delete(key) } } });
  return data;
}
const at = "2026-01-01T00:00:00.000Z";
const chat = (id: string) => ({ id, createdAt: at, question: "Question", finalAnswer: "Answer", responseMode: "mock", scenario: "enterprise", intent: "knowledge_qa" });
const feedback = (id: string, values = ["positive"]) => ({ id, createdAt: at, question: "Question", answerPreview: "Answer", values, scenario: "enterprise", intent: "knowledge_qa", responseMode: "mock", sourceTitles: [] });
const evaluation = (id: string, overrides = {}) => ({ id, createdAt: at, mode: "mock", suite: "full", caseCount: 80, passed: 80, passRate: 100, scenarioAccuracy: 100, intentAccuracy: 100, toolHitRate: 100, ragUsageAccuracy: 100, citationRate: 100, keywordHitRate: 100, ...overrides });

afterEach(() => Reflect.deleteProperty(globalThis, "window"));

describe("module storage migrations", () => {
  it("migrates chat arrays, filters invalid entries, trims to 30, and clears", () => {
    const storage = installStorage();
    storage.set(chatKey, JSON.stringify([...Array.from({ length: 31 }, (_, index) => chat(`c-${index}`)), { id: "bad" }]));
    expect(loadChatHistory()).toMatchObject({ ok: true, data: expect.any(Array) });
    expect(loadChatHistory().data).toHaveLength(30);
    expect(JSON.parse(storage.get(chatKey) ?? "{}")).toMatchObject({ version: 1 });
    expect(clearChatHistory()).toMatchObject({ ok: true, data: [] });
  });

  it("migrates feedback arrays, filters invalid types, trims reasons and handles clear", () => {
    const storage = installStorage();
    storage.set(feedbackKey, JSON.stringify([...Array.from({ length: 101 }, (_, index) => feedback(`f-${index}`)), feedback("bad", ["unknown"]), feedback("long", ["positive"]).constructor ? feedback("long", ["positive"]) : null]));
    const loaded = loadChatFeedback();
    expect(loaded.ok).toBe(true);
    expect(loaded.data).toHaveLength(100);
    expect(clearChatFeedback()).toMatchObject({ ok: true, data: [] });
  });

  it("migrates evaluation arrays, rejects invalid metrics, trims to 20, and clears", () => {
    const storage = installStorage();
    storage.set(evaluationKey, JSON.stringify([...Array.from({ length: 21 }, (_, index) => evaluation(`e-${index}`)), evaluation("invalid", { passed: 81 }), evaluation("rate", { passRate: 101 })]));
    const loaded = loadEvaluationHistory();
    expect(loaded.ok).toBe(true);
    expect(loaded.data).toHaveLength(20);
    expect(JSON.stringify(loaded.data)).not.toMatch(/provider|baseUrl|apiKey/i);
    expect(clearEvaluationHistory()).toMatchObject({ ok: true, data: [] });
  });
});
