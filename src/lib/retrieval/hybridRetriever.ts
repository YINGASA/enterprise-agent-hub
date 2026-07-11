import type {
  AgentScenario,
  KnowledgeChunk,
  KnowledgeDocument,
  KnowledgePackId,
  QueryExpansionResult,
  RagAnswer,
  RagRetrievalMetadata,
  RagScoreBreakdown,
  RetrievalConfidence,
  RetrievedChunk,
} from "@/types";
import type { RetrieverInput, RetrieverResult } from "@/lib/retrieval/types";

type RagPipelineOptions = { topK?: number; packId?: KnowledgePackId; scenario?: AgentScenario | "ai-engineering" };
type RetrievalOptions = { preferredPackId?: KnowledgePackId; scenario?: AgentScenario | "ai-engineering"; topK?: number };

const DOMAIN_KEYWORDS = [
  "\u62a5\u9500", "\u5dee\u65c5", "\u53d1\u7968", "\u4ed8\u6b3e\u51ed\u8bc1", "\u5ba1\u6279", "\u8bf7\u5047", "\u5e74\u5047", "\u8c03\u4f11", "\u7535\u8111", "VPN", "\u8d26\u53f7\u6743\u9650", "\u6570\u636e\u5b89\u5168",
  "\u9000\u8d27", "\u9000\u6b3e", "\u552e\u540e", "7\u5929\u65e0\u7406\u7531", "\u4e03\u5929\u65e0\u7406\u7531", "\u62c6\u5c01", "\u7b7e\u6536", "\u6362\u8d27", "\u7269\u6d41", "\u5ba2\u670d", "\u5c3a\u7801", "\u5e93\u5b58", "\u8d28\u91cf\u95ee\u9898",
  "\u62db\u8058", "\u5c97\u4f4d", "JD", "\u7b80\u5386", "\u5339\u914d", "\u9762\u8bd5", "\u5019\u9009\u4eba", "\u8bc4\u5206",
  "AI", "RAG", "Agent", "Router", "Tool Calling", "\u5de5\u5177\u8c03\u7528", "\u7ed3\u6784\u5316\u8f93\u51fa", "JSON", "fallback", "JSON repair", "\u8bc4\u6d4b", "API Key", "Prompt", "\u77e5\u8bc6\u5e93", "\u68c0\u7d22", "\u5f15\u7528",
];

const BUSINESS_PHRASES = [
  "7\u5929\u65e0\u7406\u7531", "\u4e03\u5929\u65e0\u7406\u7531", "\u53d1\u7968\u4e22\u4e86", "\u4ed8\u6b3e\u51ed\u8bc1", "\u7535\u8111\u7533\u8bf7", "VPN \u6743\u9650", "API Key", "JSON repair", "\u7ed3\u6784\u5316\u8f93\u51fa", "Tool Calling", "Agent Router", "RAG \u5f15\u7528", "\u68c0\u7d22\u8d28\u91cf", "\u9ed8\u8ba4\u77e5\u8bc6\u5e93", "\u7528\u6237\u6587\u6863",
];

const SYNONYMS: Record<string, string[]> = {
  "\u9000\u8d27": ["\u9000\u6b3e", "\u552e\u540e", "7\u5929\u65e0\u7406\u7531", "\u4e03\u5929\u65e0\u7406\u7531", "\u4e0d\u559c\u6b22", "\u60f3\u9000"],
  "\u9000\u6b3e": ["\u9000\u8d27", "\u552e\u540e", "\u9000\u6b3e\u65f6\u6548"],
  "\u552e\u540e": ["\u9000\u8d27", "\u9000\u6b3e", "\u6362\u8d27", "\u8d28\u91cf\u95ee\u9898", "\u5ba2\u670d"],
  "\u62a5\u9500": ["\u53d1\u7968", "\u5dee\u65c5", "\u4ed8\u6b3e\u51ed\u8bc1", "\u5ba1\u6279"],
  "\u53d1\u7968": ["\u62a5\u9500", "\u7968\u636e", "\u4ed8\u6b3e\u51ed\u8bc1"],
  "\u8bf7\u5047": ["\u5e74\u5047", "\u75c5\u5047", "\u8c03\u4f11", "\u4f11\u5047"],
  "JD": ["\u5c97\u4f4d", "\u62db\u8058", "\u7b80\u5386", "\u5339\u914d", "\u9762\u8bd5"],
  "\u5c97\u4f4d": ["JD", "\u62db\u8058", "\u7b80\u5386", "\u5339\u914d"],
  "\u7b80\u5386": ["JD", "\u5c97\u4f4d", "\u5339\u914d", "\u9879\u76ee\u7ecf\u5386"],
  "RAG": ["\u77e5\u8bc6\u5e93", "\u68c0\u7d22", "\u5f15\u7528", "chunk", "\u6765\u6e90"],
  "Agent": ["Router", "\u5de5\u5177\u8c03\u7528", "Tool Calling", "Trace"],
  "JSON": ["\u7ed3\u6784\u5316\u8f93\u51fa", "Schema", "\u89e3\u6790", "repair", "\u4fee\u590d"],
  "fallback": ["\u515c\u5e95", "\u964d\u7ea7", "\u5f02\u5e38", "\u5931\u8d25", "\u8fb9\u754c"],
  "\u7535\u8111": ["\u8bbe\u5907", "\u7b14\u8bb0\u672c", "\u7535\u8111\u7533\u8bf7"],
  "VPN": ["\u8fdc\u7a0b\u529e\u516c", "\u8d26\u53f7\u6743\u9650", "\u6743\u9650\u7533\u8bf7"],
};

