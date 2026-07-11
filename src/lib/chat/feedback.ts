import type { AgentApiResponse, ChatAnswerFeedbackItem, ChatAnswerFeedbackValue, ChatFeedbackSummary } from "@/types";
import { clearClientStorageList, readClientStorageList, writeClientStorageList, type ClientStorageListOptions } from "@/lib/clientStorage";

export const STORAGE_KEY = "enterprise-agent-hub:chat-answer-feedback";
const MAX_FEEDBACK_ITEMS = 100;

type FeedbackResult<T> = { ok: true; data: T } | { ok: false; data: T; error: string };

const feedbackValues = new Set<ChatAnswerFeedbackValue>(["positive", "negative", "accurate", "inaccurate"]);

function makeId() {
  return "feedback-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
}

function sanitizeFeedback(value: unknown): ChatAnswerFeedbackItem | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<ChatAnswerFeedbackItem>;
  if (typeof item.id !== "string" || typeof item.question !== "string" || item.question.length > 2_000 || typeof item.answerPreview !== "string" || !Array.isArray(item.values) || !item.values.length || !item.values.every((entry) => feedbackValues.has(entry as ChatAnswerFeedbackValue)) || typeof item.createdAt !== "string" || !Number.isFinite(Date.parse(item.createdAt))) return null;
  return { ...item, id: item.id.slice(0, 128), createdAt: item.createdAt, question: item.question, answerPreview: item.answerPreview.slice(0, 240), values: [...new Set(item.values)] as ChatAnswerFeedbackValue[], reason: typeof item.reason === "string" ? item.reason.slice(0, 500) : undefined, scenario: typeof item.scenario === "string" ? item.scenario.slice(0, 64) : "unknown", intent: typeof item.intent === "string" ? item.intent.slice(0, 64) : "unknown", responseMode: typeof item.responseMode === "string" ? item.responseMode.slice(0, 64) : "unknown", sourceTitles: Array.isArray(item.sourceTitles) ? item.sourceTitles.filter((title): title is string => typeof title === "string").slice(0, 5) : [] };
}
const storageOptions: ClientStorageListOptions<ChatAnswerFeedbackItem> = { key: STORAGE_KEY, version: 1, maxItems: MAX_FEEDBACK_ITEMS, sanitize: sanitizeFeedback };
function readRawFeedback() { return readClientStorageList(storageOptions); }
function writeRawFeedback(items: ChatAnswerFeedbackItem[]) { return writeClientStorageList(storageOptions, items); }

function isFallback(result: AgentApiResponse) {
  return result.api.responseMode === "fallback" || result.api.responseMode === "real_text_fallback" || result.api.responseMode === "real_error_fallback" || result.route.intent === "general_chat";
}

export function createChatAnswerFeedbackItem(result: AgentApiResponse, values: ChatAnswerFeedbackValue[], reason = ""): ChatAnswerFeedbackItem {
  return {
    id: makeId(),
    createdAt: new Date().toISOString(),
    question: result.question,
    answerPreview: result.finalAnswer.slice(0, 240),
    values,
    reason: reason.trim() || undefined,
    scenario: result.route.scenario,
    intent: result.route.intent,
    responseMode: result.api.responseMode,
    sourceTitles: result.ragAnswer?.sources.map((source) => source.title).slice(0, 5) ?? [],
    retrievalConfidence: result.ragAnswer?.retrievalConfidence ?? result.ragAnswer?.retrievalMetadata?.retrievalConfidence,
    fallback: isFallback(result),
  };
}

export function loadChatFeedback(): FeedbackResult<ChatAnswerFeedbackItem[]> {
  try {
    const loaded = readRawFeedback();
    return loaded.ok ? { ok: true, data: loaded.data } : { ok: false, data: loaded.data, error: loaded.error ?? "读取反馈记录失败。" };
  } catch (error) {
    return { ok: false, data: [], error: error instanceof Error ? error.message : "读取反馈记录失败。" };
  }
}

export function saveChatFeedback(result: AgentApiResponse, values: ChatAnswerFeedbackValue[], reason = ""): FeedbackResult<ChatAnswerFeedbackItem[]> {
  try {
    const item = createChatAnswerFeedbackItem(result, values, reason);
    const next = [item, ...readRawFeedback().data.filter((entry) => entry.id !== item.id)];
    const saved = writeRawFeedback(next);
    return saved.ok ? { ok: true, data: saved.data } : { ok: false, data: saved.data, error: saved.error ?? "保存反馈失败。" };
  } catch (error) {
    return { ok: false, data: [], error: error instanceof Error ? error.message : "保存反馈失败。" };
  }
}

export function clearChatFeedback(): FeedbackResult<ChatAnswerFeedbackItem[]> {
  try {
    const saved = clearClientStorageList(storageOptions);
    return saved.ok ? { ok: true, data: saved.data } : { ok: false, data: saved.data, error: saved.error ?? "清空反馈失败。" };
  } catch (error) {
    return { ok: false, data: [], error: error instanceof Error ? error.message : "清空反馈失败。" };
  }
}

export function summarizeChatFeedback(items: ChatAnswerFeedbackItem[]): ChatFeedbackSummary {
  const helpfulCount = items.filter((item) => item.values.includes("positive")).length;
  const notHelpfulCount = items.filter((item) => item.values.includes("negative")).length;
  const accurateCount = items.filter((item) => item.values.includes("accurate")).length;
  const inaccurateCount = items.filter((item) => item.values.includes("inaccurate")).length;
  const total = items.length;
  const issues = [
    notHelpfulCount ? `回答帮助不足 ${notHelpfulCount} 次` : "",
    inaccurateCount ? `引用不准确 ${inaccurateCount} 次` : "",
    items.filter((item) => item.fallback).length ? `兜底回答 ${items.filter((item) => item.fallback).length} 次` : "",
    items.filter((item) => item.retrievalConfidence === "low").length ? `低置信检索 ${items.filter((item) => item.retrievalConfidence === "low").length} 次` : "",
  ].filter(Boolean);

  return {
    total,
    helpfulCount,
    notHelpfulCount,
    accurateCount,
    inaccurateCount,
    helpfulRate: total ? Math.round((helpfulCount / total) * 100) : 0,
    citationAccuracyRate: total ? Math.round((accurateCount / total) * 100) : 0,
    commonIssueTypes: issues,
    recent: items.slice(0, 5),
  };
}
