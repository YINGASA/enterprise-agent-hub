import type { AgentScenario } from "./common";
import type { KnowledgePackId, KnowledgeSourceType, RagAnswer, RetrievalConfidence } from "./knowledge";
import type { ToolName, ToolRunResult } from "./tools";

export type AgentIntent =
  | "knowledge_qa"
  | "policy_check"
  | "order_query"
  | "product_query"
  | "after_sale_reply"
  | "jd_match" // Legacy-only: old Conversation, Evaluation, and Ops records.
  | "ticket_create"
  | "general_chat";

export type AgentRoute = {
  scenario: AgentScenario;
  intent: AgentIntent;
  needRag: boolean;
  toolsNeeded: ToolName[];
  confidence: number;
  reason: string;
};

export type AgentStep = {
  id: string;
  name: string;
  type: "router" | "rag" | "tool" | "response";
  status: "success" | "failed" | "skipped";
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  durationMs: number;
};

export type AgentStructuredOutput = {
  scenario: AgentScenario;
  intent: AgentIntent;
  answer: string;
  evidence: string[];
  toolsUsed: ToolName[];
  sources: string[];
  confidence: number;
  riskLevel: "low" | "medium" | "high";
  nextAction: string;
  needsClarification?: boolean;
  missingFields?: string[];
  clarificationQuestion?: string;
  usedDemoData?: boolean;
  dataBoundaryNote?: string;
};

export type AgentPipelineResult = {
  question: string;
  route: AgentRoute;
  steps: AgentStep[];
  ragAnswer: RagAnswer | null;
  toolResults: ToolRunResult[];
  finalAnswer: string;
  structuredOutput: AgentStructuredOutput;
  createdAt: string;
  mode: "mock-agent";
};
export type LlmProvider = "mock" | "openai-compatible" | "deepseek";

export type LlmMode = "mock" | "real";

export type LlmProxyType = "HTTPS_PROXY" | "HTTP_PROXY" | "ALL_PROXY" | "none";

export type LlmMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LlmConfigDiagnostics = {
  hasApiKey: boolean;
  maskedApiKey: string;
  apiKeyLength: number;
  hasProxy: boolean;
  proxyType: LlmProxyType;
  maskedProxyUrl: string;
  timeoutMs: number;
  baseUrl: string;
  normalizedBaseUrl: string;
  requestUrl: string;
  model: string;
  provider: LlmProvider;
};

export type LlmClientConfig = LlmConfigDiagnostics & {
  apiKey?: string;
  isConfigured: boolean;
  missing: Array<"missing_api_key" | "missing_base_url" | "missing_model">;
};

export type LlmGenerateOptions = {
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "json_object" | "text";
  signal?: AbortSignal;
};

export type LlmErrorType =
  | "missing_api_key"
  | "missing_base_url"
  | "missing_model"
  | "timeout_error"
  | "network_error"
  | "http_error"
  | "invalid_response_shape"
  | "json_parse_error";

export type LlmGenerateResult = {
  content: string;
  parsedJson: Record<string, unknown> | null;
  raw: unknown;
  model: string;
  provider: LlmProvider;
  mode: LlmMode;
  durationMs: number;
  requestUrl: string;
  hasProxy: boolean;
  proxyType: LlmProxyType;
  maskedProxyUrl: string;
  timeoutMs: number;
  httpStatus?: number;
  statusText?: string;
  responseBodyPreview?: string;
  errorType?: LlmErrorType;
  errorName?: string;
  errorMessage?: string;
  causeMessage?: string;
  causeCode?: string;
  rawContentPreview?: string;
  parseError?: string;
  error?: string;
};

export type AgentResponseMode = "mock" | "real" | "real_repaired" | "real_text_fallback" | "real_error_fallback" | "fallback";

export type AgentRequestAction = "send" | "retry" | "regenerate" | "edit_resend";

export type AgentApiMetadata = {
  requestedMode: LlmMode;
  responseMode: AgentResponseMode;
  provider?: LlmProvider;
  model?: string;
  fallbackReason?: LlmErrorType | "llm_error";
  requestUrl?: string;
  hasApiKey?: boolean;
  maskedApiKey?: string;
  apiKeyLength?: number;
  hasProxy?: boolean;
  proxyType?: LlmProxyType;
  maskedProxyUrl?: string;
  timeoutMs?: number;
  errorType?: LlmErrorType;
  httpStatus?: number;
  statusText?: string;
  llmDurationMs?: number;
  llmError?: string;
  parseError?: string;
  rawContentPreview?: string;
  contextApplied?: boolean;
  contextMessageCount?: number;
  contextTruncated?: boolean;
  contextCharacterCount?: number;
  contextTrace?: ContextTrace;
  streamingRequested?: boolean;
  streamingUsed?: boolean;
  streamFallback?: boolean;
  aborted?: boolean;
  streamDeltaCount?: number;
  requestAction?: AgentRequestAction;
};