const STOP_WORDS = new Set(["\u4ec0\u4e48", "\u600e\u4e48", "\u9700\u8981", "\u53ef\u4ee5", "\u662f\u5426", "\u4e00\u4e2a", "\u8fd9\u4e2a", "\u90a3\u4e2a", "\u8bf7\u95ee", "\u76f8\u5173", "\u5982\u679c", "\u5e94\u8be5", "\u5982\u4f55", "\u5e2e\u6211", "\u4e00\u4e0b", "\u5417", "\u5462", "\u548b\u529e"]);

const LOW_CONFIDENCE_ANSWER = "\u6839\u636e\u5f53\u524d\u77e5\u8bc6\u5e93\u8d44\u6599\uff0c\u6211\u6ca1\u6709\u627e\u5230\u8db3\u591f\u76f8\u5173\u7684\u53ef\u9760\u4f9d\u636e\u3002\u5efa\u8bae\u8865\u5145\u66f4\u660e\u786e\u7684\u6587\u6863\u3001\u6362\u4e00\u79cd\u95ee\u6cd5\uff0c\u6216\u63d0\u4f9b\u4e1a\u52a1\u4e0a\u4e0b\u6587\u540e\u518d\u7ee7\u7eed\u5224\u65ad\u3002";
const RAG_ANSWER_PREFIX = "\u6839\u636e\u77e5\u8bc6\u5e93\u6765\u6e90\uff0c";

const scenarioPackMap: Partial<Record<AgentScenario | "ai-engineering", KnowledgePackId>> = {
  enterprise: "enterprise-policy",
  ecommerce: "ecommerce-support",
  recruitment: "recruitment-career",
  ai_engineering: "ai-engineering",
  "ai-engineering": "ai-engineering",
};

