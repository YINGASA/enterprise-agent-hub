import { beforeEach, describe, expect, it, vi } from "vitest";

const { runAgentApiPipeline, recordAgentRun, recordAgentError } = vi.hoisted(() => ({
  runAgentApiPipeline: vi.fn(),
  recordAgentRun: vi.fn(),
  recordAgentError: vi.fn(),
}));

vi.mock("@/lib/agent/api", () => ({ runAgentApiPipeline }));
vi.mock("@/lib/ops/storage", () => ({ recordAgentRun, recordAgentError }));

import { POST } from "@/app/api/agent/route";

function request(body: string) {
  return new Request("http://test.local/api/agent", { method: "POST", headers: { "content-type": "application/json" }, body });
}

describe("POST /api/agent", () => {
  beforeEach(() => {
    runAgentApiPipeline.mockResolvedValue({ question: "测试", api: { responseMode: "mock" } });
    recordAgentRun.mockResolvedValue("run-test");
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

  it("returns a server-generated run id for valid mock runs", async () => {
    const response = await POST(request(JSON.stringify({ question: "测试", mode: "mock" })));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ runId: "run-test" });
    expect(runAgentApiPipeline).toHaveBeenCalledWith("测试", "mock", []);
  });
});
