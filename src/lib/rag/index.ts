import { createRetriever } from "@/lib/retrieval";
import {
  expandQuery,
  extractKeywords,
  generateMockRagAnswer,
  retrieveChunks,
  splitDocument,
} from "@/lib/retrieval/hybridRetriever";
import type { AgentScenario, KnowledgeDocument, KnowledgePackId, RetrieverMode } from "@/types";

type RagPipelineOptions = {
  topK?: number;
  packId?: KnowledgePackId;
  scenario?: AgentScenario | "ai-engineering";
  retrieverMode?: RetrieverMode;
};

const scenarioPackMap: Partial<Record<AgentScenario | "ai-engineering", KnowledgePackId>> = {
  enterprise: "enterprise-policy",
  ecommerce: "ecommerce-support",
  recruitment: "recruitment-career",
  ai_engineering: "ai-engineering",
  "ai-engineering": "ai-engineering",
};

export { expandQuery, extractKeywords, retrieveChunks, splitDocument };

export function runMockRagPipeline(question: string, documents: KnowledgeDocument[], topKOrOptions: number | RagPipelineOptions = 3) {
  const options: RagPipelineOptions = typeof topKOrOptions === "number" ? { topK: topKOrOptions } : topKOrOptions;
  const preferredPackId = options.packId ?? (options.scenario ? scenarioPackMap[options.scenario] : undefined);
  const retriever = createRetriever(options.retrieverMode ?? "auto");
  const result = retriever.retrieve({
    query: question,
    documents,
    scenario: options.scenario,
    packId: preferredPackId,
    topK: options.topK ?? 3,
  });
  return generateMockRagAnswer(question, result.chunks, result.metadata);
}