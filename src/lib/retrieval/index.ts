import { retrieveHybrid } from "@/lib/retrieval/hybridRetriever";
import { retrieveMockEmbedding } from "@/lib/retrieval/mockEmbeddingRetriever";
import type { Retriever, RetrieverInput, RetrieverResult } from "@/lib/retrieval/types";
import type { RetrieverMode, RetrievedChunk } from "@/types";

function normalizeQueryLength(query: string) {
  return query.replace(/[\s,.!?;:()[\]{}<>"'~@#$%^&*_+=|\\/-]/g, "").length;
}

function mergeChunks(primary: RetrievedChunk[], secondary: RetrievedChunk[], topK: number) {
  const byId = new Map<string, RetrievedChunk>();
  for (const item of primary) byId.set(item.chunk.id, item);
  for (const item of secondary) {
    const existing = byId.get(item.chunk.id);
    if (existing) {
      const embeddingScore = item.embeddingScore ?? item.scoreBreakdown?.embeddingScore ?? 0;
      existing.embeddingScore = embeddingScore;
      existing.rerankReason = "mock embedding rerank merged with hybrid result";
      const baseBreakdown = existing.scoreBreakdown ?? {
        keywordScore: existing.score,
        titleScore: 0,
        tagScore: 0,
        categoryScore: 0,
        packScore: 0,
        sourceScore: 0,
        phraseScore: 0,
        freshnessScore: 0,
        totalScore: existing.score,
      };
      const rerankScore = Math.round(existing.score + embeddingScore * 0.25);
      existing.scoreBreakdown = {
        ...baseBreakdown,
        embeddingScore,
        rerankScore,
        totalScore: rerankScore,
      };
      existing.score = rerankScore;
      existing.scoreReason = [...(existing.scoreReason ?? []), "mock embedding rerank boost"];
    } else if ((item.embeddingScore ?? 0) >= 15) {
      byId.set(item.chunk.id, { ...item, rerankReason: "mock embedding supplemental candidate" });
    }
  }
  return Array.from(byId.values()).sort((left, right) => right.score - left.score).slice(0, topK);
}

export const hybridRetriever: Retriever = {
  mode: "hybrid",
  retrieve: retrieveHybrid,
};

export const mockEmbeddingRetriever: Retriever = {
  mode: "mock_embedding",
  retrieve: retrieveMockEmbedding,
};

export function retrieveAuto(input: RetrieverInput): RetrieverResult {
  const topK = input.topK ?? 3;
  const hybrid = retrieveHybrid(input);
  const shouldTryEmbedding = hybrid.metadata.lowConfidenceRetrieval || normalizeQueryLength(input.query) <= 8;
  if (!shouldTryEmbedding) {
    return {
      ...hybrid,
      metadata: {
        ...hybrid.metadata,
        retrieverMode: "auto",
        retrievalStrategy: "auto -> hybrid only",
        rerankReason: "Hybrid retrieval confidence was sufficient; mock embedding rerank skipped.",
      },
      mode: "auto",
    };
  }

  const embedding = retrieveMockEmbedding(input);
  const merged = mergeChunks(hybrid.chunks, embedding.chunks, topK);
  const maxScore = merged.length ? Math.max(...merged.map((item) => item.score)) : 0;
  const averageScore = merged.length ? Math.round(merged.reduce((sum, item) => sum + item.score, 0) / merged.length) : 0;
  const stillLow = hybrid.metadata.lowConfidenceRetrieval && maxScore < 10;
  return {
    chunks: merged,
    metadata: {
      ...hybrid.metadata,
      selectedChunkCount: merged.length,
      maxScore,
      averageScore,
      retrievalConfidence: stillLow ? "low" : hybrid.metadata.retrievalConfidence === "low" ? "medium" : hybrid.metadata.retrievalConfidence,
      lowConfidenceRetrieval: stillLow,
      lowConfidenceReason: stillLow ? hybrid.metadata.lowConfidenceReason : undefined,
      retrieverMode: "auto",
      retrievalStrategy: "auto -> hybrid + mock embedding rerank",
      rerankReason: hybrid.metadata.lowConfidenceRetrieval ? "Hybrid retrieval was low confidence, so mock embedding rerank was attempted." : "Short query triggered mock embedding rerank.",
      vectorReady: true,
    },
    mode: "auto",
  };
}

export function createRetriever(mode: RetrieverMode = "auto"): Retriever {
  if (mode === "hybrid") return hybridRetriever;
  if (mode === "mock_embedding") return mockEmbeddingRetriever;
  return { mode: "auto", retrieve: retrieveAuto };
}

export type { Retriever, RetrieverInput, RetrieverResult } from "@/lib/retrieval/types";
export { retrieveHybrid } from "@/lib/retrieval/hybridRetriever";
export { retrieveMockEmbedding } from "@/lib/retrieval/mockEmbeddingRetriever";