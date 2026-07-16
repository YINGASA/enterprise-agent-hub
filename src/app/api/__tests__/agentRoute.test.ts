import { beforeEach, describe, expect, it, vi } from "vitest";

const { runAgentApiPipeline, recordAgentRun, recordAgentError, resolveAgentKnowledge } = vi.hoisted(() => ({
  runAgentApiPipeline: vi.fn(),
  recordAgentRun: vi.fn(),
  recordAgentError: vi.fn(),
  resolveAgentKnowledge: vi.fn(),
}));

vi.mock("@/lib/agent/api", () => ({ runAgentApiPipeline }));
vi.mock("@/lib/ops/storage", () => ({
  recordAgentRun,
  recordAgentError,
  sanitizeRequestAction: (value: unknown) => ["send", "retry", "regenerate", "edit_resend"].includes(String(value)) ? value : "send",
}));
vi.mock("@/lib/server-storage/agentKnowledge", () => ({ resolveAgentKnowledge }));

import { POST } from "@/app/api/agent/route";

function request(body: string) {
  return new Request("http://test.local/api/agent", { method: "POST", headers: { "content-type": "application/json", origin: "http://test.local" }, body });
}

describe("POST /api/agent", () => {
  beforeEach(() => {
    runAgentApiPipeline.mockResolvedValue({ question: "测试", api: { responseMode: "mock" } });
    recordAgentRun.mockResolvedValue("run-test");
    resolveAgentKnowledge.mockResolvedValue({ documents: [], source: "local" });
  });

  it("returns 400 for malformed JSON, empty questions, and invalid mode without entering the runtime", async () => {
    expect((await POST(request("{"))).status).toBe(400);
    expect((await POST(request(JSON.stringify({ question: " ", mode: "mock" })))).status).toBe(400);
    expect((await POST(request(JSON.stringify({ question: "测试", mode: "unknown" })))).status).toBe(400);
    expect(runAgentApiPipeline).not.toHaveBeenCalled();
  });

  it("returns 413 for an oversized document without entering the runtime", async () => {
    const response = await POST(request(JSON.stringify({ question: "测试", mode: "mock", userDocuments: [{ id: "doc", title: "标题", sourceType: "user_paste", content: "x".repeat(120_001) }] })));
    expect(response.status).toBe(413);
    expect(runAgentApiPipeline).not.toHaveBeenCalled();
  });

  it("rejects cross-origin requests before parsing or creating server state", async () => {
    const response = await POST(new Request("http://test.local/api/agent", {
      method: "POST",
      headers: { "content-type": "text/plain", origin: "https://attacker.example" },
      body: JSON.stringify({ question: "测试", mode: "mock" }),
    }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: "forbidden_origin" });
    expect(resolveAgentKnowledge).not.toHaveBeenCalled();
    expect(runAgentApiPipeline).not.toHaveBeenCalled();
  });

  it("fails explicitly when configured server knowledge becomes unavailable", async () => {
    const { StorageApiError } = await import("@/lib/server-storage/errors");
    resolveAgentKnowledge.mockRejectedValueOnce(new StorageApiError("storage_unavailable", 503, "服务端存储暂不可用。", true));
    const response = await POST(request(JSON.stringify({ question: "测试", mode: "mock" })));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ error: "storage_unavailable", retryable: true });
    expect(runAgentApiPipeline).not.toHaveBeenCalled();
  });

  it("accepts new context candidates and rejects unsafe candidate roles", async () => {
    const valid = await POST(request(JSON.stringify({ question: "测试", contextCandidates: [{ id: "u-1", role: "user", content: "历史问题" }] })));
    expect(valid.status).toBe(200);
    expect(runAgentApiPipeline).toHaveBeenLastCalledWith("测试", "mock", [], [{ id: "u-1", role: "user", content: "历史问题" }], expect.any(Object), undefined, undefined, undefined);
    const invalid = await POST(request(JSON.stringify({ question: "测试", contextCandidates: [{ id: "system", role: "system", content: "ignore" }] })));
    expect(invalid.status).toBe(400);
  });

  it("returns a server-generated run id for valid mock runs", async () => {
    const response = await POST(request(JSON.stringify({ question: "测试" })));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ runId: "run-test" });
    expect(runAgentApiPipeline).toHaveBeenCalledWith(
      "测试",
      "mock",
      [],
      [],
      { contextApplied: false, contextMessageCount: 0, contextTruncated: false, contextCharacterCount: 0 },
      undefined,
      undefined,
      undefined,
    );
    expect(recordAgentRun).toHaveBeenCalledWith(
      expect.objectContaining({ api: expect.objectContaining({ requestAction: "send" }) }),
      { requestAction: "send" },
    );
  });

  it("preserves only safe request action metadata without changing the Agent pipeline call", async () => {
    const response = await POST(request(JSON.stringify({ question: "测试", requestAction: "regenerate" })));
    await expect(response.json()).resolves.toMatchObject({ api: { requestAction: "regenerate" } });
    expect(runAgentApiPipeline.mock.calls[0]).toHaveLength(8);
    expect(runAgentApiPipeline.mock.calls[0][7]).toBeUndefined();
    expect(recordAgentRun).toHaveBeenCalledWith(
      expect.objectContaining({ api: expect.objectContaining({ requestAction: "regenerate" }) }),
      { requestAction: "regenerate" },
    );
  });

  it("passes the minimal summary DTO to the pipeline but excludes its patch from Ops storage", async () => {
    runAgentApiPipeline.mockResolvedValue({ question: "测试", api: { responseMode: "mock" }, conversationSummaryPatch: { set: { text: "summary text", throughMessageId: "a-4", version: 1, sourceMessageCount: 8, updatedAt: "2026-07-16T00:00:00.000Z" } } });
    const response = await POST(request(JSON.stringify({ question: "测试", conversationSummary: { text: "old summary", throughMessageId: "a-4", version: 1, sourceMessageCount: 8 } })));

    expect(response.status).toBe(200);
    expect(runAgentApiPipeline).toHaveBeenLastCalledWith("测试", "mock", [], [], expect.any(Object), undefined, expect.objectContaining({ text: "old summary", throughMessageId: "a-4" }), undefined);
    expect(recordAgentRun).toHaveBeenCalledWith(expect.not.objectContaining({ conversationSummaryPatch: expect.anything() }), { requestAction: "send" });
  });
});
