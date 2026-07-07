import type { AgentApiResponse, ChatAnswerFeedbackItem, ChatAnswerFeedbackValue, ChatFeedbackSummary } from "@/types";

const STORAGE_KEY = "enterprise-agent-hub:chat-answer-feedback";
const MAX_FEEDBACK_ITEMS = 100;

type FeedbackResult<T> = { ok: true; data: T } | { ok: false; data: T; error: string };

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function makeId() {
  return "feedback-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
}

function isFeedbackItem(value: unknown): value is ChatAnswerFeedbackItem {
  return Boolean(value && typeof value === "object" && "id" in value && "question" in value && "values" in value);
}

function readRawFeedback(): ChatAnswerFeedbackItem[] {
  if (!canUseStorage()) return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isFeedbackItem).slice(0, MAX_FEEDBACK_ITEMS);
}

function writeRawFeedback(items: ChatAnswerFeedbackItem[]) {
  if (!canUseStorage()) throw new Error("当前浏览器不支持 localStorage。");
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_FEEDBACK_ITEMS)));
}

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
    return { ok: true, data: readRawFeedback() };
  } catch (error) {
    return { ok: false, data: [], error: error instanceof Error ? error.message : "读取反馈记录失败。" };
  }
}

export function saveChatFeedback(result: AgentApiResponse, values: ChatAnswerFeedbackValue[], reason = ""): FeedbackResult<ChatAnswerFeedbackItem[]> {
  try {
    const item = createChatAnswerFeedbackItem(result, values, reason);
    const next = [item, ...readRawFeedback()].slice(0, MAX_FEEDBACK_ITEMS);
    writeRawFeedback(next);
    return { ok: true, data: next };
  } catch (error) {
    return { ok: false, data: [], error: error instanceof Error ? error.message : "保存反馈失败。" };
  }
}

export function clearChatFeedback(): FeedbackResult<ChatAnswerFeedbackItem[]> {
  try {
    writeRawFeedback([]);
    return { ok: true, data: [] };
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
