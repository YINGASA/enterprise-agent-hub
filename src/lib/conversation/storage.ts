import { readClientStorageList, writeClientStorageList, type ClientStorageListOptions } from "@/lib/clientStorage";
import { loadChatHistory } from "@/lib/chat/history";
import { MAX_CONTEXT_CHARACTERS, MAX_CONTEXT_MESSAGES, MAX_MESSAGE_CHARACTERS } from "@/lib/conversation/context";
import { DEFAULT_CONVERSATION_TITLE, generateConversationTitle, normalizeConversationTitle, searchConversations, validateManualConversationTitle } from "@/lib/conversation/title";
import type { AgentApiResponse, AgentIntent, AgentResponseMode, AgentScenario, Conversation, ConversationAssistantDetails, ConversationMessage, RetrievalConfidence, ToolName } from "@/types";

export { searchConversations } from "@/lib/conversation/title";

export const CONVERSATION_STORAGE_KEY = "enterprise-agent-hub:conversations";
const MAX_CONVERSATIONS = 10;
const MAX_MESSAGES = 100;

export type ConversationStore = { activeConversationId: string; conversations: Conversation[]; legacyHistoryMigrated: boolean };

const responseModes = new Set<AgentResponseMode>(["mock", "real", "real_repaired", "real_text_fallback", "real_error_fallback", "fallback"]);
const intents = new Set<AgentIntent>(["knowledge_qa", "policy_check", "order_query", "product_query", "after_sale_reply", "jd_match", "ticket_create", "general_chat"]);
const scenarios = new Set<AgentScenario>(["enterprise", "ecommerce", "recruitment", "ai_engineering", "general"]);
const retrievalConfidences = new Set<RetrievalConfidence>(["high", "medium", "low"]);
const toolNames = new Set<ToolName>(["queryOrder", "queryProduct", "searchPolicy", "createTicket", "analyzeJD", "generateCustomerReply"]);
const stepTypes = new Set(["router", "rag", "tool", "response"] as const);
const stepStatuses = new Set(["success", "failed", "skipped"] as const);

const validDate = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));
const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function safeInteger(value: unknown, maximum: number) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? Math.min(value, maximum) : undefined;
}

function safeConfidence(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : undefined;
}

function safeScore(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(1_000_000, Math.max(0, value)) : undefined;
}

function sanitizeAssistantDetails(value: unknown): ConversationAssistantDetails | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const item = value as Record<string, unknown>;
  const sources = Array.isArray(item.sources) ? item.sources.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const source = entry as Record<string, unknown>;
    if (typeof source.documentId !== "string" || typeof source.title !== "string" || typeof source.category !== "string" || !Array.isArray(source.chunkIndexes)) return [];
    return [{
      documentId: source.documentId.slice(0, 128),
      title: source.title.slice(0, 160),
      category: source.category.slice(0, 80),
      sourceType: source.sourceType === "default" || source.sourceType === "user_upload" || source.sourceType === "user_paste" ? source.sourceType as "default" | "user_upload" | "user_paste" : undefined,
      score: safeScore(source.score),
      chunkIndexes: source.chunkIndexes.flatMap((index) => {
        const safe = safeInteger(index, 100_000);
        return safe === undefined ? [] : [safe];
      }).slice(0, 8),
    }];
  }).slice(0, 8) : undefined;
  const tools = Array.isArray(item.tools) ? item.tools.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const tool = entry as Record<string, unknown>;
    if (typeof tool.tool !== "string" || !toolNames.has(tool.tool as ToolName) || (tool.status !== "success" && tool.status !== "failed")) return [];
    return [{ tool: tool.tool as ToolName, status: tool.status as "success" | "failed" }];
  }).slice(0, 8) : undefined;
  const steps = Array.isArray(item.steps) ? item.steps.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const step = entry as Record<string, unknown>;
    if (typeof step.id !== "string" || typeof step.name !== "string" || typeof step.type !== "string" || !stepTypes.has(step.type as "router" | "rag" | "tool" | "response") || typeof step.status !== "string" || !stepStatuses.has(step.status as "success" | "failed" | "skipped")) return [];
    return [{ id: step.id.slice(0, 128), name: step.name.slice(0, 120), type: step.type as "router" | "rag" | "tool" | "response", status: step.status as "success" | "failed" | "skipped", durationMs: safeInteger(step.durationMs, 600_000) ?? 0 }];
  }).slice(0, 12) : undefined;
  const retrievalConfidence = typeof item.retrievalConfidence === "string" && retrievalConfidences.has(item.retrievalConfidence as RetrievalConfidence) ? item.retrievalConfidence as RetrievalConfidence : undefined;
  const riskLevel = item.riskLevel === "low" || item.riskLevel === "medium" || item.riskLevel === "high" ? item.riskLevel : undefined;
  const details: ConversationAssistantDetails = {
    sources: sources?.length ? sources : undefined,
    tools: tools?.length ? tools : undefined,
    steps: steps?.length ? steps : undefined,
    retrievalConfidence,
    confidence: safeConfidence(item.confidence),
    riskLevel,
    needsClarification: typeof item.needsClarification === "boolean" ? item.needsClarification : undefined,
  };
  return Object.values(details).some((entry) => entry !== undefined) ? details : undefined;
}

