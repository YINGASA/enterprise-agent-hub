import type { Conversation } from "@/types";

export const DEFAULT_CONVERSATION_TITLE = "新对话";
export const AUTO_CONVERSATION_TITLE_CHARACTERS = 18;
export const MAX_CONVERSATION_TITLE_CHARACTERS = 40;

export function normalizeConversationTitle(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function sliceCharacters(value: string, length: number) {
  return Array.from(value).slice(0, length).join("");
}

export function generateConversationTitle(firstQuestion: string) {
  const normalized = normalizeConversationTitle(firstQuestion);
  if (!normalized) return DEFAULT_CONVERSATION_TITLE;
  const characters = Array.from(normalized);
  if (characters.length <= AUTO_CONVERSATION_TITLE_CHARACTERS) return normalized;
  return `${sliceCharacters(normalized, AUTO_CONVERSATION_TITLE_CHARACTERS)}…`;
}

export function validateManualConversationTitle(value: string) {
  const title = normalizeConversationTitle(value);
  if (!title) return { ok: false as const, error: "会话标题不能为空。" };
  if (Array.from(title).length > MAX_CONVERSATION_TITLE_CHARACTERS) {
    return { ok: false as const, error: `会话标题不能超过 ${MAX_CONVERSATION_TITLE_CHARACTERS} 个字符。` };
  }
  return { ok: true as const, title };
}

export function searchConversations(conversations: Conversation[], query: string) {
  const normalizedQuery = normalizeConversationTitle(query).toLocaleLowerCase();
  const sorted = conversations.slice().sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
  if (!normalizedQuery) return sorted;
  return sorted.filter((conversation) => conversation.title.toLocaleLowerCase().includes(normalizedQuery));
}
