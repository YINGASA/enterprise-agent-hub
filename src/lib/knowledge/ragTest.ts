import { buildClarificationState, routeUserQuestion } from "@/lib/agent";
import { createRetriever } from "@/lib/retrieval";
import type { KnowledgeDocument, RagTestDiagnostic, RetrievalConfidence, RetrievedChunk } from "@/types";

function isEnabled(document: KnowledgeDocument) {
  return document.sourceType === "default" || document.enabled !== false;
}

function sourceConfidence(item: RetrievedChunk): RetrievalConfidence {
  if (item.score >= 20) return "high";
  if (item.score >= 10) return "medium";
  return "low";
}

function currentDocumentMissReason(params: {
  document?: KnowledgeDocument;
  diagnostic: Pick<RagTestDiagnostic, "needsClarification" | "sources" | "candidateCount">;
}) {
  const { document, diagnostic } = params;
  if (!document) return undefined;
  if (!isEnabled(document)) return "当前文档已禁用，不参与 RAG 检索。";
  if (diagnostic.needsClarification) return "该问题需要先补充业务信息，当前未执行可靠检索。";
  if (diagnostic.candidateCount === 0) return "问题与文档标题、标签、分类或正文关键词没有形成有效匹配。";
  if (diagnostic.sources.length > 0) return "有其他文档的相关度更高，当前文档未进入 Top sources。";
  return "当前文档的 chunk 信息不足，未形成可靠来源。";
}

export function runRagTestDiagnostic(question: string, documents: KnowledgeDocument[], currentDocumentId?: string): RagTestDiagnostic {
  const normalizedQuestion = question.trim();
  const route = routeUserQuestion(normalizedQuestion);
  const clarification = buildClarificationState(route, normalizedQuestion);
  const enabledDocuments = documents.filter(isEnabled);
  const needsClarification = Boolean(clarification.needsClarification);
  const shouldSkipRetrieval = !route.needRag || (route.scenario === "enterprise" && route.intent === "knowledge_qa" && needsClarification);
  const retrieval = shouldSkipRetrieval
    ? null
    : createRetriever("auto").retrieve({ query: normalizedQuestion, documents: enabledDocuments, scenario: route.scenario, topK: 4 });
  const rawSources = retrieval?.chunks ?? [];
  const reliableSources = retrieval?.metadata.lowConfidenceRetrieval ? [] : rawSources;
  const sources = reliableSources.map((item) => ({
    sourceId: `${item.chunk.documentId}:${item.chunk.id}`,
    documentId: item.chunk.documentId,
    title: item.chunk.sourceTitle,
    sourceType: item.chunk.sourceType ?? "default",
    chunkIndex: item.chunk.chunkIndex,
    score: item.score,
    confidence: sourceConfidence(item),
    matchedSignals: item.matchedKeywords,
    scoreReason: item.scoreReason ?? [],
    contentPreview: item.chunk.content.slice(0, 260),
    isUserDocument: item.chunk.sourceType === "user_upload" || item.chunk.sourceType === "user_paste",
  }));
  const currentSourceIndex = currentDocumentId ? sources.findIndex((source) => source.documentId === currentDocumentId) : -1;
  const currentDocument = currentDocumentId ? documents.find((document) => document.id === currentDocumentId) : undefined;
  const base = {
    question: normalizedQuestion,
    route,
    needsClarification,
    clarificationQuestion: clarification.clarificationQuestion,
    candidateCount: retrieval?.metadata.candidateCount ?? 0,
    reliableSourceCount: sources.length,
    retrievalConfidence: retrieval?.metadata.retrievalConfidence ?? "low",
    fallback: !route.needRag || needsClarification || Boolean(retrieval?.metadata.lowConfidenceRetrieval),
    lowConfidenceReason: retrieval?.metadata.lowConfidenceReason,
    sources,
    hitUserDocument: sources.some((source) => source.isUserDocument),
    currentDocumentId,
    hitCurrentDocument: currentDocumentId ? currentSourceIndex >= 0 : undefined,
    currentDocumentIsTopSource: currentDocumentId ? currentSourceIndex === 0 : undefined,
    currentDocumentChunkIndex: currentSourceIndex >= 0 ? sources[currentSourceIndex]?.chunkIndex : undefined,
  } satisfies Omit<RagTestDiagnostic, "currentDocumentMissReason">;

  return {
    ...base,
    currentDocumentMissReason: currentDocumentId && currentSourceIndex < 0 ? currentDocumentMissReason({ document: currentDocument, diagnostic: base }) : undefined,
  };
}