function sanitizeMessage(value: unknown): ConversationMessage | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Partial<ConversationMessage>;
  if (typeof item.id !== "string" || (item.role !== "user" && item.role !== "assistant") || typeof item.content !== "string" || !item.content.trim() || item.content.length > MAX_MESSAGE_CHARACTERS || !validDate(item.createdAt)) return null;
  const base = { id: item.id.slice(0, 128), role: item.role, content: item.content.trim(), createdAt: item.createdAt };
  if (item.role === "user") return base;
  return {
    ...base,
    runId: typeof item.runId === "string" ? item.runId.slice(0, 128) : undefined,
    responseMode: item.responseMode && responseModes.has(item.responseMode) ? item.responseMode : undefined,
    intent: item.intent && intents.has(item.intent) ? item.intent : undefined,
    scenario: item.scenario && scenarios.has(item.scenario) ? item.scenario : undefined,
    contextApplied: typeof item.contextApplied === "boolean" ? item.contextApplied : undefined,
    contextMessageCount: safeInteger(item.contextMessageCount, MAX_CONTEXT_MESSAGES),
    contextTruncated: typeof item.contextTruncated === "boolean" ? item.contextTruncated : undefined,
    contextCharacterCount: safeInteger(item.contextCharacterCount, MAX_CONTEXT_CHARACTERS),
    details: sanitizeAssistantDetails(item.details),
  };
}

function sanitizeConversation(value: unknown): Conversation | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Partial<Conversation>;
  if (typeof item.id !== "string" || !validDate(item.createdAt) || !validDate(item.updatedAt) || !Array.isArray(item.messages)) return null;
  const messages = item.messages.map(sanitizeMessage).filter((entry): entry is ConversationMessage => Boolean(entry)).slice(-MAX_MESSAGES);
  const existingTitle = typeof item.title === "string" ? normalizeConversationTitle(item.title) : "";
  const titleSource = item.titleSource === "manual" && existingTitle ? "manual" : "auto";
  const firstQuestion = messages.find((message) => message.role === "user")?.content ?? "";
  const title = titleSource === "manual" ? validateManualConversationTitle(existingTitle) : null;
  return {
    id: item.id.slice(0, 128),
    title: title?.ok ? title.title : generateConversationTitle(firstQuestion),
    titleSource: title?.ok ? "manual" : "auto",
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    schemaVersion: 1,
    messages,
  };
}

function sanitizeStore(value: unknown): ConversationStore | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as { activeConversationId?: unknown; conversations?: unknown; legacyHistoryMigrated?: unknown };
  if (typeof item.activeConversationId !== "string" || !Array.isArray(item.conversations)) return null;
  const conversations = item.conversations
    .map(sanitizeConversation)
    .filter((entry): entry is Conversation => Boolean(entry))
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
    .slice(0, MAX_CONVERSATIONS);
  return { activeConversationId: conversations.some((entry) => entry.id === item.activeConversationId) ? item.activeConversationId : conversations[0]?.id ?? "", conversations, legacyHistoryMigrated: item.legacyHistoryMigrated === true };
}

const options: ClientStorageListOptions<ConversationStore> = { key: CONVERSATION_STORAGE_KEY, version: 1, maxItems: 1, sanitize: sanitizeStore };

export function createConversation(): Conversation {
  const now = new Date().toISOString();
  return { id: makeId("conversation"), title: DEFAULT_CONVERSATION_TITLE, titleSource: "auto", createdAt: now, updatedAt: now, schemaVersion: 1, messages: [] };
}

function migrateLegacyHistory(): ConversationStore {
  const history = loadChatHistory().data.slice().reverse();
  const conversation = createConversation();
  conversation.messages = history.flatMap((item) => [
    { id: makeId("message"), role: "user" as const, content: item.question.slice(0, MAX_MESSAGE_CHARACTERS), createdAt: item.createdAt },
    { id: makeId("message"), role: "assistant" as const, content: item.finalAnswer.slice(0, MAX_MESSAGE_CHARACTERS), createdAt: item.createdAt, responseMode: item.responseMode as ConversationMessage["responseMode"], intent: item.intent as ConversationMessage["intent"], scenario: item.scenario as ConversationMessage["scenario"] },
  ]).slice(-MAX_MESSAGES);
  conversation.updatedAt = conversation.messages.at(-1)?.createdAt ?? conversation.createdAt;
  conversation.title = generateConversationTitle(conversation.messages.find((message) => message.role === "user")?.content ?? "");
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
  const active = store.conversations.find((item) => item.id === store.activeConversationId);
  if (active && active.messages.length === 0) return { ok: true, data: store };
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
  const cleared = { ...active, title: DEFAULT_CONVERSATION_TITLE, titleSource: "auto" as const, messages: [], updatedAt: new Date().toISOString() };
  return writeStore({ ...store, conversations: [cleared, ...store.conversations.filter((item) => item.id !== active.id)] });
}

