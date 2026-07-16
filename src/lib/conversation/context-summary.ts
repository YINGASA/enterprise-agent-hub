import { estimateTextTokens } from "@/lib/conversation/token-estimator";
import type { ContextCandidateMessage, ConversationSummaryPatch, ConversationSummaryState, SummaryInvalidReason } from "@/types";

export const SUMMARY_TRIGGER_TURN_COUNT = 8;
export const PROTECTED_RECENT_TURN_COUNT = 4;
export const SUMMARY_TOKEN_BUDGET = 700;

type Turn = { user: ContextCandidateMessage; assistant: ContextCandidateMessage };
export type SummaryValidationResult = { valid: boolean; reason?: SummaryInvalidReason; coveredMessageCount: number };
export type RollingSummaryResult = { summary?: ConversationSummaryState; patch?: ConversationSummaryPatch; usedExistingSummary: boolean; updated: boolean; summarizedMessageCount: number; newlySummarizedTurnCount: number; invalidReason?: SummaryInvalidReason };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function sanitizeConversationSummaryState(value: unknown): ConversationSummaryState | undefined {
  if (!isRecord(value)) return undefined;
  const keys = Object.keys(value);
  if (keys.length !== 5 || keys.some((key) => !["text", "throughMessageId", "updatedAt", "version", "sourceMessageCount"].includes(key))) return undefined;
  const sourceMessageCount = value.sourceMessageCount;
  if (typeof value.text !== "string" || !value.text.trim() || value.text.length > 8_000 ||
    typeof value.throughMessageId !== "string" || !value.throughMessageId.trim() || value.throughMessageId.length > 128 ||
    typeof value.updatedAt !== "string" || !value.updatedAt || value.updatedAt.length > 128 || !Number.isFinite(Date.parse(value.updatedAt)) ||
    value.version !== 1 || typeof sourceMessageCount !== "number" || !Number.isInteger(sourceMessageCount) || sourceMessageCount < 0) return undefined;
  return { text: value.text.trim(), throughMessageId: value.throughMessageId, updatedAt: value.updatedAt, version: 1, sourceMessageCount };
}

export function sanitizeConversationSummaryPatch(value: unknown): ConversationSummaryPatch | undefined {
  if (!isRecord(value)) return undefined;
  const keys = Object.keys(value);
  if (keys.length === 1 && value.clear === true) return { clear: true };
  if (keys.length === 1 && "set" in value) {
    const set = sanitizeConversationSummaryState(value.set);
    return set ? { set } : undefined;
  }
  return undefined;
}

function turns(messages: readonly ContextCandidateMessage[]): Turn[] {
  const result: Turn[] = [];
  for (let index = 0; index < messages.length - 1; index += 1) {
    const user = messages[index]; const assistant = messages[index + 1];
    if (user?.role === "user" && assistant?.role === "assistant" && user.content.trim() && assistant.content.trim()) { result.push({ user, assistant }); index += 1; }
  }
  return result;
}

export function validateConversationSummary(summary: ConversationSummaryState | undefined, messages: readonly ContextCandidateMessage[], protectedRecentTurnCount = PROTECTED_RECENT_TURN_COUNT): SummaryValidationResult {
  if (!summary) return { valid: false, reason: "missing_cursor", coveredMessageCount: 0 };
  if (summary.version !== 1) return { valid: false, reason: "unsupported_version", coveredMessageCount: 0 };
  if (!summary.text.trim() || summary.text.length > 8_000) return { valid: false, reason: "invalid_text", coveredMessageCount: 0 };
  if (!Number.isInteger(summary.sourceMessageCount) || summary.sourceMessageCount < 0) return { valid: false, reason: "invalid_source_count", coveredMessageCount: 0 };
  const index = messages.findIndex((message) => message.id === summary.throughMessageId);
  if (index < 0) return { valid: false, reason: "cursor_not_found", coveredMessageCount: 0 };
  if (messages[index]?.role !== "assistant") return { valid: false, reason: "cursor_not_assistant", coveredMessageCount: 0 };
  const complete = turns(messages); const protectedStart = Math.max(0, complete.length - protectedRecentTurnCount);
  const cursorTurnIndex = complete.findIndex((turn) => turn.assistant.id === summary.throughMessageId);
  if (cursorTurnIndex < 0) return { valid: false, reason: "cursor_not_assistant", coveredMessageCount: 0 };
  const coveredMessageCount = (cursorTurnIndex + 1) * 2;
  if (summary.sourceMessageCount !== coveredMessageCount) return { valid: false, reason: "invalid_source_count", coveredMessageCount: 0 };
  const protectedIds = new Set(complete.slice(protectedStart).flatMap((turn) => [turn.user.id, turn.assistant.id]));
  if (protectedIds.has(summary.throughMessageId)) return { valid: false, reason: "cursor_in_protected_recent", coveredMessageCount: 0 };
  return { valid: true, coveredMessageCount };
}

function concise(value: string) { return value.replace(/\s+/g, " ").trim().slice(0, 240); }
function fit(text: string, budget: number) { const characters = Array.from(text); while (characters.length && estimateTextTokens(characters.join("")) > budget) characters.pop(); return characters.join("").trim(); }

export function buildRollingSummary(input: { messages: readonly ContextCandidateMessage[]; existingSummary?: ConversationSummaryState; protectedRecentTurnCount?: number; triggerTurnCount?: number; tokenBudget?: number; now: string }): RollingSummaryResult {
  const protectedCount = input.protectedRecentTurnCount ?? PROTECTED_RECENT_TURN_COUNT;
  const complete = turns(input.messages); const eligible = complete.slice(0, Math.max(0, complete.length - protectedCount));
  const validation = validateConversationSummary(input.existingSummary, input.messages, protectedCount);
  if (complete.length < (input.triggerTurnCount ?? SUMMARY_TRIGGER_TURN_COUNT) && !validation.valid) return { usedExistingSummary: false, updated: false, summarizedMessageCount: 0, newlySummarizedTurnCount: 0, invalidReason: validation.reason };
  const cursorIndex = validation.valid ? complete.findIndex((turn) => turn.assistant.id === input.existingSummary?.throughMessageId) : -1;
  const additions = eligible.slice(cursorIndex + 1);
  if (!additions.length && validation.valid) return { summary: input.existingSummary, usedExistingSummary: true, updated: false, summarizedMessageCount: validation.coveredMessageCount, newlySummarizedTurnCount: 0 };
  if (!eligible.length) return { usedExistingSummary: false, updated: false, summarizedMessageCount: 0, newlySummarizedTurnCount: 0, invalidReason: validation.reason };
  const lines = additions.map((turn) => `- 用户：${concise(turn.user.content)}；已答：${concise(turn.assistant.content)}`);
  const text = fit([input.existingSummary?.text, "已确认事项：", ...lines].filter(Boolean).join("\n"), input.tokenBudget ?? SUMMARY_TOKEN_BUDGET);
  const last = eligible.at(-1)!;
  const summary: ConversationSummaryState = { text, throughMessageId: last.assistant.id, updatedAt: input.now, version: 1, sourceMessageCount: eligible.length * 2 };
  return { summary, patch: { set: summary }, usedExistingSummary: validation.valid, updated: true, summarizedMessageCount: summary.sourceMessageCount, newlySummarizedTurnCount: additions.length, invalidReason: validation.valid ? undefined : validation.reason };
}
