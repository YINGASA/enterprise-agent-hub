import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { POST } from "@/app/api/ops/feedback/route";
import { recordAgentRun } from "@/lib/ops/storage";
import type { AgentApiResponse } from "@/types";

let runtimeDir = "";

function makeRun(): AgentApiResponse {
  return {
    question: "测试反馈归因",
    route: { scenario: "enterprise", intent: "knowledge_qa", needRag: true, toolsNeeded: [], confidence: 0.9, reason: "test" },
    steps: [],
    toolResults: [],
    finalAnswer: "测试回答",
    structuredOutput: { scenario: "enterprise", intent: "knowledge_qa", answer: "测试回答", evidence: [], toolsUsed: [], sources: [], confidence: 0.9, riskLevel: "low", nextAction: "继续" },
    createdAt: new Date().toISOString(),
    mode: "mock",
    api: { requestedMode: "mock", responseMode: "mock" },
  } as unknown as AgentApiResponse;
}

function request(body: object) {
  return new Request("http://test.local/api/ops/feedback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

describe("POST /api/ops/feedback", () => {
  beforeEach(async () => {
    runtimeDir = await mkdtemp(path.join(os.tmpdir(), "eah-feedback-test-"));
    process.env.EAH_OPS_DATA_DIR = runtimeDir;
  });

  afterEach(async () => {
    await rm(runtimeDir, { recursive: true, force: true });
    delete process.env.EAH_OPS_DATA_DIR;
  });

  it("accepts feedback only for a valid run and blocks duplicate categories", async () => {
    const runId = await recordAgentRun(makeRun());
    expect((await POST(request({ runId: "missing-run", values: ["positive"] }))).status).toBe(400);
    expect((await POST(request({ runId, values: ["positive"] }))).status).toBe(200);
    expect((await POST(request({ runId, values: ["negative"] }))).status).toBe(409);
    expect((await POST(request({ runId, values: ["accurate"] }))).status).toBe(200);
  });
});
