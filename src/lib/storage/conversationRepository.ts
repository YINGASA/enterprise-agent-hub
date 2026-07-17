import { MAX_MESSAGE_CHARACTERS } from "@/lib/conversation/context";
import {
  MAX_CONVERSATIONS,
  appendConversationTurnToConversation,
  clearConversation,
  createCompletedAssistantMessage,
  createConversation,
  deleteConversation,
  loadConversationStore,
  renameConversation,
  replaceLastCompletedAssistant,
  replaceLastCompletedTurn,
  sanitizeConversation,
  saveConversationStore,
} from "@/lib/conversation/storage";
import { DEFAULT_CONVERSATION_TITLE, validateManualConversationTitle } from "@/lib/conversation/title";
import type { AgentApiResponse, Conversation, ConversationMessage, ConversationSummaryPatch } from "@/types";

export type CreateConversationInput = {
  id?: string;
  title?: string;
  createdAt?: string;
};

export type ConversationMutationInput = {
  conversationId: string;
  expectedRevision: number;
};

export type RenameConversationInput = ConversationMutationInput & { title: string };
export type RemoveConversationInput = ConversationMutationInput;
export type ClearConversationInput = ConversationMutationInput;

export type AppendConversationTurnInput = ConversationMutationInput & {
  question: string;
  result: AgentApiResponse;
  conversationSummaryPatch?: ConversationSummaryPatch;
};

export type RegenerateConversationInput = ConversationMutationInput & {
  expectedAssistantMessageId: string;
  result: AgentApiResponse;
  conversationSummaryPatch?: ConversationSummaryPatch;
};

export type EditAndResendConversationInput = ConversationMutationInput & {
  expectedUserMessageId: string;
  expectedAssistantMessageId: string;
  question: string;
  result: AgentApiResponse;
  conversationSummaryPatch?: ConversationSummaryPatch;
};

export type PersistedTurnPayload = {
  userMessage: ConversationMessage & { role: "user" };
  assistantMessage: ConversationMessage & { role: "assistant" };
};

export interface ConversationRepository {
  list(): Promise<Conversation[]>;
  get(id: string): Promise<Conversation | null>;
  create(input?: CreateConversationInput): Promise<Conversation>;
  rename(input: RenameConversationInput): Promise<Conversation>;
  clear(input: ClearConversationInput): Promise<Conversation>;
  remove(input: RemoveConversationInput): Promise<void>;
  appendTurn(input: AppendConversationTurnInput): Promise<Conversation>;
  regenerateLastAssistant(input: RegenerateConversationInput): Promise<Conversation>;
  editAndResendLastTurn(input: EditAndResendConversationInput): Promise<Conversation>;
}

export type ConversationRepositoryErrorCode = "invalid_input" | "not_found" | "conflict" | "unavailable" | "request_failed";

export class ConversationRepositoryError extends Error {
  constructor(
    public readonly code: ConversationRepositoryErrorCode,
    message: string,
    public readonly status = code === "conflict" ? 409 : code === "not_found" ? 404 : code === "unavailable" ? 503 : 400,
  ) {
    super(message);
    this.name = "ConversationRepositoryError";
  }
}

