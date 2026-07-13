import { readClientStorageList, writeClientStorageList, type ClientStorageListOptions } from "@/lib/clientStorage";
import { loadChatHistory } from "@/lib/chat/history";
import { MAX_MESSAGE_CHARACTERS } from "@/lib/conversation/context";
import type { AgentApiResponse, AgentIntent, AgentResponseMode, AgentScenario, Conversation, ConversationMessage } from "@/types";

export const CONVERSATION_STORAGE_KEY = "enterprise-agent-hub:conversations";
const MAX_CONVERSATIONS = 10;
const MAX_MESSAGES = 100;

export type ConversationStore = { activeConversationId: string; conversations: Conversation[]; legacyHistoryMigrated: boolean };

const responseModes = new Set<AgentResponseMode>(["mock", "real", "real_repaired", "real_text_fallback", "real_error_fallback", "fallback"]);
const intents = new Set<AgentIntent>(["knowledge_qa", "policy_check", "order_query", "product_query", "after_sale_reply", "jd_match", "ticket_create", "general_chat"]);
const scenarios = new Set<AgentScenario>(["enterprise", "ecommerce", "recruitment", "ai_engineering", "general"]);

const validDate = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));
const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function sanitizeMessage(value: unknown): ConversationMessage | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Partial<ConversationMessage>;
  if (typeof item.id !== "string" || (item.role !== "user" && item.role !== "assistant") || typeof item.content !== "string" || !item.content.trim() || item.content.length > MAX_MESSAGE_CHARACTERS || !validDate(item.createdAt)) return null;
  const base = { id: item.id.slice(0, 128), role: item.role, content: item.content.trim(), createdAt: item.createdAt };
  if (item.role === "user") return base;
  return { ...base, runId: typeof item.runId === "string" ? item.runId.slice(0, 128) : undefined, responseMode: item.responseMode && responseModes.has(item.responseMode) ? item.responseMode : undefined, intent: item.intent && intents.has(item.intent) ? item.intent : undefined, scenario: item.scenario && scenarios.has(item.scenario) ? item.scenario : undefined };
}

function sanitizeConversation(value: unknown): Conversation | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Partial<Conversation>;
  if (typeof item.id !== "string" || !validDate(item.createdAt) || !validDate(item.updatedAt) || !Array.isArray(item.messages)) return null;
  return { id: item.id.slice(0, 128), createdAt: item.createdAt, updatedAt: item.updatedAt, schemaVersion: 1, messages: item.messages.map(sanitizeMessage).filter((entry): entry is ConversationMessage => Boolean(entry)).slice(-MAX_MESSAGES) };
}

function sanitizeStore(value: unknown): ConversationStore | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as { activeConversationId?: unknown; conversations?: unknown; legacyHistoryMigrated?: unknown };
  if (typeof item.activeConversationId !== "string" || !Array.isArray(item.conversations)) return null;
  const conversations = item.conversations.map(sanitizeConversation).filter((entry): entry is Conversation => Boolean(entry)).slice(0, MAX_CONVERSATIONS);
  return { activeConversationId: conversations.some((entry) => entry.id === item.activeConversationId) ? item.activeConversationId : conversations[0]?.id ?? "", conversations, legacyHistoryMigrated: item.legacyHistoryMigrated === true };
}

const options: ClientStorageListOptions<ConversationStore> = { key: CONVERSATION_STORAGE_KEY, version: 1, maxItems: 1, sanitize: sanitizeStore };

export function createConversation(): Conversation {
  const now = new Date().toISOString();
  return { id: makeId("conversation"), createdAt: now, updatedAt: now, schemaVersion: 1, messages: [] };
}

function migrateLegacyHistory(): ConversationStore {
  const history = loadChatHistory().data.slice().reverse();
  const conversation = createConversation();
  conversation.messages = history.flatMap((item) => [
    { id: makeId("message"), role: "user" as const, content: item.question.slice(0, MAX_MESSAGE_CHARACTERS), createdAt: item.createdAt },
    { id: makeId("message"), role: "assistant" as const, content: item.finalAnswer.slice(0, MAX_MESSAGE_CHARACTERS), createdAt: item.createdAt, responseMode: item.responseMode as ConversationMessage["responseMode"], intent: item.intent as ConversationMessage["intent"], scenario: item.scenario as ConversationMessage["scenario"] },
  ]).slice(-MAX_MESSAGES);
  conversation.updatedAt = conversation.messages.at(-1)?.createdAt ?? conversation.createdAt;
  return { activeConversationId: conversation.id, conversations: [conversation], legacyHistoryMigrated: true };
}

