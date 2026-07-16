import type { ContextCandidateMessage, ContextMessage, ContextSelectionReason } from "@/types";

export const DEFAULT_RECENT_TURN_LIMIT = 4;
export const DEFAULT_SELECTED_TURN_LIMIT = 2;

export type HistorySelectionResult = { recentMessages: ContextMessage[]; selectedHistory: ContextMessage[]; droppedMessageCount: number; selectedTurnCount: number; reasons: ContextSelectionReason[] };

type Turn = { messages: ContextCandidateMessage[]; index: number; complete: boolean };

function normalizedTokens(value: string) {
  const normalized = value.toLowerCase().replace(/\s+/g, " ");
  const latin = normalized.match(/[a-z0-9][a-z0-9_-]*/g) ?? [];
  const cjk = Array.from(normalized).filter((character) => /[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/u.test(character));
  const bigrams = cjk.slice(0, -1).map((character, index) => character + cjk[index + 1]).filter((value) => value.length === 2);
  return new Set([...latin.filter((token) => token.length > 1), ...bigrams]);
}

function completeTurns(messages: readonly ContextCandidateMessage[]): Turn[] {
  const valid = messages.filter((message) => (message.role === "user" || message.role === "assistant") && Boolean(message.content.trim()));
  const turns: Turn[] = [];
  for (let index = 0; index < valid.length; index += 1) {
    const current = valid[index]!;
    if (current.role !== "user") continue;
    const next = valid[index + 1];
    if (next?.role === "assistant") { turns.push({ messages: [current, next], index, complete: true }); index += 1; }
    else turns.push({ messages: [current], index, complete: false });
  }
  return turns;
}

export function selectHistory(input: { messages: readonly ContextCandidateMessage[]; currentUserMessage: string; route?: { scenario?: string; scene?: string; intent?: string }; recentTurnLimit?: number; selectedTurnLimit?: number }): HistorySelectionResult {
  const turns = completeTurns(input.messages);
  const recentLimit = input.recentTurnLimit ?? DEFAULT_RECENT_TURN_LIMIT;
  const selectedLimit = input.selectedTurnLimit ?? DEFAULT_SELECTED_TURN_LIMIT;
  const recentTurns = turns.slice(-recentLimit);
  const oldTurns = turns.slice(0, Math.max(0, turns.length - recentTurns.length)).filter((turn) => turn.complete);
  const currentTokens = normalizedTokens(input.currentUserMessage);
  const scored = oldTurns.map((turn, order) => {
    const userTokens = normalizedTokens(turn.messages[0]?.content ?? "");
    const assistantTokens = normalizedTokens(turn.messages[1]?.content ?? "");
    const userOverlap = [...currentTokens].filter((token) => userTokens.has(token)).length;
    const assistantOverlap = [...currentTokens].filter((token) => assistantTokens.has(token)).length;
    const scenarioMatch = input.route?.scenario && turn.messages.some((message) => message.scenario === input.route?.scenario);
    const intentMatch = input.route?.intent && turn.messages.some((message) => message.intent === input.route?.intent);
    return { turn, order, score: userOverlap * 3 + assistantOverlap * 2 + (scenarioMatch ? 2 : 0) + (intentMatch ? 2 : 0), reasons: [...(userOverlap || assistantOverlap ? ["keyword_overlap" as const] : []), ...(scenarioMatch ? ["route_scene_match" as const] : []), ...(intentMatch ? ["route_intent_match" as const] : [])] };
  }).filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || right.order - left.order)
    .slice(0, selectedLimit)
    .sort((left, right) => left.turn.index - right.turn.index);
  const selectedHistory = scored.flatMap((item) => item.turn.messages.map(({ role, content }) => ({ role, content })));
  const recentMessages = recentTurns.flatMap((turn) => turn.messages.map(({ role, content }) => ({ role, content })));
  return { recentMessages, selectedHistory, droppedMessageCount: Math.max(0, input.messages.length - recentMessages.length - selectedHistory.length), selectedTurnCount: scored.length, reasons: scored.length ? ["keyword_overlap"] : [] };
}
