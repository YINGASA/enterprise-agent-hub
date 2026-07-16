import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentApiResponse, AgentStreamEvent } from "@/types";

const { runAgentApiPipeline, checkRealApiRateLimit, recordAgentRun, recordAgentError, recordAgentAbortedRun } = vi.hoisted(() => ({
  runAgentApiPipeline: vi.fn(),
  checkRealApiRateLimit: vi.fn(() => ({ allowed: true, limit: 5, resetAt: Date.now() + 60_000 })),
  recordAgentRun: vi.fn().mockResolvedValue("run-stream-test"),
  recordAgentError: vi.fn().mockResolvedValue("run-stream-test"),
  recordAgentAbortedRun: vi.fn().mockResolvedValue("run-stream-test"),
}));

vi.mock("@/lib/agent/api", () => ({ runAgentApiPipeline }));
vi.mock("@/lib/ops/rateLimit", () => ({ checkRealApiRateLimit, getClientIp: () => "test-client" }));
vi.mock("@/lib/ops/storage", () => ({
  createOpsAgentRunId: () => "run-stream-test",
  recordAgentRun,
  recordAgentError,
  recordAgentAbortedRun,
  sanitizeRequestAction: (value: unknown) => ["send", "retry", "regenerate", "edit_resend"].includes(String(value)) ? value : "send",
}));

import { POST } from "@/app/api/agent/stream/route";

function agentResult(answer = "这是一个确定性的模拟流式回答，用于验证回答会逐段发送并在完成后校准。".repeat(3)): AgentApiResponse {
  return {
    question: "测试问题",
    route: { scenario: "general", intent: "general_chat", needRag: false, toolsNeeded: [], confidence: 0.8, reason: "test" },
    steps: [],
    ragAnswer: null,
    toolResults: [],
    finalAnswer: answer,
    structuredOutput: { scenario: "general", intent: "general_chat", answer, evidence: [], toolsUsed: [], sources: [], confidence: 0.8, riskLevel: "low", nextAction: "none" },
    createdAt: new Date(0).toISOString(),
    mode: "mock-agent",
    api: { requestedMode: "mock", responseMode: "mock", contextApplied: false, contextMessageCount: 0, contextTruncated: false },
  };
}

function request(mode: "mock" | "real" = "mock", signal?: AbortSignal, requestAction: unknown = "send") {
  return new Request("http://test.local/api/agent/stream", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question: "测试问题", mode, requestAction }),
    signal,
  });
}

async function readEvents(response: Response) {
  return (await response.text()).trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as AgentStreamEvent);
}

