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

function request(mode: "mock" | "real" = "mock", signal?: AbortSignal) {
  return new Request("http://test.local/api/agent/stream", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question: "测试问题", mode }),
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
    await response.text();
    await vi.waitFor(() => expect(recordAgentAbortedRun).toHaveBeenCalledTimes(1));
    expect(recordAgentRun).not.toHaveBeenCalled();
  });
});
