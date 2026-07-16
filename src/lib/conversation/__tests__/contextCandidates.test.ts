import { describe, expect, it } from "vitest";
import { MAX_CONTEXT_CANDIDATES, toContextCandidates } from "@/lib/conversation/context-candidates";

describe("context candidates", () => {
  it("maps only the minimal persisted message fields and caps candidates at one hundred", () => {
    const messages = Array.from({ length: 101 }, (_, index) => ({ id: `m-${index}`, role: index % 2 ? "assistant" as const : "user" as const, content: `message-${index}`, createdAt: "2026-01-01T00:00:00.000Z", runId: "not-sent", details: { confidence: 1 } }));
    const result = toContextCandidates(messages);
    expect(result).toHaveLength(MAX_CONTEXT_CANDIDATES);
    expect(result[0]?.id).toBe("m-1");
    expect(result[0]).not.toHaveProperty("details");
    expect(result[0]).not.toHaveProperty("runId");
  });
});
