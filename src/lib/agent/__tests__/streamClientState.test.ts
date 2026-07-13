import { describe, expect, it } from "vitest";
import { appendStreamAnswerDelta, appendStreamPhase, completeStreamAnswer, createStreamAnswerAccumulator, shouldStopStreamingRequest } from "@/lib/agent/streamClientState";
import type { AgentApiResponse, AgentStreamEvent } from "@/types";

function completedEvent(finalAnswer: string): Extract<AgentStreamEvent, { type: "answer_completed" }> {
  return {
    type: "answer_completed",
    result: { finalAnswer } as AgentApiResponse,
    streamingRequested: true,
    streamingUsed: true,
    streamFallback: false,
    deltaCount: 2,
  };
}

describe("stream client answer accumulation", () => {
  it("keeps answer deltas in arrival order", () => {
    let state = createStreamAnswerAccumulator();
    state = appendStreamAnswerDelta(state, { type: "answer_delta", delta: "第一段", index: 0 });
    state = appendStreamAnswerDelta(state, { type: "answer_delta", delta: "第二段", index: 1 });
    expect(state.answer).toBe("第一段第二段");
    expect(state.deltaCount).toBe(2);
  });

  it("does not append a repeated delta index twice", () => {
    const first = appendStreamAnswerDelta(createStreamAnswerAccumulator(), { type: "answer_delta", delta: "只显示一次", index: 0 });
    const repeated = appendStreamAnswerDelta(first, { type: "answer_delta", delta: "只显示一次", index: 0 });
    expect(repeated).toBe(first);
    expect(repeated.answer).toBe("只显示一次");
    expect(repeated.deltaCount).toBe(1);
  });

  it("uses the completed answer as the final source of truth", () => {
    const partial = appendStreamAnswerDelta(createStreamAnswerAccumulator(), { type: "answer_delta", delta: "半截", index: 0 });
    const completed = completeStreamAnswer(partial, completedEvent("经过服务端校准的完整回答"));
    expect(completed.answer).toBe("经过服务端校准的完整回答");
    expect(completed.deltaCount).toBe(2);
  });

  it("lets a completed event win over a late stop action", () => {
    expect(shouldStopStreamingRequest("request-1", null)).toBe(true);
    expect(shouldStopStreamingRequest("request-1", "request-1")).toBe(false);
    expect(shouldStopStreamingRequest(null, null)).toBe(false);
  });

  it("tracks only phases actually emitted and de-duplicates repeats", () => {
    const understood = appendStreamPhase([], "understand");
    const generating = appendStreamPhase(understood, "generate");
    const repeated = appendStreamPhase(generating, "generate");
    expect(repeated).toEqual(["understand", "generate"]);
    expect(repeated).toBe(generating);
    expect(repeated).not.toContain("retrieve");
    expect(repeated).not.toContain("tool");
  });
});
