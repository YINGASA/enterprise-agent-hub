import { describe, expect, it, vi } from "vitest";
import { createNdjsonEventParser, parseAgentStreamResponse, splitMockAnswer, streamMockAnswer } from "@/lib/agent/streamProtocol";
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
