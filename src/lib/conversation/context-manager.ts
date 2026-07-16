import { DEFAULT_CONTEXT_BUDGET, calculateContextSectionUsage, evaluateContextBudget, resolveContextBudgetConfig, type ContextBudgetResult } from "@/lib/conversation/context-budget";
import { createContextTrace } from "@/lib/conversation/context-trace";
import { estimateEvidenceTokens, estimateMessageTokens, estimateMessagesTokens, estimateTextTokens, estimateToolResultTokens } from "@/lib/conversation/token-estimator";
import type { ContextBudgetConfig, ContextEvidence, ContextMessage, ContextSectionUsage, ContextStrategy, ContextToolResult, ContextTrace, ContextTruncationReason } from "@/types";

export type BuildContextPlanInput = {
  systemInstructions?: string;
  currentUserMessage: string;
  recentMessages?: readonly ContextMessage[];
  selectedHistory?: readonly ContextMessage[];
  conversationSummary?: string;
  ragEvidence?: readonly ContextEvidence[];
  toolResults?: readonly ContextToolResult[];
  budget?: Partial<ContextBudgetConfig>;
};

export type ContextPlanSections = {
  systemInstructions?: string;
  currentUserMessage: string;
  recentMessages: ContextMessage[];
  selectedHistory: ContextMessage[];
  conversationSummary?: string;
  ragEvidence: ContextEvidence[];
  toolResults: ContextToolResult[];
};

export type ContextPlan = {
  ok: boolean;
  strategy: ContextStrategy;
  sections: ContextPlanSections;
  estimate: ContextSectionUsage;
  budget: ContextBudgetResult;
  trace: ContextTrace;
  failureReason?: "priority_sections_exceed_budget";
};

function cloneMessages(messages: readonly ContextMessage[] = []) {
  return messages.map((message) => ({ role: message.role, content: message.content }));
}

function cloneEvidence(items: readonly ContextEvidence[] = []) {
  return items.map((item) => ({ id: item.id, sourceTitle: item.sourceTitle, content: item.content }));
}

function cloneTools(items: readonly ContextToolResult[] = []) {
  return items.map((item) => ({ tool: item.tool, status: item.status, content: item.content }));
}

function estimateSections(sections: ContextPlanSections): ContextSectionUsage {
  return calculateContextSectionUsage({
    systemInstructions: estimateTextTokens(sections.systemInstructions ?? ""),
    currentUserMessage: estimateTextTokens(sections.currentUserMessage),
    recentMessages: estimateMessagesTokens(sections.recentMessages),
    selectedHistory: estimateMessagesTokens(sections.selectedHistory),
    conversationSummary: estimateTextTokens(sections.conversationSummary ?? ""),
    ragEvidence: estimateEvidenceTokens(sections.ragEvidence),
    toolResults: estimateToolResultTokens(sections.toolResults),
  });
}

function softLimitExceeded(usage: ContextSectionUsage, config: ContextBudgetConfig) {
  return usage.systemInstructions > config.systemInstructionsTokens ||
    usage.currentUserMessage > config.currentUserMessageTokens ||
    usage.recentMessages > config.recentMessagesTokens ||
    usage.selectedHistory > config.selectedHistoryTokens ||
    usage.conversationSummary > config.conversationSummaryTokens ||
    usage.ragEvidence > config.ragEvidenceTokens ||
    usage.toolResults > config.toolResultsTokens;
}

function truncationReasonFor(sections: ContextPlanSections, config: ContextBudgetConfig, budget: ContextBudgetResult): ContextTruncationReason {
  if (!budget.exceedsUsableSectionBudget && !softLimitExceeded(budget.usage, config)) return "none";
  if (sections.toolResults.length) return "tool_results";
  if (sections.ragEvidence.length) return "rag_evidence";
  if (sections.selectedHistory.length) return "selected_history";
  if (sections.recentMessages.length) return "recent_messages";
  return budget.truncationReason;
}

