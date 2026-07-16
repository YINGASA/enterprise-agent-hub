import { describe, expect, it } from "vitest";
import { MAX_CONTEXT_CANDIDATES, toContextCandidates, toConversationSummaryDto } from "@/lib/conversation/context-candidates";

describe("context candidates", () => {
  it("maps only the minimal persisted message fields and caps candidates at one hundred", () => {
    const messages = Array.from({ length: 101 }, (_, index) => ({ id: `m-${index}`, role: index % 2 ? "assistant" as const : "user" as const, content: `message-${index}`, createdAt: "2026-01-01T00:00:00.000Z", runId: "not-sent", details: { confidence: 1 } }));
    const result = toContextCandidates(messages);
    expect(result).toHaveLength(MAX_CONTEXT_CANDIDATES);
    expect(result[0]?.id).toBe("m-1");
    expect(result[0]).not.toHaveProperty("details");
    expect(result[0]).not.toHaveProperty("runId");
  });

  it("sends only a valid summary DTO for the matching history prefix", () => {
    const messages = Array.from({ length: 8 }, (_, index) => [
      { id: `u-${index + 1}`, role: "user" as const, content: `question-${index + 1}`, createdAt: "2026-01-01T00:00:00.000Z" },
      { id: `a-${index + 1}`, role: "assistant" as const, content: `answer-${index + 1}`, createdAt: "2026-01-01T00:00:01.000Z" },
    ]).flat();
    const summary = { text: "summary", throughMessageId: "a-4", updatedAt: "2026-07-16T00:00:00.000Z", version: 1 as const, sourceMessageCount: 8 };
    expect(toConversationSummaryDto(summary, messages)).toEqual({ text: "summary", throughMessageId: "a-4", version: 1, sourceMessageCount: 8 });
    expect(toConversationSummaryDto({ ...summary, throughMessageId: "a-8" }, messages)).toBeUndefined();
  });
});
