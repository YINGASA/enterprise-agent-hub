export type Feature = {
  title: string;
  description: string;
};

export type Scenario = {
  id: string;
  name: string;
  description: string;
  questions: string[];
  tools: string[];
  outputType: string;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AgentDecision = {
  step: string;
  detail: string;
  status: "done" | "pending";
};

export type ToolCallLog = {
  tool: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
};

export type KnowledgeDocument = {
  id: string;
  packId?: string;
  title: string;
  category: string;
  tags?: string[];
  summary?: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  source?: string;
  owner?: string;
  chunks?: Array<{
    id: string;
    content: string;
    score: number;
  }>;
  citations?: string[];
  isDefault?: boolean;
  sourceType?: KnowledgeSourceType;
  originalFileName?: string;
  importedAt?: string;
  enabled?: boolean;
};

export type KnowledgeSourceType = "default" | "user_upload" | "user_paste";

export type ImportedKnowledgeDocument = KnowledgeDocument & {
  sourceType: "user_upload" | "user_paste";
  isDefault: false;
  originalFileName?: string;
  importedAt: string;
};

export type KnowledgeChunk = {
  id: string;
  documentId: string;
  packId?: string;
  sourceTitle: string;
  category: string;
  tags?: string[];
  sourceType?: KnowledgeSourceType;
  originalFileName?: string;
  chunkIndex: number;
  content: string;
  keywords: string[];
};

export type RetrievalConfidence = "high" | "medium" | "low";
export type RetrieverMode = "hybrid" | "mock_embedding" | "auto";

export type RagScoreBreakdown = {
  keywordScore: number;
  titleScore: number;
  tagScore: number;
  categoryScore: number;
  packScore: number;
  sourceScore: number;
  phraseScore: number;
  freshnessScore: number;
  embeddingScore?: number;
  rerankScore?: number;
  totalScore: number;
};

export type QueryExpansionResult = {
  originalQuery: string;
  normalizedQuery: string;
  keywords: string[];
  expandedKeywords: string[];
  phrases: string[];
  preferredPackId?: KnowledgePackId;
  scenario?: AgentScenario | "ai-engineering";
};

export type RagRetrievalMetadata = {
  query: QueryExpansionResult;
  topK: number;
  candidateCount: number;
  selectedChunkCount: number;
  maxScore: number;
  averageScore: number;
  retrievalConfidence: RetrievalConfidence;
  lowConfidenceRetrieval: boolean;
  lowConfidenceReason?: string;
  retrieverMode?: RetrieverMode;
  retrievalStrategy?: string;
  rerankReason?: string;
  vectorReady?: boolean;
};

export type RetrievedChunk = {
  chunk: KnowledgeChunk;
  score: number;
  matchedKeywords: string[];
  scoreReason?: string[];
  scoreBreakdown?: RagScoreBreakdown;
  embeddingScore?: number;
  rerankReason?: string;
};

export type RagAnswer = {
  question: string;
  answer: string;
  retrievedChunks: RetrievedChunk[];
  sources: Array<{
    documentId: string;
    title: string;
    category: string;
    packId?: string;
    sourceType?: KnowledgeSourceType;
    tags?: string[];
    score?: number;
    scoreReason?: string[];
    scoreBreakdown?: RagScoreBreakdown;
    matchedKeywords?: string[];
    contentPreview?: string;
    chunkIndexes: number[];
  }>;
  mode: "mock-rag";
  createdAt: string;
  retrievalMetadata?: RagRetrievalMetadata;
  retrievalConfidence?: RetrievalConfidence;
  lowConfidenceRetrieval?: boolean;
  lowConfidenceReason?: string;
};

export type KnowledgeImportResult =
  | { ok: true; document: ImportedKnowledgeDocument }
  | { ok: false; error: KnowledgeImportError };

export type KnowledgeImportError = {
  code: "empty_content" | "unsupported_file_type" | "file_too_large" | "parse_error" | "missing_title";
  message: string;
};

export type KnowledgeLibraryState = {
  defaultDocuments: KnowledgeDocument[];
  userDocuments: ImportedKnowledgeDocument[];
  allDocuments: KnowledgeDocument[];
};

export type KnowledgePackId = "enterprise-policy" | "ecommerce-support" | "recruitment-career" | "ai-engineering";

export type KnowledgePack = {
  id: KnowledgePackId;
  name: string;
  description: string;
  scenario: AgentScenario | "ai-engineering";
};

export type CompanyPolicy = {
  id: string;
  title: string;
  category: "expense" | "vacation" | "leave" | "security";
  summary: string;
  rules: string[];
  updatedAt: string;
};

export type PolicyDocument = {
  id: string;
  title: string;
  category: string;
  content: string;
  updatedAt: string;
};

export type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  sizeAdvice: string;
  stock: number;
  sellingPoints: string[];
};

export type Order = {
  id: string;
  user: string;
  productId: string;
  productName: string;
  status: "paid" | "picking" | "shipped" | "signed" | "refunding" | "closed";
  signedAt: string | null;
  opened: boolean;
  returnSupported: boolean;
};

export type AfterSalePolicy = {
  id: string;
  title: string;
  category: "return" | "quality" | "opened_limit" | "special_goods";
  rules: string[];
  updatedAt: string;
};

export type JobDescription = {
  id: string;
  title: string;
  level: string;
  keywords: string[];
  responsibilities: string[];
  requirements: string[];
};

export type ResumeProfile = {
  id: string;
  name: string;
  summary: string;
  skills: string[];
  projects: string[];
};

export type InterviewQuestion = {
  id: string;
  jobId: string;
  question: string;
  focus: string;
};

export type ToolName =
  | "queryOrder"
  | "queryProduct"
  | "searchPolicy"
  | "createTicket"
  | "analyzeJD"
  | "generateCustomerReply";

