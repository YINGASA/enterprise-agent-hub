import { splitDocument } from "@/lib/rag";
import type { KnowledgeChunk, KnowledgeDocument } from "@/types";

export type KnowledgeQualityLevel = "excellent" | "usable" | "needs_improvement";

export type KnowledgeQualityAssessment = {
  score: number;
  level: KnowledgeQualityLevel;
  label: "优秀" | "可用" | "需补充";
  dimensions: {
    content: number;
    tags: number;
    testQuestions: number;
    chunks: number;
    ragEnabled: number;
  };
  issues: string[];
};

export type ChunkQualityDiagnostic = {
  chunkId: string;
  characterCount: number;
  status: "good" | "warning";
  issues: string[];
};

export type DuplicateKnowledgeMatch = {
  documentId: string;
  title: string;
  similarity: number;
  reasons: string[];
};

function normalize(value: string) {
  return value.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
}

function grams(value: string, size = 2) {
  const normalized = normalize(value);
  if (!normalized) return new Set<string>();
  if (normalized.length <= size) return new Set([normalized]);
  const result = new Set<string>();
  for (let index = 0; index <= normalized.length - size; index += 1) {
    result.add(normalized.slice(index, index + size));
  }
  return result;
}

function jaccard(left: string, right: string) {
  const leftSet = grams(left);
  const rightSet = grams(right);
  if (!leftSet.size || !rightSet.size) return 0;
  let intersection = 0;
  leftSet.forEach((value) => {
    if (rightSet.has(value)) intersection += 1;
  });
  return intersection / (leftSet.size + rightSet.size - intersection);
}

function isEnabled(document: KnowledgeDocument) {
  return document.sourceType === "default" || document.enabled !== false;
}

export function assessKnowledgeDocument(document: KnowledgeDocument): KnowledgeQualityAssessment {
  const contentLength = document.content.trim().length;
  const tagCount = document.tags?.length ?? 0;
  const questionCount = document.suggestedQuestions?.length ?? (document.sourceType === "default" ? 2 : 0);
  const chunkCount = splitDocument(document).length;
  const content = contentLength >= 500 ? 30 : contentLength >= 200 ? 23 : contentLength >= 100 ? 15 : 7;
  const tags = tagCount >= 3 ? 20 : tagCount === 2 ? 15 : tagCount === 1 ? 8 : 0;
  const testQuestions = questionCount >= 2 ? 20 : questionCount === 1 ? 12 : 0;
  const chunks = chunkCount >= 2 && chunkCount <= 12 ? 20 : chunkCount === 1 || chunkCount <= 20 ? 12 : 6;
  const ragEnabled = isEnabled(document) ? 10 : 0;
  const score = content + tags + testQuestions + chunks + ragEnabled;
  const issues: string[] = [];

  if (contentLength < 200) issues.push("正文信息偏少，建议补充适用范围、操作流程、例外和边界。");
  if (tagCount < 2) issues.push("标签不足，建议补充至少 2 个稳定业务关键词。");
  if (questionCount < 1) issues.push("缺少建议测试问题，难以快速验证 RAG 是否命中。");
  if (chunkCount < 2) issues.push("仅生成 1 个 chunk，建议补充更多可独立检索的业务信息。");
  if (chunkCount > 20) issues.push("chunk 数量较多，建议拆分为主题更集中的多份文档。");
  if (!isEnabled(document)) issues.push("当前未启用参与 RAG，保存后不会被聊天工作台检索。");

  if (score >= 85) return { score, level: "excellent", label: "优秀", dimensions: { content, tags, testQuestions, chunks, ragEnabled }, issues };
  if (score >= 60) return { score, level: "usable", label: "可用", dimensions: { content, tags, testQuestions, chunks, ragEnabled }, issues };
  return { score, level: "needs_improvement", label: "需补充", dimensions: { content, tags, testQuestions, chunks, ragEnabled }, issues };
}

export function diagnoseKnowledgeChunks(chunks: KnowledgeChunk[]): ChunkQualityDiagnostic[] {
  return chunks.map((chunk, index) => {
    const issues: string[] = [];
    const characterCount = chunk.content.trim().length;
    if (characterCount < 80) issues.push("内容偏短，可能缺少独立检索价值。");
    if (characterCount > 600) issues.push("内容偏长，建议拆分为更聚焦的段落。");
    if (chunk.keywords.length < 3) issues.push("有效关键词较少，建议补充具体业务名词。");

    const duplicate = chunks.slice(0, index).find((candidate) => jaccard(candidate.content, chunk.content) >= 0.82);
    if (duplicate) issues.push(`与 chunk #${duplicate.chunkIndex} 内容高度相似。`);

    return {
      chunkId: chunk.id,
      characterCount,
      status: issues.length ? "warning" : "good",
      issues,
    };
  });
}

export function findDuplicateKnowledgeDocuments(
  candidate: Pick<KnowledgeDocument, "title" | "content">,
  documents: KnowledgeDocument[],
): DuplicateKnowledgeMatch[] {
  const normalizedTitle = normalize(candidate.title);
  return documents
    .map((document) => {
      const titleSimilarity = jaccard(candidate.title, document.title);
      const contentSimilarity = jaccard(candidate.content, document.content);
      const exactTitle = Boolean(normalizedTitle && normalizedTitle === normalize(document.title));
      const reasons: string[] = [];
      if (exactTitle) reasons.push("标题相同");
      else if (titleSimilarity >= 0.72) reasons.push("标题高度相似");
      if (contentSimilarity >= 0.68) reasons.push("正文高度相似");
      return {
        documentId: document.id,
        title: document.title,
        similarity: Math.round(Math.max(exactTitle ? 1 : titleSimilarity, contentSimilarity) * 100),
        reasons,
      };
    })
    .filter((item) => item.reasons.length > 0)
    .sort((left, right) => right.similarity - left.similarity)
    .slice(0, 3);
}
