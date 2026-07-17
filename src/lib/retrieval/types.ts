import type {
  AgentIntent,
  AgentScenario,
  KnowledgeChunk,
  KnowledgeDocument,
  RagRetrievalMetadata,
  RetrievedChunk,
  RetrieverMode,
} from "@/types";

export type RetrieverInput = {
  query: string;
  documents: KnowledgeDocument[];
  /** Optional persisted chunks. When omitted the retriever deterministically derives chunks from documents. */
  chunks?: KnowledgeChunk[];
  scenario?: AgentScenario | "ai-engineering";
  intent?: AgentIntent;
  packId?: string;
  topK?: number;
};

export type RetrieverResult = {
  chunks: RetrievedChunk[];
  metadata: RagRetrievalMetadata;
  mode: RetrieverMode;
};

export interface Retriever {
  mode: RetrieverMode;
  retrieve(input: RetrieverInput): RetrieverResult;
}
