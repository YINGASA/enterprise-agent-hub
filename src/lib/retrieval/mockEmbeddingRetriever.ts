import { buildMetadata, scoreHybridCandidates, splitDocument } from "@/lib/retrieval/hybridRetriever";
import type { RetrieverInput, RetrieverResult } from "@/lib/retrieval/types";
import type { KnowledgeChunk, KnowledgePackId, RagScoreBreakdown, RetrievedChunk } from "@/types";

const VECTOR_SIZE = 64;

function normalizeText(text: string) {
  return text.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

function hashToken(token: string) {
  let hash = 2166136261;
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

function tokenize(text: string) {
  const normalized = normalizeText(text);
  const latin = normalized.match(/[a-z0-9_+-]{2,}/g) ?? [];
  const chinese = normalized.match(/[\u4e00-\u9fa5]{2,}/g) ?? [];
  const grams = chinese.flatMap((item) => {
    if (item.length <= 2) return [item];
    const values: string[] = [];
    for (let index = 0; index <= item.length - 2; index += 1) values.push(item.slice(index, index + 2));
    return values;
  });
  return [...latin, ...chinese, ...grams];
}

export function textToMockEmbedding(text: string) {
  const vector = Array.from({ length: VECTOR_SIZE }, () => 0);
  for (const token of tokenize(text)) {
    const hash = hashToken(token);
    const index = hash % VECTOR_SIZE;
    const sign = hash % 2 === 0 ? 1 : -1;
    vector[index] += sign * (1 + Math.min(token.length, 8) / 8);
  }
  const length = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  return length ? vector.map((value) => value / length) : vector;
}

function cosine(left: number[], right: number[]) {
  let score = 0;
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) score += left[index] * right[index];
  return score;
}

function chunkText(chunk: KnowledgeChunk) {
  return [chunk.sourceTitle, chunk.category, chunk.tags?.join(" "), chunk.keywords.join(" "), chunk.content].filter(Boolean).join(" ");
}

function selectDiverse(candidates: RetrievedChunk[], topK: number) {
  const selected: RetrievedChunk[] = [];
  const usedDocuments = new Set<string>();
  for (const item of candidates) {
    if (selected.length >= topK) break;
    if (!usedDocuments.has(item.chunk.documentId)) {
      selected.push(item);
      usedDocuments.add(item.chunk.documentId);
    }
  }
  for (const item of candidates) {
    if (selected.length >= topK) break;
    if (!selected.some((selectedItem) => selectedItem.chunk.id === item.chunk.id)) selected.push(item);
  }
  return selected;
}

export function retrieveMockEmbedding(input: RetrieverInput): RetrieverResult {
  const chunks = input.chunks ?? input.documents.flatMap((document) => splitDocument(document));
  const topK = input.topK ?? 3;
  const queryVector = textToMockEmbedding(input.query);
  const reliableCandidates = scoreHybridCandidates(input.query, chunks, input.packId as KnowledgePackId | undefined);
  const reliableIds = new Set(reliableCandidates.map((item) => item.chunk.id));
  const candidates = chunks.filter((chunk) => reliableIds.has(chunk.id)).map((chunk) => {
    const similarity = cosine(queryVector, textToMockEmbedding(chunkText(chunk)));
    const embeddingScore = Math.max(0, Math.round(similarity * 1000) / 10);
    const packBoost = input.packId && chunk.packId === input.packId ? 5 : 0;
    const sourceBoost = chunk.sourceType === "user_upload" || chunk.sourceType === "user_paste" ? 2 : 0;
    const totalScore = embeddingScore + packBoost + sourceBoost;
    const scoreBreakdown: RagScoreBreakdown = {
      keywordScore: 0,
      titleScore: 0,
      tagScore: 0,
      categoryScore: 0,
      packScore: packBoost,
      sourceScore: sourceBoost,
      phraseScore: 0,
      freshnessScore: 0,
      embeddingScore,
      rerankScore: totalScore,
      totalScore,
    };
    return {
      chunk,
      score: Math.round(totalScore),
      matchedKeywords: [],
      scoreReason: ["mock embedding cosine similarity", ...(packBoost ? ["pack boost " + input.packId] : []), ...(sourceBoost ? ["user document boost"] : [])],
      scoreBreakdown,
      embeddingScore,
      rerankReason: "deterministic local mock embedding similarity",
    } satisfies RetrievedChunk;
  }).filter((item) => item.score >= 8).sort((left, right) => right.score - left.score);

  const selected = selectDiverse(candidates, topK);
  const metadata = buildMetadata(input.query, selected, candidates.length, { topK, preferredPackId: input.packId as KnowledgePackId | undefined, scenario: input.scenario });
  return {
    chunks: selected,
    metadata: {
      ...metadata,
      retrieverMode: "mock_embedding",
      retrievalStrategy: "deterministic local token-hash mock embedding + cosine similarity",
      rerankReason: "mock embedding retriever selected directly",
      vectorReady: true,
    },
    mode: "mock_embedding",
  };
}
