import type { ContextCandidateMessage, ConversationMessage } from "@/types";

export const MAX_CONTEXT_CANDIDATES = 100;
export const MAX_CONTEXT_CANDIDATE_CHARACTERS = 2_000;
export const MAX_CONTEXT_CANDIDATE_TOTAL_CHARACTERS = 20_000;

export function toContextCandidates(messages: readonly ConversationMessage[]): ContextCandidateMessage[] {
  return messages.slice(-MAX_CONTEXT_CANDIDATES).map((message) => ({ id: message.id, role: message.role, content: message.content, createdAt: message.createdAt, scenario: message.scenario, intent: message.intent }));
}
