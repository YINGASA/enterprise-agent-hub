import { MAX_CONVERSATIONS, type ConversationStore } from "@/lib/conversation/storage";
import type { Conversation } from "@/types";

export function toConversationStore(conversations: Conversation[], preferredActiveConversationId?: string): ConversationStore {
  const activeConversationId = conversations.some((item) => item.id === preferredActiveConversationId)
    ? preferredActiveConversationId!
    : conversations[0]?.id ?? "";
  return { activeConversationId, conversations, legacyHistoryMigrated: true };
}

export function mergeConversationIntoStore(
  store: ConversationStore,
  conversation: Conversation,
  options: { activate?: boolean } = {},
): ConversationStore {
  const conversations = [conversation, ...store.conversations.filter((item) => item.id !== conversation.id)].slice(0, MAX_CONVERSATIONS);
  const activeConversationId = options.activate
    ? conversation.id
    : conversations.some((item) => item.id === store.activeConversationId)
      ? store.activeConversationId
      : conversation.id;
  return { ...store, activeConversationId, conversations };
}
