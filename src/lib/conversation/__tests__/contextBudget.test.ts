import { describe, expect, it } from "vitest";
import { DEFAULT_CONTEXT_BUDGET, calculateContextSectionUsage, evaluateContextBudget, resolveContextBudgetConfig, validateContextBudgetConfig } from "@/lib/conversation/context-budget";

describe("context budget", () => {
  it("uses the closed V2.1.0 default budget baseline", () => {
    const validation = validateContextBudgetConfig(DEFAULT_CONTEXT_BUDGET);
    expect(validation.ok).toBe(true);
    if (!validation.ok) return;
    expect(DEFAULT_CONTEXT_BUDGET.maximumInputTokens).toBe(6_800);
    expect(validation.usableSectionTokens).toBe(6_300);
    expect(DEFAULT_CONTEXT_BUDGET.systemInstructionsTokens + DEFAULT_CONTEXT_BUDGET.currentUserMessageTokens + DEFAULT_CONTEXT_BUDGET.recentMessagesTokens + DEFAULT_CONTEXT_BUDGET.selectedHistoryTokens + DEFAULT_CONTEXT_BUDGET.conversationSummaryTokens + DEFAULT_CONTEXT_BUDGET.ragEvidenceTokens + DEFAULT_CONTEXT_BUDGET.toolResultsTokens + DEFAULT_CONTEXT_BUDGET.safetyMarginTokens).toBe(6_800);
  });

  it("rejects invalid token values and impossible windows", () => {
    expect(validateContextBudgetConfig({ ...DEFAULT_CONTEXT_BUDGET, toolResultsTokens: -1 }).ok).toBe(false);
    expect(validateContextBudgetConfig({ ...DEFAULT_CONTEXT_BUDGET, toolResultsTokens: Number.NaN }).ok).toBe(false);
    expect(validateContextBudgetConfig({ ...DEFAULT_CONTEXT_BUDGET, toolResultsTokens: Number.POSITIVE_INFINITY }).ok).toBe(false);
    expect(validateContextBudgetConfig({ ...DEFAULT_CONTEXT_BUDGET, reservedOutputTokens: 8_192 }).ok).toBe(false);
    expect(validateContextBudgetConfig({ ...DEFAULT_CONTEXT_BUDGET, recentMessagesTokens: 1_701 }).ok).toBe(false);
    expect(() => resolveContextBudgetConfig({ safetyMarginTokens: 6_800 })).toThrow(/Invalid context budget configuration/);
  });

  it("calculates remaining budget and identifies a global overage", () => {
    const usage = calculateContextSectionUsage({ systemInstructions: 1_100, currentUserMessage: 900, recentMessages: 1_700, selectedHistory: 800, conversationSummary: 700, ragEvidence: 800, toolResults: 300 });
    const result = evaluateContextBudget(usage);
    expect(result.remainingTokens).toBe(500);
    expect(result.remainingSectionTokens).toBe(0);
    expect(result.exceedsMaximumInput).toBe(false);
    expect(result.exceedsUsableSectionBudget).toBe(false);

    const over = evaluateContextBudget({ ...usage, toolResults: 1_000, totalInputEstimate: 0 });
    expect(over.exceedsMaximumInput).toBe(true);
    expect(over.truncationReason).toBe("priority_sections_exceed_budget");
  });
});