export function renameConversation(store: ConversationStore, conversationId: string, nextTitle: string) {
  const validated = validateManualConversationTitle(nextTitle);
  if (!validated.ok) return { ok: false, data: store, error: validated.error };
  const conversation = store.conversations.find((item) => item.id === conversationId);
  if (!conversation) return { ok: false, data: store, error: "Conversation not found." };
  const updated = { ...conversation, title: validated.title, titleSource: "manual" as const, updatedAt: new Date().toISOString() };
  return writeStore({ ...store, conversations: [updated, ...store.conversations.filter((item) => item.id !== conversationId)] });
}

export function deleteConversation(store: ConversationStore, conversationId: string) {
  if (!store.conversations.some((item) => item.id === conversationId)) return { ok: false, data: store, error: "Conversation not found." };
  const remaining = store.conversations.filter((item) => item.id !== conversationId);
  if (remaining.length) {
    const activeConversationId = store.activeConversationId === conversationId ? remaining[0]!.id : store.activeConversationId;
    return writeStore({ ...store, activeConversationId, conversations: remaining });
  }
  const conversation = createConversation();
  return writeStore({ activeConversationId: conversation.id, conversations: [conversation], legacyHistoryMigrated: true });
}

export function deleteCurrentConversation(store: ConversationStore) {
  return deleteConversation(store, store.activeConversationId);
}

function compactAssistantDetails(result: AgentApiResponse): ConversationAssistantDetails {
  return {
    sources: result.ragAnswer?.sources.slice(0, 8).map((source) => ({
      documentId: source.documentId,
      title: source.title,
      category: source.category,
      sourceType: source.sourceType,
      score: source.score,
      chunkIndexes: source.chunkIndexes.slice(0, 8),
    })),
    tools: result.toolResults.slice(0, 8).map((tool) => ({ tool: tool.tool, status: tool.status })),
    steps: result.steps.slice(0, 12).map((step) => ({ id: step.id, name: step.name, type: step.type, status: step.status, durationMs: step.durationMs })),
    retrievalConfidence: result.ragAnswer?.retrievalConfidence,
    confidence: result.structuredOutput.confidence,
    riskLevel: result.structuredOutput.riskLevel,
    needsClarification: result.structuredOutput.needsClarification,
  };
}

export function appendConversationTurnToConversation(store: ConversationStore, conversationId: string, question: string, result: AgentApiResponse) {
  const now = new Date().toISOString();
  const target = store.conversations.find((item) => item.id === conversationId);
  if (!target) return { ok: false, data: store, error: "Conversation not found." };
  if (result.runId && target.messages.some((message) => message.role === "assistant" && message.runId === result.runId)) return { ok: true, data: store };
  const recent = target.messages.slice(-2);
  if (!result.runId && recent[0]?.role === "user" && recent[0].content === question.trim() && recent[1]?.role === "assistant" && recent[1].content === result.finalAnswer.trim()) return { ok: true, data: store };
  const turn: ConversationMessage[] = [
    { id: makeId("message"), role: "user", content: question.slice(0, MAX_MESSAGE_CHARACTERS), createdAt: now },
    {
      id: makeId("message"),
      role: "assistant",
      content: result.finalAnswer.slice(0, MAX_MESSAGE_CHARACTERS),
      createdAt: new Date().toISOString(),
      runId: result.runId,
      responseMode: result.api.responseMode,
      intent: result.route.intent,
      scenario: result.route.scenario,
      contextApplied: result.api.contextApplied,
      contextMessageCount: result.api.contextMessageCount,
      contextTruncated: result.api.contextTruncated,
      contextCharacterCount: result.api.contextCharacterCount,
      details: compactAssistantDetails(result),
    },
  ];
  const messages = [...target.messages, ...turn].slice(-MAX_MESSAGES);
  const shouldGenerateTitle = target.titleSource !== "manual" && !target.messages.some((message) => message.role === "user");
  const updated = {
    ...target,
    title: shouldGenerateTitle ? generateConversationTitle(question) : target.title,
    titleSource: target.titleSource === "manual" ? "manual" as const : "auto" as const,
    updatedAt: new Date().toISOString(),
    messages,
  };
  const conversations = [updated, ...store.conversations.filter((item) => item.id !== updated.id)].slice(0, MAX_CONVERSATIONS);
  return writeStore({ ...store, conversations, legacyHistoryMigrated: true });
}

export function appendConversationTurn(store: ConversationStore, question: string, result: AgentApiResponse) {
  return appendConversationTurnToConversation(store, store.activeConversationId, question, result);
}