function unique(values: string[]) { return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))); }
function normalizeText(text: string) { return text.normalize("NFKC").toLowerCase().replace(/[\u3000-\u303f\uff00-\uffef,.!?;:()[\]{}<>"'~@#$%^&*_+=|\\/\r\n\t]/g, " ").replace(/\s+/g, " ").trim(); }
function includesNormalized(text: string, keyword: string) { return normalizeText(text).includes(normalizeText(keyword)); }

function sliceLongText(text: string, maxLength = 220) {
  const slices: string[] = [];
  let remaining = text.trim();
  while (remaining.length > maxLength) {
    const current = remaining.slice(0, maxLength);
    const breakIndex = Math.max(current.lastIndexOf("."), current.lastIndexOf(";"), current.lastIndexOf("!"), current.lastIndexOf("?"), current.lastIndexOf("\n"));
    const end = breakIndex > 80 ? breakIndex + 1 : maxLength;
    slices.push(remaining.slice(0, end).trim());
    remaining = remaining.slice(end).trim();
  }
  if (remaining) slices.push(remaining);
  return slices;
}

function extractBusinessPhrases(text: string) { return BUSINESS_PHRASES.filter((phrase) => includesNormalized(text, phrase)); }

function expandSynonyms(keywords: string[]) {
  const expanded = [...keywords];
  for (const keyword of keywords) {
    for (const [key, values] of Object.entries(SYNONYMS)) {
      const normalizedKeyword = normalizeText(keyword);
      if (normalizedKeyword === normalizeText(key) || values.some((value) => normalizeText(value) === normalizedKeyword)) expanded.push(key, ...values);
    }
  }
  return unique(expanded);
}

export function extractKeywords(text: string): string[] {
  const normalized = normalizeText(text);
  const domainMatches = DOMAIN_KEYWORDS.filter((keyword) => normalized.includes(normalizeText(keyword)));
  const phraseMatches = extractBusinessPhrases(text);
  const latinTokens = normalized.split(/\s+/).map((token) => token.trim()).filter((token) => token.length >= 2 && !STOP_WORDS.has(token));
  const chineseMatches = Array.from(text.matchAll(/[\u4e00-\u9fa5]{2,12}/g)).map((match) => match[0]).flatMap((token) => {
    if (token.length <= 4) return [token];
    const grams: string[] = [];
    for (let index = 0; index <= token.length - 2; index += 1) grams.push(token.slice(index, index + 2));
    return [token, ...grams];
  }).filter((token) => token.length >= 2 && !STOP_WORDS.has(token));
  return expandSynonyms(unique([...domainMatches, ...phraseMatches, ...latinTokens, ...chineseMatches])).slice(0, 64);
}

export function expandQuery(query: string, options: RetrievalOptions = {}): QueryExpansionResult {
  const keywords = extractKeywords(query).slice(0, 32);
  const phrases = extractBusinessPhrases(query);
  return { originalQuery: query, normalizedQuery: normalizeText(query), keywords, expandedKeywords: expandSynonyms([...keywords, ...phrases]).slice(0, 72), phrases, preferredPackId: options.preferredPackId, scenario: options.scenario };
}

export function splitDocument(document: KnowledgeDocument): KnowledgeChunk[] {
  const paragraphs = document.content.split(/\n+/).map((paragraph) => paragraph.trim()).filter(Boolean).flatMap((paragraph) => sliceLongText(paragraph));
  return paragraphs.map((content, index) => ({
    id: document.id + "-chunk-" + (index + 1),
    documentId: document.id,
    packId: document.packId,
    sourceTitle: document.title,
    category: document.category,
    tags: document.tags ?? [],
    sourceType: document.sourceType ?? (document.isDefault === false ? "user_paste" : "default"),
    originalFileName: document.originalFileName,
    chunkIndex: index + 1,
    content,
    keywords: extractKeywords(document.title + " " + document.category + " " + (document.tags ?? []).join(" ") + " " + (document.summary ?? "") + " " + content),
  }));
}

function countHits(values: string[], text: string) { return values.filter((keyword) => includesNormalized(text, keyword)).length; }
function freshnessScore(chunk: KnowledgeChunk) { return chunk.sourceType === "user_upload" || chunk.sourceType === "user_paste" ? 2 : 0.5; }

function buildScoreReason(breakdown: RagScoreBreakdown, matchedKeywords: string[], phrases: string[], preferredPackId?: KnowledgePackId, sourceType?: string) {
  const reasons: string[] = [];
  if (matchedKeywords.length) reasons.push("keyword hits " + matchedKeywords.length);
  if (breakdown.titleScore) reasons.push("title boost " + breakdown.titleScore);
  if (breakdown.tagScore) reasons.push("tag boost " + breakdown.tagScore);
  if (breakdown.categoryScore) reasons.push("category boost " + breakdown.categoryScore);
  if (breakdown.packScore) reasons.push("pack boost " + preferredPackId);
  if (breakdown.sourceScore) reasons.push("user document boost");
  if (breakdown.phraseScore) reasons.push("phrase hits " + phrases.length);
  if (breakdown.freshnessScore) reasons.push(sourceType === "default" ? "default freshness" : "user freshness");
  return reasons.length ? reasons : ["below semantic threshold"];
}

function selectDiverse(candidates: RetrievedChunk[], topK: number) {
  const selected: RetrievedChunk[] = [];
  const usedDocuments = new Set<string>();
  for (const item of candidates) {
    if (selected.length >= topK) break;
    if (!usedDocuments.has(item.chunk.documentId)) { selected.push(item); usedDocuments.add(item.chunk.documentId); }
  }
  for (const item of candidates) {
    if (selected.length >= topK) break;
    if (!selected.some((selectedItem) => selectedItem.chunk.id === item.chunk.id)) selected.push(item);
  }
  return selected;
}

function getConfidence(selected: RetrievedChunk[], candidateCount: number): Pick<RagRetrievalMetadata, "retrievalConfidence" | "lowConfidenceRetrieval" | "lowConfidenceReason" | "maxScore" | "averageScore"> {
  const scores = selected.map((item) => item.score);
  const maxScore = scores.length ? Math.max(...scores) : 0;
  const averageScore = scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0;
  let retrievalConfidence: RetrievalConfidence = "low";
  if (maxScore >= 20 && averageScore >= 10) retrievalConfidence = "high";
  else if (maxScore >= 10 && candidateCount > 0) retrievalConfidence = "medium";
  const lowConfidenceRetrieval = retrievalConfidence === "low";
  return { retrievalConfidence, lowConfidenceRetrieval, lowConfidenceReason: lowConfidenceRetrieval ? "No sufficiently relevant knowledge base chunks were found for this query." : undefined, maxScore, averageScore };
}

export function scoreHybridCandidates(query: string, chunks: KnowledgeChunk[], preferredPackId?: KnowledgePackId): RetrievedChunk[] {
  const queryExpansion = expandQuery(query, { preferredPackId });
  if (!query.trim() || queryExpansion.expandedKeywords.length === 0) return [];
  const candidates: Array<RetrievedChunk | null> = chunks.map((chunk) => {
    const titleText = chunk.sourceTitle;
    const categoryText = chunk.category;
    const tagsText = (chunk.tags ?? []).join(" ");
    const corpus = [chunk.content, titleText, categoryText, tagsText, chunk.packId ?? ""].join(" ");
    const matchedKeywords = queryExpansion.expandedKeywords.filter((keyword) => chunk.keywords.some((chunkKeyword) => normalizeText(chunkKeyword) === normalizeText(keyword)) || includesNormalized(corpus, keyword));
    const uniqueMatches = unique(matchedKeywords);
    const phraseHits = queryExpansion.phrases.filter((phrase) => includesNormalized(corpus, phrase));
    const titleHits = countHits(uniqueMatches, titleText);
    const categoryHits = countHits(uniqueMatches, categoryText);
    const tagHits = countHits(uniqueMatches, tagsText);
    const hasReliableSignal = uniqueMatches.length > 0 || titleHits > 0 || categoryHits > 0 || tagHits > 0 || phraseHits.length > 0;
    if (!hasReliableSignal) return null;
    const keywordScore = uniqueMatches.length * 2;
    const titleScore = titleHits * 4;
    const tagScore = tagHits * 3;
    const categoryScore = categoryHits * 2;
    const packScore = preferredPackId && chunk.packId === preferredPackId ? 5 : 0;
    const sourceScore = chunk.sourceType === "user_upload" || chunk.sourceType === "user_paste" ? 4 : 0;
    const phraseScore = phraseHits.length * 5;
    const freshScore = freshnessScore(chunk);
    const totalScore = keywordScore + titleScore + tagScore + categoryScore + packScore + sourceScore + phraseScore + freshScore;
    const scoreBreakdown: RagScoreBreakdown = { keywordScore, titleScore, tagScore, categoryScore, packScore, sourceScore, phraseScore, freshnessScore: freshScore, totalScore };
    return { chunk, score: Math.round(totalScore), matchedKeywords: uniqueMatches, scoreReason: buildScoreReason(scoreBreakdown, uniqueMatches, phraseHits, preferredPackId, chunk.sourceType), scoreBreakdown } satisfies RetrievedChunk;
  });
  return candidates.filter((item): item is RetrievedChunk => item !== null).sort((left, right) => right.score - left.score);
}

export function retrieveChunks(query: string, chunks: KnowledgeChunk[], topK = 3, preferredPackId?: KnowledgePackId): RetrievedChunk[] {
  const candidates = scoreHybridCandidates(query, chunks, preferredPackId);
  return selectDiverse(candidates, topK);
}

function buildSources(retrievedChunks: RetrievedChunk[]): RagAnswer["sources"] {
  const sourceMap = new Map<string, RagAnswer["sources"][number]>();
  for (const item of retrievedChunks) {
    const existing = sourceMap.get(item.chunk.documentId);
    if (existing) {
      existing.chunkIndexes = unique([...existing.chunkIndexes.map(String), String(item.chunk.chunkIndex)]).map(Number);
      existing.score = Math.max(existing.score ?? 0, item.score);
      existing.scoreReason = unique([...(existing.scoreReason ?? []), ...(item.scoreReason ?? [])]);
      existing.matchedKeywords = unique([...(existing.matchedKeywords ?? []), ...item.matchedKeywords]);
      if (!existing.scoreBreakdown || item.score > (existing.scoreBreakdown.totalScore ?? 0)) existing.scoreBreakdown = item.scoreBreakdown;
      continue;
    }
    sourceMap.set(item.chunk.documentId, { documentId: item.chunk.documentId, title: item.chunk.sourceTitle, category: item.chunk.category, packId: item.chunk.packId, sourceType: item.chunk.sourceType, tags: item.chunk.tags, score: item.score, scoreReason: item.scoreReason, scoreBreakdown: item.scoreBreakdown, matchedKeywords: item.matchedKeywords, contentPreview: item.chunk.content.slice(0, 260), chunkIndexes: [item.chunk.chunkIndex] });
  }
  return Array.from(sourceMap.values());
}

function filterReliableRetrievedChunks(retrievedChunks: RetrievedChunk[], metadata?: RagRetrievalMetadata) {
  const maxScore = metadata?.maxScore ?? (retrievedChunks.length ? Math.max(...retrievedChunks.map((item) => item.score)) : 0);
  if (maxScore < 10) return [];
  const threshold = Math.max(8, Math.round(maxScore * 0.6));
  return retrievedChunks.filter((item) => item.score >= threshold).slice(0, 4);
}

export function buildMetadata(query: string, selected: RetrievedChunk[], candidateCount: number, options: RetrievalOptions): RagRetrievalMetadata {
  const queryExpansion = expandQuery(query, options);
  const confidence = getConfidence(selected, candidateCount);
  return { query: queryExpansion, topK: options.topK ?? 3, candidateCount, selectedChunkCount: selected.length, ...confidence };
}


export function retrieveHybrid(input: RetrieverInput): RetrieverResult {
  const preferredPackId = (input.packId ?? (input.scenario ? scenarioPackMap[input.scenario] : undefined)) as KnowledgePackId | undefined;
  const chunks = input.documents.flatMap((document) => splitDocument(document));
  const topK = input.topK ?? 3;
  const candidates = scoreHybridCandidates(input.query, chunks, preferredPackId);
  const selected = selectDiverse(candidates, topK);
  const metadata = buildMetadata(input.query, selected, candidates.length, { topK, preferredPackId, scenario: input.scenario });
  return {
    chunks: selected,
    metadata: {
      ...metadata,
      retrieverMode: "hybrid",
      retrievalStrategy: "keyword + title/tag/category/pack/source/phrase/freshness hybrid scoring",
      vectorReady: false,
    },
    mode: "hybrid",
  };
}
export function generateMockRagAnswer(question: string, retrievedChunks: RetrievedChunk[], metadata?: RagRetrievalMetadata): RagAnswer {
  const createdAt = new Date().toISOString();
  const reliableChunks = filterReliableRetrievedChunks(retrievedChunks, metadata);
  const lowConfidence = metadata?.lowConfidenceRetrieval || reliableChunks.length === 0;
  if (lowConfidence) return { question, answer: LOW_CONFIDENCE_ANSWER, retrievedChunks, sources: buildSources(reliableChunks), mode: "mock-rag", createdAt, retrievalMetadata: metadata, retrievalConfidence: metadata?.retrievalConfidence ?? "low", lowConfidenceRetrieval: true, lowConfidenceReason: metadata?.lowConfidenceReason ?? "No sufficiently relevant chunks were found." };
  const evidence = reliableChunks.slice(0, 2).map((item) => item.chunk.content).join(" ");
  return { question, answer: RAG_ANSWER_PREFIX + evidence, retrievedChunks, sources: buildSources(reliableChunks), mode: "mock-rag", createdAt, retrievalMetadata: metadata, retrievalConfidence: metadata?.retrievalConfidence ?? "medium", lowConfidenceRetrieval: metadata?.lowConfidenceRetrieval ?? false, lowConfidenceReason: metadata?.lowConfidenceReason };
}

export function runMockRagPipeline(question: string, documents: KnowledgeDocument[], topKOrOptions: number | RagPipelineOptions = 3): RagAnswer {
  const options: RagPipelineOptions = typeof topKOrOptions === "number" ? { topK: topKOrOptions } : topKOrOptions;
  const preferredPackId = options.packId ?? (options.scenario ? scenarioPackMap[options.scenario] : undefined);
  const chunks = documents.flatMap((document) => splitDocument(document));
  const topK = options.topK ?? 3;
  const candidates = scoreHybridCandidates(question, chunks, preferredPackId);
  const retrievedChunks = selectDiverse(candidates, topK);
  const metadata = buildMetadata(question, retrievedChunks, candidates.length, { topK, preferredPackId, scenario: options.scenario });
  return generateMockRagAnswer(question, retrievedChunks, metadata);
}