export type ConversationMessageRole = "user" | "assistant";

export type ConversationMessage = {
  id: string;
  role: ConversationMessageRole;
  content: string;
  createdAt: string;
  runId?: string;
  responseMode?: AgentResponseMode;
  intent?: AgentIntent;
  scenario?: AgentScenario;
  contextApplied?: boolean;
  contextMessageCount?: number;
  contextTruncated?: boolean;
  contextCharacterCount?: number;
  details?: ConversationAssistantDetails;
};

export type ConversationAssistantDetails = {
  sources?: Array<{
    documentId: string;
    title: string;
    category: string;
    sourceType?: KnowledgeSourceType;
    score?: number;
    chunkIndexes: number[];
  }>;
  tools?: Array<Pick<ToolRunResult, "tool" | "status">>;
  steps?: Array<Pick<AgentStep, "id" | "name" | "type" | "status" | "durationMs">>;
  retrievalConfidence?: RetrievalConfidence;
  confidence?: number;
  riskLevel?: AgentStructuredOutput["riskLevel"];
  needsClarification?: boolean;
};

export type Conversation = {
  id: string;
  title: string;
  titleSource: "auto" | "manual";
  createdAt: string;
  updatedAt: string;
  messages: ConversationMessage[];
  schemaVersion: 1;
  conversationSummary?: ConversationSummaryState;
};

export type ConversationSummaryState = { text: string; throughMessageId: string; updatedAt: string; version: 1; sourceMessageCount: number };
export type ConversationSummaryPatch = { set: ConversationSummaryState; clear?: never } | { clear: true; set?: never };
export type SummaryInvalidReason = "missing_cursor" | "cursor_not_found" | "cursor_not_assistant" | "cursor_in_protected_recent" | "unsupported_version" | "invalid_text" | "invalid_source_count";

export type ConversationContext = {
  messages: Array<Pick<ConversationMessage, "role" | "content">>;
};

export type ConversationContextMeta = {
  contextApplied: boolean;
  contextMessageCount: number;
  contextTruncated: boolean;
  contextCharacterCount: number;
};

/**
 * V2.1.0 Context Foundation types. These types are runtime-only planning
 * inputs and deliberately do not change the persisted Conversation schema.
 */
export type ContextMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ContextEvidence = {
  id?: string;
  sourceTitle?: string;
  content: string;
};

export type ContextToolResult = {
  tool: string;
  status: "success" | "failed";
  content: string;
};

export type ContextStrategy = "recent_only" | "recent_selective" | "summary_recent" | "summary_selective";

export type ContextCandidateMessage = ContextMessage & { id: string; createdAt?: string; scenario?: AgentScenario; intent?: AgentIntent };
export type ContextSelectionReason = "keyword_overlap" | "route_scene_match" | "route_intent_match" | "recency_tiebreak";

export type ContextTruncationReason =
  | "none"
  | "tool_results"
  | "rag_evidence"
  | "selected_history"
  | "recent_messages"
  | "priority_sections_exceed_budget"
  | "safety_margin_exceeded";

export type ContextBudgetConfig = {
  modelContextTokens: number;
  reservedOutputTokens: number;
  maximumInputTokens: number;
  safetyMarginTokens: number;
  systemInstructionsTokens: number;
  currentUserMessageTokens: number;
  recentMessagesTokens: number;
  selectedHistoryTokens: number;
  conversationSummaryTokens: number;
  ragEvidenceTokens: number;
  toolResultsTokens: number;
};

export type ContextSectionUsage = {
  systemInstructions: number;
  currentUserMessage: number;
  recentMessages: number;
  selectedHistory: number;
  conversationSummary: number;
  ragEvidence: number;
  toolResults: number;
  totalInputEstimate: number;
};

export type ContextTrace = {
  contextStrategy: ContextStrategy;
  totalInputEstimate: number;
  budgetLimit: number;
  summaryUsed: boolean;
  summaryMessageCount: number;
  recentMessageCount: number;
  selectedHistoryCount: number;
  droppedMessageCount: number;
  ragIncluded: boolean;
  toolResultsIncluded: boolean;
  truncationReason: ContextTruncationReason;
  candidateMessageCount?: number;
  selectedTurnCount?: number;
  summaryUpdated?: boolean;
  summaryVersion?: 1;
  summaryFallbackReason?: SummaryInvalidReason;
};

export type AgentApiResponse = AgentPipelineResult & {
  api: AgentApiMetadata;
  runId?: string;
  conversationSummaryPatch?: ConversationSummaryPatch;
};
export type AgentExample = {
  question: string;
  expectedScenario: AgentScenario;
  expectedIntent: AgentIntent;
  expectedTools: ToolName[];
  expectedNeedRag: boolean;
};