describe("POST /api/agent/stream", () => {
  beforeEach(() => {
    checkRealApiRateLimit.mockReturnValue({ allowed: true, limit: 5, resetAt: Date.now() + 60_000 });
    runAgentApiPipeline.mockImplementation(async (...args: unknown[]) => {
      const runtime = args[5] as { onPhase?: (phase: "generate") => void } | undefined;
      runtime?.onPhase?.("generate");
      return agentResult();
    });
  });

  it("streams deterministic mock deltas and records only the completed run", async () => {
    const response = await POST(request());
    expect(response.headers.get("content-type")).toContain("application/x-ndjson");
    const events = await readEvents(response);
    const deltas = events.filter((event): event is Extract<AgentStreamEvent, { type: "answer_delta" }> => event.type === "answer_delta");
    const completed = events.find((event): event is Extract<AgentStreamEvent, { type: "answer_completed" }> => event.type === "answer_completed");
    expect(events[0]).toMatchObject({ type: "run_started", runId: "run-stream-test", responseMode: "mock" });
    expect(events.filter((event) => event.type === "phase").map((event) => event.type === "phase" ? event.phase : "")).toEqual(["understand", "generate", "complete"]);
    expect(deltas.length).toBeGreaterThanOrEqual(6);
    expect(deltas.map((event) => event.delta).join("")).toBe(agentResult().finalAnswer);
    expect(completed).toMatchObject({ streamingRequested: true, streamingUsed: true, streamFallback: false, deltaCount: deltas.length, result: { runId: "run-stream-test" } });
    await vi.waitFor(() => expect(recordAgentRun).toHaveBeenCalledTimes(1));
    expect(recordAgentAbortedRun).not.toHaveBeenCalled();
    expect(recordAgentRun).toHaveBeenCalledWith(
      expect.objectContaining({ api: expect.objectContaining({ requestAction: "send" }) }),
      expect.objectContaining({ requestAction: "send" }),
    );
  });

  it("records only a whitelisted message action and never passes it into the Agent pipeline", async () => {
    const response = await POST(request("mock", undefined, "edit_resend"));
    await readEvents(response);
    expect(recordAgentRun).toHaveBeenCalledWith(
      expect.objectContaining({ api: expect.objectContaining({ requestAction: "edit_resend" }) }),
      expect.objectContaining({ requestAction: "edit_resend" }),
    );
    expect(runAgentApiPipeline.mock.calls[0]).toHaveLength(7);

    recordAgentRun.mockClear();
    runAgentApiPipeline.mockClear();
    const invalidResponse = await POST(request("mock", undefined, { action: "regenerate", previousAnswer: "private" }));
    await readEvents(invalidResponse);
    expect(recordAgentRun).toHaveBeenCalledWith(
      expect.objectContaining({ api: expect.objectContaining({ requestAction: "send" }) }),
      expect.objectContaining({ requestAction: "send" }),
    );
    expect(JSON.stringify(recordAgentRun.mock.calls)).not.toContain("private");
  });

  it("sends a pipeline patch once on completion and excludes it from Ops", async () => {
    const patch = { set: { text: "summary text", throughMessageId: "a-4", updatedAt: "2026-07-16T00:00:00.000Z", version: 1 as const, sourceMessageCount: 8 } };
    runAgentApiPipeline.mockResolvedValueOnce({ ...agentResult(), conversationSummaryPatch: patch });
    const events = await readEvents(await POST(request()));
    const completed = events.filter((event): event is Extract<AgentStreamEvent, { type: "answer_completed" }> => event.type === "answer_completed");

    expect(completed).toHaveLength(1);
    expect(completed[0]?.conversationSummaryPatch).toEqual(patch);
    expect(completed[0]?.result).not.toHaveProperty("conversationSummaryPatch");
    expect(recordAgentRun).toHaveBeenCalledWith(expect.not.objectContaining({ conversationSummaryPatch: expect.anything() }), expect.any(Object));
    expect(JSON.stringify(recordAgentRun.mock.calls)).not.toContain("summary text");
  });

  it("forwards the same patch for real streaming and real fallback completion", async () => {
    const patch = { clear: true as const };
    const realResult = { ...agentResult(), api: { ...agentResult().api, requestedMode: "real" as const, responseMode: "real" as const }, conversationSummaryPatch: patch };
    runAgentApiPipeline.mockImplementationOnce(async (...args: unknown[]) => {
      (args[5] as { onStreamMetadata?: (value: { streamingUsed: boolean; streamFallback: boolean; deltaCount: number }) => void } | undefined)?.onStreamMetadata?.({ streamingUsed: true, streamFallback: false, deltaCount: 1 });
      return realResult;
    });
    const streamed = (await readEvents(await POST(request("real")))).find((event): event is Extract<AgentStreamEvent, { type: "answer_completed" }> => event.type === "answer_completed");
    expect(streamed).toMatchObject({ conversationSummaryPatch: patch, streamingUsed: true, streamFallback: false });

    runAgentApiPipeline.mockImplementationOnce(async (...args: unknown[]) => {
      (args[5] as { onStreamMetadata?: (value: { streamingUsed: boolean; streamFallback: boolean; deltaCount: number }) => void } | undefined)?.onStreamMetadata?.({ streamingUsed: false, streamFallback: true, deltaCount: 0 });
      return { ...realResult, api: { ...realResult.api, responseMode: "real_error_fallback" as const } };
    });
    const fallback = (await readEvents(await POST(request("real")))).find((event): event is Extract<AgentStreamEvent, { type: "answer_completed" }> => event.type === "answer_completed");
    expect(fallback).toMatchObject({ conversationSummaryPatch: patch, streamFallback: true });
  });

  it("keeps the response open until the completed run id is persisted", async () => {
    let releaseRecord: (() => void) | undefined;
    recordAgentRun.mockImplementationOnce(() => new Promise<string>((resolve) => {
      releaseRecord = () => resolve("run-stream-test");
    }));
    const response = await POST(request());
    let responseFinished = false;
    const responseText = response.text().then((value) => {
      responseFinished = true;
      return value;
    });
    await vi.waitFor(() => expect(recordAgentRun).toHaveBeenCalledTimes(1));
    expect(responseFinished).toBe(false);
    releaseRecord?.();
    await expect(responseText).resolves.toContain('"type":"answer_completed"');
  });

  it("converts a real rate limit to one safe stream error", async () => {
    checkRealApiRateLimit.mockReturnValue({ allowed: false, limit: 1, resetAt: Date.now() + 60_000 });
    const events = await readEvents(await POST(request("real")));
    expect(events).toEqual([{ type: "run_error", code: "rate_limited", message: "请求过于频繁，请稍后再试。", retryable: true }]);
    expect(recordAgentError).toHaveBeenCalledWith(expect.objectContaining({ runId: "run-stream-test", errorType: "rate_limited", streamingRequested: true }));
    expect(runAgentApiPipeline).not.toHaveBeenCalled();
  });

  it("records an aborted stream once and never records it as successful", async () => {
    runAgentApiPipeline.mockImplementation(async (...args: unknown[]) => {
      const runtime = args[5] as { signal?: AbortSignal } | undefined;
      await new Promise<void>((_resolve, reject) => runtime?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true }));
      return agentResult();
    });
    const controller = new AbortController();
    const response = await POST(request("mock", controller.signal));
    controller.abort();
    const body = await response.text();
    await vi.waitFor(() => expect(recordAgentAbortedRun).toHaveBeenCalledTimes(1));
    expect(recordAgentRun).not.toHaveBeenCalled();
    expect(body).not.toContain("conversationSummaryPatch");
  });
});
