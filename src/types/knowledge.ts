import type { AgentScenario } from "./common";
import type { AgentRoute } from "./agent";

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
