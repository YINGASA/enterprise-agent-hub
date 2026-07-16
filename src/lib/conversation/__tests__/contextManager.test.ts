import { describe, expect, it } from "vitest";
import { buildContextPlan } from "@/lib/conversation/context-manager";

const message = (role: "user" | "assistant", content: string) => ({ role, content });

describe("context manager foundation", () => {
  it("builds a complete recent_only plan without mutating its input", () => {
    const input = {
      systemInstructions: "遵守企业制度。",
      currentUserMessage: "报销需要什么材料？",
      recentMessages: [message("user", "我想报销"), message("assistant", "请补充费用类型")],
      selectedHistory: [message("user", "去年差旅报销")],
      ragEvidence: [{ id: "r1", sourceTitle: "报销制度", content: "需要发票" }],
      toolResults: [{ tool: "queryOrder", status: "success" as const, content: "无关订单" }],
    };
    const before = JSON.stringify(input);
    const plan = buildContextPlan(input);
    expect(plan.ok).toBe(true);
    expect(plan.strategy).toBe("recent_selective");
    expect(plan.sections.recentMessages).toEqual(input.recentMessages);
    expect(plan.sections.selectedHistory).toEqual(input.selectedHistory);
    expect(JSON.stringify(input)).toBe(before);
    expect(plan.sections.recentMessages).not.toBe(input.recentMessages);
    expect(plan.trace).not.toHaveProperty("currentUserMessage");
    expect(JSON.stringify(plan.trace)).not.toContain(input.currentUserMessage);
  });

  it("trims in tool, RAG, selected history, then oldest recent-message order", () => {
    const plan = buildContextPlan({
      currentUserMessage: "当前问题",
      recentMessages: [message("user", "recent-old ".repeat(40)), message("assistant", "recent-new ".repeat(40))],
      selectedHistory: [message("user", "selected ".repeat(100))],
      ragEvidence: [{ content: "rag ".repeat(100) }],
      toolResults: [{ tool: "tool", status: "success", content: "tool ".repeat(100) }],
      budget: { maximumInputTokens: 300, modelContextTokens: 1_600, reservedOutputTokens: 1_200, safetyMarginTokens: 10, systemInstructionsTokens: 0, currentUserMessageTokens: 20, recentMessagesTokens: 244, selectedHistoryTokens: 10, conversationSummaryTokens: 0, ragEvidenceTokens: 8, toolResultsTokens: 8 },
    });
    expect(plan.ok).toBe(true);
    expect(plan.sections.toolResults).toEqual([]);
    expect(plan.sections.ragEvidence).toEqual([]);
    expect(plan.sections.selectedHistory).toEqual([]);
    expect(plan.sections.recentMessages).toHaveLength(1);
    expect(plan.sections.recentMessages[0]?.content).toContain("recent-new");
    expect(plan.trace.truncationReason).toBe("tool_results");
  });

  it("does not delete priority sections when they exceed the hard limit", () => {
    const plan = buildContextPlan({ currentUserMessage: "question ".repeat(500), systemInstructions: "system ".repeat(500), budget: { maximumInputTokens: 100, modelContextTokens: 1_400, reservedOutputTokens: 1_200, safetyMarginTokens: 0, systemInstructionsTokens: 50, currentUserMessageTokens: 50, recentMessagesTokens: 0, selectedHistoryTokens: 0, conversationSummaryTokens: 0, ragEvidenceTokens: 0, toolResultsTokens: 0 } });
    expect(plan.ok).toBe(false);
    expect(plan.failureReason).toBe("priority_sections_exceed_budget");
    expect(plan.sections.currentUserMessage).toContain("question");
    expect(plan.sections.systemInstructions).toContain("system");
  });

  it("is deterministic and exposes safe count and budget trace fields", () => {
    const input = { currentUserMessage: "当前问题", recentMessages: [message("user", "历史问题")] };
    const first = buildContextPlan(input);
    const second = buildContextPlan(input);
    expect(first).toEqual(second);
    expect(first.trace).toMatchObject({ budgetLimit: 6_800, recentMessageCount: 1, selectedHistoryCount: 0, summaryUsed: false, ragIncluded: false, toolResultsIncluded: false });
    expect(Object.values(first.trace).every((value) => typeof value !== "string" || ["recent_only", "none"].includes(value))).toBe(true);
  });

  it("uses the summary section and downgrades strategy if its budget is exhausted", () => {
    const withSummary = buildContextPlan({ currentUserMessage: "question", conversationSummary: "older conversation facts", selectedHistory: [message("user", "related history")] });
    expect(withSummary.strategy).toBe("summary_selective");
    expect(withSummary.trace).toMatchObject({ summaryUsed: true, summaryMessageCount: 1 });

    const removedSummary = buildContextPlan({
      currentUserMessage: "question",
      conversationSummary: "summary ".repeat(50),
      budget: { maximumInputTokens: 40, modelContextTokens: 1_240, reservedOutputTokens: 1_200, safetyMarginTokens: 0, systemInstructionsTokens: 0, currentUserMessageTokens: 20, recentMessagesTokens: 20, selectedHistoryTokens: 0, conversationSummaryTokens: 0, ragEvidenceTokens: 0, toolResultsTokens: 0 },
    });
    expect(removedSummary.sections.conversationSummary).toBeUndefined();
    expect(removedSummary.strategy).toBe("recent_only");
  });
});
