import type { AgentScenario } from "./common";
import type { AgentRoute } from "./agent";

export type KnowledgeDocument = {
  id: string;
  packId?: string;
  /** Workspace-owned enterprise pack. `packId` remains the built-in RAG category. */
  knowledgePackId?: string;
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
  mimeType?: string;
  sizeBytes?: number;
  importJobId?: string;
  revision?: number;
  metadata?: Record<string, unknown>;
  importedAt?: string;
  enabled?: boolean;
  suggestedQuestions?: string[];
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
  knowledgePackId?: string;
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

export type RagTestSource = {
  sourceId: string;
  documentId: string;
  title: string;
  sourceType: KnowledgeSourceType;
  chunkIndex: number;
  score: number;
  confidence: RetrievalConfidence;
  matchedSignals: string[];
  scoreReason: string[];
  contentPreview: string;
  isUserDocument: boolean;
};

export type RagTestDiagnostic = {
  question: string;
  route: AgentRoute;
  needsClarification: boolean;
  clarificationQuestion?: string;
  candidateCount: number;
  reliableSourceCount: number;
  retrievalConfidence: RetrievalConfidence;
  fallback: boolean;
  lowConfidenceReason?: string;
  sources: RagTestSource[];
  hitUserDocument: boolean;
  currentDocumentId?: string;
  hitCurrentDocument?: boolean;
  currentDocumentIsTopSource?: boolean;
  currentDocumentChunkIndex?: number;
  currentDocumentMissReason?: string;
};

export type RagTestHistoryItem = {
  version: 1;
  id: string;
  question: string;
  documentId?: string;
  testedAt: string;
  hit: boolean;
  topSourceId?: string;
  confidence: RetrievalConfidence;
  candidateCount: number;
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

/** `recruitment-career` is legacy-only so historical sources and backups remain readable. */
export type KnowledgePackId = "enterprise-policy" | "ecommerce-support" | "recruitment-career" | "ai-engineering";

export type KnowledgePack = {
  id: KnowledgePackId;
  name: string;
  description: string;
  scenario: AgentScenario | "ai-engineering";
};

export type WorkspaceKnowledgePackStatus = "active" | "archived";

export type WorkspaceKnowledgePack = {
  id: string;
  name: string;
  description?: string;
  status: WorkspaceKnowledgePackStatus;
  documentCount: number;
  revision: number;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeImportJobStatus =
  | "pending"
  | "preview_ready"
  | "processing"
  | "completed"
  | "partial_failed"
  | "failed"
  | "cancelled";

export type KnowledgeImportItemStatus =
  | "preview_ready"
  | "ready"
  | "processing"
  | "completed"
  | "failed"
  | "skipped"
  | "conflicted"
  | "cancelled";

export type KnowledgeDuplicateType =
  | "none"
  | "exact_content"
  | "same_title"
  | "same_file_name"
  | "possible_duplicate";

export type KnowledgeConflictResolution = "skip" | "replace" | "import_as_new";
export type KnowledgeImportQualityLevel = "excellent" | "usable" | "needs_attention" | "blocked";

export type KnowledgeImportChunkPreview = {
  chunkIndex: number;
  characterCount: number;
  approximateTokens: number;
  keywords: string[];
  contentPreview: string;
  tooShort: boolean;
  tooLong: boolean;
  possibleDuplicate: boolean;
  lowInformation: boolean;
  qualityLevel: Exclude<KnowledgeImportQualityLevel, "blocked">;
};

export type KnowledgeImportPreviewMetadata = {
  title: string;
  category: string;
  tags: string[];
  sourceType: Extract<KnowledgeSourceType, "user_upload" | "user_paste">;
  enabled: boolean;
  suggestedQuestions: string[];
  /** `null` explicitly overrides a batch-level pack and imports without a pack. */
  knowledgePackId?: string | null;
  metadata: Record<string, unknown>;
};

export type KnowledgeImportItem = {
  id: string;
  importJobId: string;
  itemIndex: number;
  originalFileName: string;
  normalizedTitle: string;
  mimeType: string;
  sizeBytes: number;
  status: KnowledgeImportItemStatus;
  duplicateType: KnowledgeDuplicateType;
  conflictDocumentId?: string;
  conflictResolution?: KnowledgeConflictResolution;
  extractedCharacterCount: number;
  estimatedChunkCount: number;
  checksumStatus: "computed";
  qualityLevel: KnowledgeImportQualityLevel;
  qualityLabel: "优秀" | "可用" | "需处理" | "无法导入";
  warnings: string[];
  metadata: KnowledgeImportPreviewMetadata;
  chunkPreview: KnowledgeImportChunkPreview[];
  documentId?: string;
  errorCode?: string;
  errorMessageSafe?: string;
  retryable?: boolean;
  retryCount: number;
  revision: number;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeImportJob = {
  id: string;
  knowledgePackId?: string;
  status: KnowledgeImportJobStatus;
  totalItems: number;
  completedItems: number;
  failedItems: number;
  skippedItems: number;
  conflictedItems: number;
  revision: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  items: KnowledgeImportItem[];
};

export type KnowledgeImportJobItemConfirmation = {
  itemId: string;
  expectedRevision: number;
  metadata: KnowledgeImportPreviewMetadata;
  conflictResolution: KnowledgeConflictResolution;
};
