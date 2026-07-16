import { describe, expect, it } from "vitest";
import { estimateEvidenceTokens, estimateMessageTokens, estimateMessagesTokens, estimateTextTokens, estimateToolResultTokens } from "@/lib/conversation/token-estimator";

describe("context token estimator", () => {
  it("handles empty, English, CJK, mixed text, numbers, punctuation and JSON deterministically", () => {
    expect(estimateTextTokens("")).toBe(0);
    expect(estimateTextTokens("plain English text")).toBeGreaterThan(0);
    expect(estimateTextTokens("企业制度与报销流程")).toBeGreaterThanOrEqual(8);
    expect(estimateTextTokens("报销 expense 2026!")).toBeGreaterThan(estimateTextTokens("expense"));
    expect(estimateTextTokens('{"orderId":"EAH-10001","amount":123.45}')).toBeGreaterThan(0);
    expect(estimateTextTokens("稳定输入")).toBe(estimateTextTokens("稳定输入"));
  });

  it("estimates messages and context sections without invalid values", () => {
    const messages = [{ role: "user" as const, content: "第一条问题" }, { role: "assistant" as const, content: "第一条回答" }];
    expect(estimateMessageTokens(messages[0]!)).toBeGreaterThan(estimateTextTokens(messages[0]!.content));
    expect(estimateMessagesTokens(messages)).toBeGreaterThan(estimateMessageTokens(messages[0]!));
    expect(estimateEvidenceTokens([{ id: "source-1", sourceTitle: "制度", content: "报销需要发票" }])).toBeGreaterThan(0);
    expect(estimateToolResultTokens([{ tool: "queryOrder", status: "success", content: "订单已签收" }])).toBeGreaterThan(0);
  });

  it("remains finite and non-negative for long text", () => {
    const estimate = estimateTextTokens("中a1,".repeat(100_000));
    expect(Number.isFinite(estimate)).toBe(true);
    expect(estimate).toBeGreaterThan(0);
  });
});