export type ToolDefinition = {
  name: ToolName;
  scenario: string;
  description: string;
  inputExample: Record<string, unknown>;
  outputExample: Record<string, unknown>;
};

export type ToolRunStatus = "idle" | "success" | "failed";

export type ToolRunResult<TData = Record<string, unknown>> = {
  status: Exclude<ToolRunStatus, "idle">;
  tool: ToolName;
  input: Record<string, unknown>;
  data?: TData;
  error?: string;
  executedAt: string;
};

export type AgentScenario = "enterprise" | "ecommerce" | "recruitment" | "ai_engineering" | "general";

export type AgentIntent =
  | "knowledge_qa"
  | "policy_check"
  | "order_query"
  | "product_query"
  | "after_sale_reply"
  | "jd_match"
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
};

export type LlmErrorType =
  | "missing_api_key"
  | "missing_base_url"
  | "missing_model"
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

export type AgentApiMetadata = {
  requestedMode: LlmMode;
  responseMode: AgentResponseMode;
  provider: LlmProvider;
  model: string;
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
};

export type AgentApiResponse = AgentPipelineResult & {
  api: AgentApiMetadata;
};
export type AgentExample = {
  question: string;
  expectedScenario: AgentScenario;
  expectedIntent: AgentIntent;
  expectedTools: ToolName[];
  expectedNeedRag: boolean;
};


export type ChatRunHistoryItem = {
  id: string;
  createdAt: string;
  question: string;
  finalAnswer: string;
  responseMode: string;
  scenario: string;
  intent: string;
  confidence?: number;
  riskLevel?: string;
  needsClarification?: boolean;
  fallback?: boolean;
  fallbackReason?: string;
  toolsUsed?: string[];
  sourcesCount?: number;
  retrievalConfidence?: RetrievalConfidence;
  retrieverMode?: RetrieverMode;
  rerankReason?: string;
  durationMs?: number;
  resultSnapshot?: unknown;
};

export type ChatAnswerFeedbackValue = "positive" | "negative" | "accurate" | "inaccurate";

export type ChatAnswerFeedbackItem = {
  id: string;
  createdAt: string;
  question: string;
  answerPreview: string;
  values: ChatAnswerFeedbackValue[];
  reason?: string;
  scenario: string;
  intent: string;
  responseMode: string;
  sourceTitles: string[];
  retrievalConfidence?: RetrievalConfidence;
  fallback?: boolean;
};

export type ChatFeedbackSummary = {
  total: number;
  helpfulCount: number;
  notHelpfulCount: number;
  accurateCount: number;
  inaccurateCount: number;
  helpfulRate: number;
  citationAccuracyRate: number;
  commonIssueTypes: string[];
  recent: ChatAnswerFeedbackItem[];
};
export type EvaluationCase = {
  id: string;
  question: string;
  expectedScenario: AgentScenario;
  expectedIntent: AgentIntent;
  expectedTools: ToolName[];
  expectedNeedRag: boolean;
  expectedKeywords: string[];
  category: AgentScenario;
  difficulty: "easy" | "medium" | "hard";
  packId?: KnowledgePackId | "fallback";
};

export type EvaluationFailureReason =
  | "scenario_mismatch"
  | "intent_mismatch"
  | "tool_mismatch"
  | "rag_usage_mismatch"
  | "keyword_miss"
  | "citation_miss"
  | "pipeline_error";

export type EvaluationCaseResult = {
  caseId: string;
  question: string;
  passed: boolean;
  scenarioMatched: boolean;
  intentMatched: boolean;
  toolsMatched: boolean;
  ragUsedMatched: boolean;
  keywordHit: boolean;
  citationHit: boolean;
  ragScore: number;
  responseMode: AgentResponseMode;
  durationMs: number;
  route: AgentRoute;
  toolsUsed: ToolName[];
  sources: string[];
  finalAnswer: string;
  failureReasons: EvaluationFailureReason[];
  failureSummary?: string;
  error?: string;
};

export type EvaluationSummary = {
  total: number;
  caseCount: number;
  selectedSuite: "quick" | "standard" | "full" | "custom";
  passed: number;
  passRate: number;
  scenarioAccuracy: number;
  intentAccuracy: number;
  toolHitRate: number;
  ragUsageAccuracy: number;
  citationRate: number;
  keywordHitRate: number;
  realSuccessRate: number;
  jsonParseSuccessRate: number;
  fallbackRate: number;
  averageDurationMs: number;
  averageRagScore: number;
  fallbackCaseCount: number;
  packCoverage: Record<string, number>;
  failureBuckets: Record<EvaluationFailureReason, number>;
};

export type EvaluationRunResponse = {
  summary: EvaluationSummary;
  results: EvaluationCaseResult[];
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  mode: LlmMode;
  selectedSuite: "quick" | "standard" | "full" | "custom";
};
export type EvaluationRunHistoryItem = {
  id: string;
  createdAt: string;
  mode: "mock" | "real";
  suite: "quick" | "standard" | "full" | string;
  caseCount: number;
  passed: number;
  passRate: number;
  scenarioAccuracy: number;
  intentAccuracy: number;
  toolHitRate: number;
  ragUsageAccuracy: number;
  citationRate: number;
  keywordHitRate: number;
  fallbackRate?: number;
  averageRagScore?: number;
  failureSummary?: string;
  failureBuckets?: Record<string, number>;
  resultSnapshot?: unknown;
};

export type EvaluationMetric = {
  label: string;
  value: string;
  trend: string;
};

export type TestCase = {
  id: string;
  scenario: string;
  input: string;
  expectedTool: string;
  result: "pass" | "review";
  latency: string;
};
