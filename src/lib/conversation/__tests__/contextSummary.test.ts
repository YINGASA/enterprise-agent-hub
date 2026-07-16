import { describe, expect, it } from "vitest";
import { buildRollingSummary, PROTECTED_RECENT_TURN_COUNT, SUMMARY_TOKEN_BUDGET, validateConversationSummary } from "@/lib/conversation/context-summary";
import { estimateTextTokens } from "@/lib/conversation/token-estimator";

const turn = (index: number) => [
  { id: `u-${index}`, role: "user" as const, content: `订单 ORD-${index} 不要取消，日期 2026-07-${String(index).padStart(2, "0")}` },
  { id: `a-${index}`, role: "assistant" as const, content: `已确认订单 ORD-${index}，未完成退货检查。` },
];

describe("rolling conversation summary", () => {
  it("starts at eight complete turns and protects the latest four turns", () => {
    const messages = Array.from({ length: 8 }, (_, index) => turn(index + 1)).flat();
    const result = buildRollingSummary({ messages, now: "2026-07-16T00:00:00.000Z" });

    expect(result.updated).toBe(true);
    expect(result.patch && "set" in result.patch ? result.patch.set?.throughMessageId : undefined).toBe("a-4");
    expect(result.summary?.sourceMessageCount).toBe(8);
    expect(result.newlySummarizedTurnCount).toBe(4);
    expect(estimateTextTokens(result.summary?.text ?? "")).toBeLessThanOrEqual(SUMMARY_TOKEN_BUDGET);
    expect(validateConversationSummary(result.summary, messages, PROTECTED_RECENT_TURN_COUNT)).toMatchObject({ valid: true });
  });

  it("reuses a valid cursor without rebuilding when there are no newly eligible turns", () => {
    const messages = Array.from({ length: 8 }, (_, index) => turn(index + 1)).flat();
    const first = buildRollingSummary({ messages, now: "2026-07-16T00:00:00.000Z" });
    const second = buildRollingSummary({ messages, existingSummary: first.summary, now: "2026-07-16T00:01:00.000Z" });

    expect(second).toMatchObject({ summary: first.summary, usedExistingSummary: true, updated: false });
    expect(second.patch).toBeUndefined();
  });

  it("rejects unsafe cursors without exposing message text", () => {
    const messages = Array.from({ length: 8 }, (_, index) => turn(index + 1)).flat();
    const result = validateConversationSummary({ text: "old summary", throughMessageId: "u-1", version: 1, updatedAt: "2026-07-16T00:00:00.000Z", sourceMessageCount: 2 }, messages);

    expect(result).toEqual({ valid: false, reason: "cursor_not_assistant", coveredMessageCount: 0 });
    expect(JSON.stringify(result)).not.toContain(messages[0]?.content ?? "");
  });

  it("rejects a cursor whose source count does not match the covered complete turns", () => {
    const messages = Array.from({ length: 8 }, (_, index) => turn(index + 1)).flat();
    const result = validateConversationSummary({ text: "old summary", throughMessageId: "a-4", version: 1, updatedAt: "2026-07-16T00:00:00.000Z", sourceMessageCount: 6 }, messages);

    expect(result).toEqual({ valid: false, reason: "invalid_source_count", coveredMessageCount: 0 });
  });
});
