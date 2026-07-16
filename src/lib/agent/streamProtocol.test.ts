import { describe, expect, it, vi } from "vitest";
import { createNdjsonEventParser, isAgentStreamEvent, isConversationSummaryPatch, parseAgentStreamResponse, splitMockAnswer, streamMockAnswer } from "@/lib/agent/streamProtocol";
import type { AgentStreamEvent } from "@/types";

describe("agent NDJSON stream protocol", () => {
  it("parses an event split across chunks and multiple events in one chunk", () => {
    const events: AgentStreamEvent[] = [];
    const parser = createNdjsonEventParser((event) => events.push(event));
    parser.push('{"type":"phase","phase":"under');
    parser.push('stand"}\n{"type":"answer_delta","delta":"A","index":0}\n{"type":"phase","phase":"complete"}\n');
    parser.finish();
    expect(events.map((event) => event.type)).toEqual(["phase", "answer_delta", "phase"]);
  });

  it("reports invalid events without releasing them", () => {
    const events: AgentStreamEvent[] = [];
    const invalid = vi.fn();
    const parser = createNdjsonEventParser((event) => events.push(event), invalid);
    parser.push('{"type":"answer_delta","delta":"missing index"}\nnot-json\n');
    parser.push('{"type":"run_error","code":"raw_provider_error","message":"unsafe","retryable":true}\n');
    parser.push('{"type":"answer_completed","result":{"finalAnswer":"missing api and run id"},"streamingRequested":true,"streamingUsed":true,"streamFallback":false,"deltaCount":1}\n');
    parser.finish();
    expect(events).toEqual([]);
    expect(invalid).toHaveBeenCalledTimes(4);
  });

  it("rejects a response containing malformed protocol data", async () => {
    const response = new Response('{"type":"phase","phase":"generate"}\ninvalid\n', { status: 200 });
    await expect(parseAgentStreamResponse(response, () => undefined)).rejects.toThrow("invalid event");
  });

  it("accepts only bounded summary patches on completed events", () => {
    const set = { set: { text: "summary", throughMessageId: "a-4", updatedAt: "2026-07-16T00:00:00.000Z", version: 1, sourceMessageCount: 8 } };
    expect(isConversationSummaryPatch(set)).toBe(true);
    expect(isConversationSummaryPatch({ clear: true })).toBe(true);
    expect(isConversationSummaryPatch({ set: set.set, clear: true })).toBe(false);
    expect(isConversationSummaryPatch({})).toBe(false);
    expect(isConversationSummaryPatch({ set: { ...set.set, text: "x".repeat(8_001) } })).toBe(false);
    expect(isConversationSummaryPatch({ set: { ...set.set, throughMessageId: "a".repeat(129) } })).toBe(false);
    expect(isConversationSummaryPatch({ set: { ...set.set, version: 2 } })).toBe(false);
    expect(isConversationSummaryPatch({ set: { ...set.set, sourceMessageCount: -1 } })).toBe(false);
    expect(isConversationSummaryPatch({ set: { ...set.set, sourceMessageCount: 1.5 } })).toBe(false);
    expect(isConversationSummaryPatch({ set: { ...set.set, sourceMessageCount: Number.NaN } })).toBe(false);
    expect(isConversationSummaryPatch({ set: { ...set.set, sourceMessageCount: Number.POSITIVE_INFINITY } })).toBe(false);
    expect(isConversationSummaryPatch({ set: { ...set.set, trace: "unsafe" } })).toBe(false);

    const completed = { type: "answer_completed", result: { runId: "run-1", finalAnswer: "ok", api: {} }, streamingRequested: true, streamingUsed: true, streamFallback: false, deltaCount: 1, conversationSummaryPatch: set };
    expect(isAgentStreamEvent(completed)).toBe(true);
    expect(isAgentStreamEvent({ type: "answer_delta", delta: "x", index: 0, conversationSummaryPatch: set })).toBe(false);
    expect(isAgentStreamEvent({ ...completed, conversationSummaryPatch: { set: set.set, clear: true } })).toBe(false);
  });
});

describe("deterministic mock stream", () => {
  it("uses stable ordered chunks and avoids character-by-character output", async () => {
    const answer = "这是一个用于验证稳定分块顺序的较长模拟回答。".repeat(6);
    expect(splitMockAnswer(answer)).toEqual(splitMockAnswer(answer));
    expect(splitMockAnswer(answer).length).toBeGreaterThanOrEqual(6);
    const received: string[] = [];
    await streamMockAnswer(answer, (delta) => received.push(delta), { delayMs: 0 });
    expect(received.join("")).toBe(answer);
    expect(received.every((chunk) => Array.from(chunk).length > 1)).toBe(true);
  });

  it("stops emitting after abort", async () => {
    const controller = new AbortController();
    let emitted = 0;
    await expect(streamMockAnswer("可中止的模拟流式回答需要包含多个片段。".repeat(8), () => {
      emitted += 1;
      controller.abort();
    }, { delayMs: 0, signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
    expect(emitted).toBe(1);
  });
});
