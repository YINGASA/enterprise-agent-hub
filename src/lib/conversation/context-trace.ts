import type { ContextStrategy, ContextTrace, ContextTruncationReason } from "@/types";

type ContextTraceInput = Partial<ContextTrace> & Record<string, unknown>;

const strategies = new Set<ContextStrategy>(["recent_only", "recent_selective", "summary_recent", "summary_selective"]);
const reasons = new Set<ContextTruncationReason>(["none", "tool_results", "rag_evidence", "selected_history", "recent_messages", "priority_sections_exceed_budget", "safety_margin_exceeded"]);

function safeCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

/**
 * Produces a scalar-only trace. Unknown fields, including any text payloads,
 * are intentionally discarded so callers cannot accidentally persist context
 * bodies, prompts, RAG chunks, tool output, or credentials.
 */
export function createContextTrace(input: ContextTraceInput): ContextTrace {
  return {
    contextStrategy: typeof input.contextStrategy === "string" && strategies.has(input.contextStrategy as ContextStrategy) ? input.contextStrategy as ContextStrategy : "recent_only",
    totalInputEstimate: safeCount(input.totalInputEstimate),
    budgetLimit: safeCount(input.budgetLimit),
    summaryUsed: input.summaryUsed === true,
    summaryMessageCount: safeCount(input.summaryMessageCount),
    recentMessageCount: safeCount(input.recentMessageCount),
    selectedHistoryCount: safeCount(input.selectedHistoryCount),
    droppedMessageCount: safeCount(input.droppedMessageCount),
    ragIncluded: input.ragIncluded === true,
    toolResultsIncluded: input.toolResultsIncluded === true,
    truncationReason: typeof input.truncationReason === "string" && reasons.has(input.truncationReason as ContextTruncationReason) ? input.truncationReason as ContextTruncationReason : "none",
    candidateMessageCount: safeCount(input.candidateMessageCount),
    selectedTurnCount: safeCount(input.selectedTurnCount),
  };
}
