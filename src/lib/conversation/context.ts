import type { ConversationContext, ConversationContextMeta, ConversationMessage } from "@/types";

export const MAX_CONTEXT_ROUNDS = 6;
export const MAX_CONTEXT_MESSAGES = 12;
export const MAX_CONTEXT_CHARACTERS = 6_000;
export const MAX_MESSAGE_CHARACTERS = 2_000;
export const MAX_REQUEST_CHARACTERS = 7_000;

type ContextInput = ConversationContext | { messages?: unknown } | undefined;

export function buildConversationContext(input: ContextInput, currentQuestion = ""): { context: ConversationContext; meta: ConversationContextMeta } {
  const rawMessages = Array.isArray(input?.messages) ? input.messages : [];
  const valid = rawMessages.flatMap((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const item = value as Record<string, unknown>;
    if ((item.role !== "user" && item.role !== "assistant") || typeof item.content !== "string") return [];
    const content = item.content.trim();
    if (!content || content.length > MAX_MESSAGE_CHARACTERS) return [];
    return [{ role: item.role as "user" | "assistant", content }];
  });

  const bounded = valid.slice(-MAX_CONTEXT_MESSAGES);
  const selected: ConversationContext["messages"] = [];
  let characters = 0;
  const characterBudget = Math.max(0, Math.min(MAX_CONTEXT_CHARACTERS, MAX_REQUEST_CHARACTERS - currentQuestion.trim().length));
  let userTurns = 0;
  for (let index = bounded.length - 1; index >= 0; index -= 1) {
    const message = bounded[index];
    if (!message) continue;
    if (message.role === "user" && userTurns >= MAX_CONTEXT_ROUNDS) break;
    if (characters + message.content.length > characterBudget) break;
    selected.unshift(message);
    characters += message.content.length;
    if (message.role === "user") userTurns += 1;
  }

  const truncated = selected.length !== rawMessages.length;
  return {
    context: { messages: selected },
    meta: { contextApplied: selected.length > 0, contextMessageCount: selected.length, contextTruncated: truncated, contextCharacterCount: characters },
  };
}

export function contextFromConversationMessages(messages: ConversationMessage[]) {
  return buildConversationContext({ messages: messages.map(({ role, content }) => ({ role, content })) });
}

export function hasRecentOrderReturnContext(context: ConversationContext) {
  const text = context.messages.map((item) => item.content).join(" ");
  return /订单\s*10001|退货|退款|售后/.test(text);
}
