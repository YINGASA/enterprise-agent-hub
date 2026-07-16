import { sanitizeImportedKnowledgeDocument } from "@/lib/knowledge/storage";
import { agentRequestLimits } from "@/lib/ops/securityLimits";
import { buildConversationContext } from "@/lib/conversation/context";
import { MAX_CONTEXT_CANDIDATES, MAX_CONTEXT_CANDIDATE_CHARACTERS, MAX_CONTEXT_CANDIDATE_TOTAL_CHARACTERS } from "@/lib/conversation/context-candidates";
import type { ContextCandidateMessage, ConversationContext, ConversationContextMeta, ImportedKnowledgeDocument, LlmMode } from "@/types";

type AgentRequestBody = {
  question?: unknown;
  mode?: unknown;
  userDocuments?: unknown;
  conversationContext?: unknown;
  contextCandidates?: unknown;
};

export type ValidatedAgentRequest = {
  question: string;
  mode: LlmMode;
  userDocuments: ImportedKnowledgeDocument[];
  conversationContext: ConversationContext;
  contextMeta: ConversationContextMeta;
  contextCandidates: ContextCandidateMessage[];
};

export type AgentRequestValidationError = {
  status: 400 | 413;
  message: string;
};

const isNonEmptyString = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

function tooLong(value: unknown, limit: number) {
  return typeof value === "string" && value.length > limit;
}

function validateUserDocument(value: unknown): AgentRequestValidationError | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { status: 400, message: "用户文档格式不正确。" };

  const document = value as Record<string, unknown>;
  if (!isNonEmptyString(document.id) || !isNonEmptyString(document.title) || !isNonEmptyString(document.content)) {
    return { status: 400, message: "用户文档需要包含 id、标题和正文。" };
  }

  const oversized =
    tooLong(document.id, agentRequestLimits.documentIdChars) ||
    tooLong(document.title, agentRequestLimits.documentTitleChars) ||
    tooLong(document.category, agentRequestLimits.documentCategoryChars) ||
    tooLong(document.content, agentRequestLimits.documentContentChars) ||
    tooLong(document.summary, agentRequestLimits.documentSummaryChars);
  if (oversized) return { status: 413, message: "用户文档字段长度超过允许范围。" };

  if (document.tags !== undefined && (!Array.isArray(document.tags) || document.tags.length > agentRequestLimits.documentTags || document.tags.some((tag) => !isNonEmptyString(tag) || tooLong(tag, agentRequestLimits.documentTagChars)))) {
    return { status: 413, message: "用户文档标签数量或长度超过允许范围。" };
  }

  if (document.suggestedQuestions !== undefined && (!Array.isArray(document.suggestedQuestions) || document.suggestedQuestions.length > agentRequestLimits.documentSuggestedQuestions || document.suggestedQuestions.some((question) => !isNonEmptyString(question) || tooLong(question, agentRequestLimits.documentSuggestedQuestionChars)))) {
    return { status: 413, message: "建议测试问题数量或长度超过允许范围。" };
  }

  return null;
}

export function validateAgentRequest(body: AgentRequestBody): ValidatedAgentRequest | AgentRequestValidationError {
  const rawQuestion = body.question;
  if (!isNonEmptyString(rawQuestion)) return { status: 400, message: "请输入问题后再提交。" };
  const question = rawQuestion.trim();
  if (question.length > agentRequestLimits.questionChars) return { status: 413, message: "问题过长，请缩短后再提交。" };
  const mode = body.mode === undefined ? "mock" : body.mode;
  if (mode !== "mock" && mode !== "real") return { status: 400, message: "请求模式不合法。" };
  if (body.userDocuments !== undefined && !Array.isArray(body.userDocuments)) return { status: 400, message: "用户文档格式不正确。" };

  const rawDocuments = body.userDocuments ?? [];
  if (rawDocuments.length > agentRequestLimits.userDocuments) return { status: 413, message: "一次参与检索的用户文档数量超过限制。" };

  let totalContentChars = 0;
  const userDocuments: ImportedKnowledgeDocument[] = [];
  for (const rawDocument of rawDocuments) {
    const error = validateUserDocument(rawDocument);
    if (error) return error;
    const document = rawDocument as Record<string, unknown>;
    totalContentChars += (document.content as string).length;
    if (totalContentChars > agentRequestLimits.userDocumentTotalChars) return { status: 413, message: "本次用户文档总内容超过限制。" };
    const sanitized = sanitizeImportedKnowledgeDocument(rawDocument);
    if (!sanitized) return { status: 400, message: "用户文档无法解析。" };
    userDocuments.push(sanitized);
  }

  let contextCandidates: ContextCandidateMessage[] = [];
  if (body.contextCandidates !== undefined) {
    if (!Array.isArray(body.contextCandidates)) return { status: 400, message: "上下文候选消息格式不正确。" };
    if (body.contextCandidates.length > MAX_CONTEXT_CANDIDATES) return { status: 413, message: "上下文候选消息数量超过限制。" };
    let total = 0;
    for (const value of body.contextCandidates) {
      if (!value || typeof value !== "object" || Array.isArray(value)) return { status: 400, message: "上下文候选消息格式不正确。" };
      const item = value as Record<string, unknown>;
      if (typeof item.id !== "string" || !isNonEmptyString(item.content) || (item.role !== "user" && item.role !== "assistant")) return { status: 400, message: "上下文候选消息字段不正确。" };
      if (item.content.length > MAX_CONTEXT_CANDIDATE_CHARACTERS) return { status: 413, message: "上下文候选消息内容过长。" };
      total += item.content.length;
      if (total > MAX_CONTEXT_CANDIDATE_TOTAL_CHARACTERS) return { status: 413, message: "上下文候选消息总内容超过限制。" };
      contextCandidates.push({ id: item.id.slice(0, 128), role: item.role, content: item.content.trim(), ...(typeof item.createdAt === "string" ? { createdAt: item.createdAt } : {}), ...(typeof item.scenario === "string" ? { scenario: item.scenario as ContextCandidateMessage["scenario"] } : {}), ...(typeof item.intent === "string" ? { intent: item.intent as ContextCandidateMessage["intent"] } : {}) });
    }
  }
  const { context: conversationContext, meta: contextMeta } = buildConversationContext(
    body.conversationContext && typeof body.conversationContext === "object" ? body.conversationContext as { messages?: unknown } : undefined,
    question,
  );
  if (!contextCandidates.length && conversationContext.messages.length) contextCandidates = conversationContext.messages.map((message, index) => ({ id: `legacy-context-${index}`, ...message }));
  return { question, mode, userDocuments, conversationContext, contextMeta, contextCandidates };
}