export function loadConversationStore() {
  const loaded = readClientStorageList(options);
  if (loaded.data[0]) {
    const canonical = sanitizeStore(loaded.data[0]) ?? loaded.data[0];
    writeClientStorageList(options, [canonical]);
    return { ...loaded, data: canonical };
  }
  if (!loaded.ok) {
    const conversation = createConversation();
    const store: ConversationStore = { activeConversationId: conversation.id, conversations: [conversation], legacyHistoryMigrated: true };
    writeClientStorageList(options, [store]);
    return { ...loaded, data: store };
  }
  const store = migrateLegacyHistory();
  writeClientStorageList(options, [store]);
  return { ...loaded, data: store };
}

function writeStore(store: ConversationStore) {
  const normalized = sanitizeStore(store);
  if (!normalized) return { ok: false, data: store, error: "Conversation storage payload is invalid." };
  const saved = writeClientStorageList(options, [normalized]);
  return { ...saved, data: saved.data[0] ?? normalized };
}

export function startNewConversation(store: ConversationStore) {
  const conversation = createConversation();
  return writeStore({ activeConversationId: conversation.id, conversations: [conversation, ...store.conversations].slice(0, MAX_CONVERSATIONS), legacyHistoryMigrated: true });
}

export function selectConversation(store: ConversationStore, conversationId: string) {
  if (!store.conversations.some((item) => item.id === conversationId)) return { ok: false, data: store, error: "Conversation not found." };
  return writeStore({ ...store, activeConversationId: conversationId });
}

export function clearCurrentConversation(store: ConversationStore) {
  const active = store.conversations.find((item) => item.id === store.activeConversationId);
  if (!active) return { ok: true, data: store };
  const cleared = { ...active, messages: [], updatedAt: new Date().toISOString() };
  return writeStore({ ...store, conversations: [cleared, ...store.conversations.filter((item) => item.id !== active.id)] });
}

export function deleteCurrentConversation(store: ConversationStore) {
  const remaining = store.conversations.filter((item) => item.id !== store.activeConversationId);
  if (remaining.length) return writeStore({ ...store, activeConversationId: remaining[0]!.id, conversations: remaining });
  const conversation = createConversation();
  return writeStore({ activeConversationId: conversation.id, conversations: [conversation], legacyHistoryMigrated: true });
}

export function appendConversationTurn(store: ConversationStore, question: string, result: AgentApiResponse) {
  const now = new Date().toISOString();
  const active = store.conversations.find((item) => item.id === store.activeConversationId) ?? createConversation();
  if (result.runId && active.messages.some((message) => message.role === "assistant" && message.runId === result.runId)) return { ok: true, data: store };
  const recent = active.messages.slice(-2);
  if (!result.runId && recent[0]?.role === "user" && recent[0].content === question.trim() && recent[1]?.role === "assistant" && recent[1].content === result.finalAnswer.trim()) return { ok: true, data: store };
  const turn: ConversationMessage[] = [
    { id: makeId("message"), role: "user", content: question.slice(0, MAX_MESSAGE_CHARACTERS), createdAt: now },
    { id: makeId("message"), role: "assistant", content: result.finalAnswer.slice(0, MAX_MESSAGE_CHARACTERS), createdAt: new Date().toISOString(), runId: result.runId, responseMode: result.api.responseMode, intent: result.route.intent, scenario: result.route.scenario },
  ];
  const messages = [...active.messages, ...turn].slice(-MAX_MESSAGES);
  const updated = { ...active, updatedAt: new Date().toISOString(), messages };
  const conversations = [updated, ...store.conversations.filter((item) => item.id !== updated.id)].slice(0, MAX_CONVERSATIONS);
  return writeStore({ activeConversationId: updated.id, conversations, legacyHistoryMigrated: true });
}