const makeMessageId = () => `message-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function requireConversation(conversations: Conversation[], id: string) {
  const conversation = conversations.find((item) => item.id === id);
  if (!conversation) throw new ConversationRepositoryError("not_found", "会话不存在。", 404);
  return conversation;
}

function requireRevision(conversation: Conversation, expectedRevision: number) {
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) throw new ConversationRepositoryError("invalid_input", "会话版本无效。", 400);
  if (conversation.revision !== expectedRevision) throw new ConversationRepositoryError("conflict", "会话已发生变化，请刷新后重试。", 409);
}

function unwrapLocalResult(result: { ok: boolean; data: { conversations: Conversation[] }; error?: string }, conversationId: string) {
  if (!result.ok) {
    const conflict = result.error?.includes("changed before replacement");
    throw new ConversationRepositoryError(conflict ? "conflict" : "invalid_input", conflict ? "会话已发生变化，请刷新后重试。" : result.error ?? "会话写入失败。", conflict ? 409 : 400);
  }
  return requireConversation(result.data.conversations, conversationId);
}

export function createPersistedTurnPayload(question: string, result: AgentApiResponse, createdAt = new Date().toISOString()): PersistedTurnPayload {
  const content = question.trim().slice(0, MAX_MESSAGE_CHARACTERS);
  if (!content) throw new ConversationRepositoryError("invalid_input", "问题不能为空。", 400);
  return {
    userMessage: { id: makeMessageId(), role: "user", content, createdAt },
    assistantMessage: createCompletedAssistantMessage(result, createdAt, makeMessageId()),
  };
}

export class LocalConversationRepository implements ConversationRepository {
  async list() {
    return loadConversationStore().data.conversations;
  }

  async get(id: string) {
    return loadConversationStore().data.conversations.find((item) => item.id === id) ?? null;
  }

  async create(input: CreateConversationInput = {}) {
    const store = loadConversationStore().data;
    const base = createConversation();
    if (input.id !== undefined && (!input.id.trim() || input.id.length > 128)) throw new ConversationRepositoryError("invalid_input", "会话标识无效。", 400);
    const title = input.title === undefined ? null : validateManualConversationTitle(input.title);
    if (title && !title.ok) throw new ConversationRepositoryError("invalid_input", title.error, 400);
    const candidate = sanitizeConversation({
      ...base,
      id: input.id ?? base.id,
      title: title?.ok ? title.title : DEFAULT_CONVERSATION_TITLE,
      titleSource: title?.ok ? "manual" : "auto",
      createdAt: input.createdAt ?? base.createdAt,
      updatedAt: input.createdAt ?? base.updatedAt,
    });
    if (!candidate) throw new ConversationRepositoryError("invalid_input", "新会话数据无效。", 400);
    if (store.conversations.some((item) => item.id === candidate.id)) throw new ConversationRepositoryError("conflict", "会话标识已存在。", 409);
    const saved = saveConversationStore({
      ...store,
      activeConversationId: candidate.id,
      conversations: [candidate, ...store.conversations].slice(0, MAX_CONVERSATIONS),
      legacyHistoryMigrated: true,
    });
    if (!saved.ok) throw new ConversationRepositoryError("request_failed", saved.error ?? "会话保存失败。", 500);
    return requireConversation(saved.data.conversations, candidate.id);
  }

  async rename(input: RenameConversationInput) {
    const store = loadConversationStore().data;
    requireRevision(requireConversation(store.conversations, input.conversationId), input.expectedRevision);
    return unwrapLocalResult(renameConversation(store, input.conversationId, input.title), input.conversationId);
  }

  async clear(input: ClearConversationInput) {
    const store = loadConversationStore().data;
    requireRevision(requireConversation(store.conversations, input.conversationId), input.expectedRevision);
    return unwrapLocalResult(clearConversation(store, input.conversationId), input.conversationId);
  }

  async remove(input: RemoveConversationInput) {
    const store = loadConversationStore().data;
    requireRevision(requireConversation(store.conversations, input.conversationId), input.expectedRevision);
    const removed = deleteConversation(store, input.conversationId);
    if (!removed.ok) throw new ConversationRepositoryError("request_failed", removed.error ?? "会话删除失败。", 500);
  }

  async appendTurn(input: AppendConversationTurnInput) {
    const store = loadConversationStore().data;
    requireRevision(requireConversation(store.conversations, input.conversationId), input.expectedRevision);
    return unwrapLocalResult(appendConversationTurnToConversation(store, input.conversationId, input.question, input.result, input.conversationSummaryPatch), input.conversationId);
  }

  async regenerateLastAssistant(input: RegenerateConversationInput) {
    const store = loadConversationStore().data;
    requireRevision(requireConversation(store.conversations, input.conversationId), input.expectedRevision);
    return unwrapLocalResult(replaceLastCompletedAssistant(store, input.conversationId, input.result, input.expectedAssistantMessageId, input.conversationSummaryPatch), input.conversationId);
  }

  async editAndResendLastTurn(input: EditAndResendConversationInput) {
    const store = loadConversationStore().data;
    requireRevision(requireConversation(store.conversations, input.conversationId), input.expectedRevision);
    return unwrapLocalResult(replaceLastCompletedTurn(store, input.conversationId, input.question, input.result, {
      userMessageId: input.expectedUserMessageId,
      assistantMessageId: input.expectedAssistantMessageId,
    }, input.conversationSummaryPatch), input.conversationId);
  }
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
const defaultBrowserFetch: FetchLike = (input, init) => globalThis.fetch(input, init);

export class ServerConversationRepository implements ConversationRepository {
  constructor(private readonly fetchImpl: FetchLike = defaultBrowserFetch, private readonly basePath = "/api/storage/conversations") {}

  private async request<T>(path = "", init?: RequestInit): Promise<T> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.basePath}${path}`, { credentials: "same-origin", ...init, headers: { "content-type": "application/json", ...init?.headers } });
    } catch {
      throw new ConversationRepositoryError("unavailable", "服务端存储暂不可用，请稍后重试。", 503);
    }
    const payload = await response.json().catch(() => ({})) as { error?: string; message?: string };
    if (!response.ok) {
      const code = response.status === 409 ? "conflict" : response.status === 404 ? "not_found" : response.status === 503 ? "unavailable" : "request_failed";
      throw new ConversationRepositoryError(code, payload.message ?? "服务端会话请求失败。", response.status);
    }
    return payload as T;
  }

  async list() {
    return (await this.request<{ conversations: Conversation[] }>()).conversations;
  }

  async get(id: string) {
    try {
      return (await this.request<{ conversation: Conversation }>(`/${encodeURIComponent(id)}`)).conversation;
    } catch (error) {
      if (error instanceof ConversationRepositoryError && error.code === "not_found") return null;
      throw error;
    }
  }

  async create(input: CreateConversationInput = {}) {
    return (await this.request<{ conversation: Conversation }>("", { method: "POST", body: JSON.stringify(input) })).conversation;
  }

  async rename(input: RenameConversationInput) {
    const { conversationId, ...body } = input;
    return (await this.request<{ conversation: Conversation }>(`/${encodeURIComponent(conversationId)}`, { method: "PATCH", body: JSON.stringify(body) })).conversation;
  }

  async clear(input: ClearConversationInput) {
    const { conversationId, ...body } = input;
    return (await this.request<{ conversation: Conversation }>(`/${encodeURIComponent(conversationId)}/clear`, { method: "POST", body: JSON.stringify(body) })).conversation;
  }

  async remove(input: RemoveConversationInput) {
    const { conversationId, ...body } = input;
    await this.request(`/${encodeURIComponent(conversationId)}`, { method: "DELETE", body: JSON.stringify(body) });
  }

  async appendTurn(input: AppendConversationTurnInput) {
    const turn = createPersistedTurnPayload(input.question, input.result);
    return (await this.request<{ conversation: Conversation }>(`/${encodeURIComponent(input.conversationId)}/turns`, {
      method: "POST",
      body: JSON.stringify({ expectedRevision: input.expectedRevision, ...turn, conversationSummaryPatch: input.conversationSummaryPatch }),
    })).conversation;
  }

  async regenerateLastAssistant(input: RegenerateConversationInput) {
    const assistantMessage = createCompletedAssistantMessage(input.result, new Date().toISOString(), makeMessageId());
    return (await this.request<{ conversation: Conversation }>(`/${encodeURIComponent(input.conversationId)}/regenerate`, {
      method: "POST",
      body: JSON.stringify({ expectedRevision: input.expectedRevision, expectedAssistantMessageId: input.expectedAssistantMessageId, assistantMessage, conversationSummaryPatch: input.conversationSummaryPatch }),
    })).conversation;
  }

  async editAndResendLastTurn(input: EditAndResendConversationInput) {
    const turn = createPersistedTurnPayload(input.question, input.result);
    return (await this.request<{ conversation: Conversation }>(`/${encodeURIComponent(input.conversationId)}/edit-resend`, {
      method: "POST",
      body: JSON.stringify({ expectedRevision: input.expectedRevision, expectedUserMessageId: input.expectedUserMessageId, expectedAssistantMessageId: input.expectedAssistantMessageId, ...turn, conversationSummaryPatch: input.conversationSummaryPatch }),
    })).conversation;
  }
}