/**
 * Builds an immutable, deterministic context plan. The foundation deliberately
 * does not generate or consume summaries, select history, call APIs, or touch
 * browser storage; callers may supply section candidates for budget testing.
 */
export function buildContextPlan(input: BuildContextPlanInput): ContextPlan {
  const config = resolveContextBudgetConfig({ ...DEFAULT_CONTEXT_BUDGET, ...input.budget });
  const sections: ContextPlanSections = {
    systemInstructions: input.systemInstructions,
    currentUserMessage: input.currentUserMessage,
    recentMessages: cloneMessages(input.recentMessages),
    selectedHistory: cloneMessages(input.selectedHistory),
    conversationSummary: input.conversationSummary?.trim() || undefined,
    ragEvidence: cloneEvidence(input.ragEvidence),
    toolResults: cloneTools(input.toolResults),
  };
  const originalMessageCount = sections.recentMessages.length + sections.selectedHistory.length;
  const strategy: ContextStrategy = sections.conversationSummary ? (sections.selectedHistory.length ? "summary_selective" : "summary_recent") : (sections.selectedHistory.length ? "recent_selective" : "recent_only");
  const priorityUsage = estimateSections({ ...sections, conversationSummary: undefined, recentMessages: [], selectedHistory: [], ragEvidence: [], toolResults: [] });
  const priorityBudget = evaluateContextBudget(priorityUsage, config);
  if (priorityBudget.exceedsUsableSectionBudget || priorityUsage.systemInstructions > config.systemInstructionsTokens || priorityUsage.currentUserMessage > config.currentUserMessageTokens) {
    const trace = createContextTrace({ contextStrategy: strategy, totalInputEstimate: priorityUsage.totalInputEstimate, budgetLimit: config.maximumInputTokens, summaryUsed: false, summaryMessageCount: 0, recentMessageCount: 0, selectedHistoryCount: 0, droppedMessageCount: originalMessageCount, ragIncluded: false, toolResultsIncluded: false, truncationReason: "priority_sections_exceed_budget" });
    return { ok: false, strategy, sections, estimate: priorityUsage, budget: priorityBudget, trace, failureReason: "priority_sections_exceed_budget" };
  }

  let estimate = estimateSections(sections);
  let budget = evaluateContextBudget(estimate, config);
  let truncationReason = truncationReasonFor(sections, config, budget);
  let firstTruncationReason: ContextTruncationReason = "none";
  while (truncationReason !== "none") {
    if (firstTruncationReason === "none") firstTruncationReason = truncationReason;
    if (sections.toolResults.length) sections.toolResults.pop();
    else if (sections.ragEvidence.length) sections.ragEvidence.pop();
    else if (sections.selectedHistory.length) sections.selectedHistory.shift();
    else if (sections.conversationSummary) sections.conversationSummary = undefined;
    else if (sections.recentMessages.length) sections.recentMessages.shift();
    else break;
    estimate = estimateSections(sections);
    budget = evaluateContextBudget(estimate, config);
    truncationReason = truncationReasonFor(sections, config, budget);
  }

  const droppedMessageCount = originalMessageCount - sections.recentMessages.length - sections.selectedHistory.length;
  const finalReason = firstTruncationReason;
  const finalStrategy: ContextStrategy = sections.conversationSummary ? (sections.selectedHistory.length ? "summary_selective" : "summary_recent") : (sections.selectedHistory.length ? "recent_selective" : "recent_only");
  const trace = createContextTrace({ contextStrategy: finalStrategy, totalInputEstimate: estimate.totalInputEstimate, budgetLimit: config.maximumInputTokens, summaryUsed: Boolean(sections.conversationSummary), summaryMessageCount: sections.conversationSummary ? 1 : 0, recentMessageCount: sections.recentMessages.length, selectedHistoryCount: sections.selectedHistory.length, droppedMessageCount, ragIncluded: sections.ragEvidence.length > 0, toolResultsIncluded: sections.toolResults.length > 0, truncationReason: finalReason });
  return { ok: true, strategy: finalStrategy, sections, estimate, budget, trace };
}
