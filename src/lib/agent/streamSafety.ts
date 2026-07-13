import type { AgentApiMetadata, AgentApiResponse } from "@/types";

function sanitizeApi(api: AgentApiMetadata): AgentApiMetadata {
  return {
    requestedMode: api.requestedMode,
    responseMode: api.responseMode,
    fallbackReason: api.fallbackReason,
    errorType: api.errorType,
    httpStatus: api.httpStatus,
    llmDurationMs: api.llmDurationMs,
    contextApplied: api.contextApplied,
    contextMessageCount: api.contextMessageCount,
    contextTruncated: api.contextTruncated,
    contextCharacterCount: api.contextCharacterCount,
    streamingRequested: api.streamingRequested,
    streamingUsed: api.streamingUsed,
    streamFallback: api.streamFallback,
    aborted: api.aborted,
    streamDeltaCount: api.streamDeltaCount,
    requestAction: api.requestAction,
  };
}

/** Removes prompt inputs, retrieved bodies, raw tool data, and LLM diagnostics. */
export function sanitizeAgentStreamResult(result: AgentApiResponse): AgentApiResponse {
  return {
    ...result,
    steps: result.steps.map((step) => ({ ...step, input: {}, output: {} })),
    ragAnswer: result.ragAnswer
      ? {
          question: result.ragAnswer.question,
          answer: result.ragAnswer.answer,
          retrievedChunks: [],
          sources: result.ragAnswer.sources.map((source) => ({
            documentId: source.documentId,
            title: source.title,
            category: source.category,
            packId: source.packId,
            sourceType: source.sourceType,
            score: source.score,
            chunkIndexes: source.chunkIndexes,
          })),
          mode: result.ragAnswer.mode,
          createdAt: result.ragAnswer.createdAt,
          retrievalConfidence: result.ragAnswer.retrievalConfidence ?? result.ragAnswer.retrievalMetadata?.retrievalConfidence,
          lowConfidenceRetrieval: result.ragAnswer.lowConfidenceRetrieval ?? result.ragAnswer.retrievalMetadata?.lowConfidenceRetrieval,
          lowConfidenceReason: result.ragAnswer.lowConfidenceReason ?? result.ragAnswer.retrievalMetadata?.lowConfidenceReason,
        }
      : null,
    toolResults: result.toolResults.map((tool) => ({
      tool: tool.tool,
      status: tool.status,
      input: {},
      executedAt: tool.executedAt,
      ...(tool.error ? { error: "工具调用未成功。" } : {}),
    })),
    api: sanitizeApi(result.api),
  };
}
