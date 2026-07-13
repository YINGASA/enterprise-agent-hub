import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  getOpsStorageHealth,
  getOpsSummary,
  recordAgentAbortedRun,
  recordAgentRun,
  recordChatFeedback,
  validateFeedbackRun,
  type OpsAgentRunRecord,
} from "@/lib/ops/storage";
import type { AgentApiResponse } from "@/types";

let runtimeDir = "";

function agentResult(index: number): AgentApiResponse {
  return {
    question: `并发运行 ${index}`,
    route: { scenario: "enterprise", intent: "knowledge_qa", needRag: true, toolsNeeded: [], confidence: 0.9, reason: "test" },
    steps: [],
    ragAnswer: undefined,
    toolResults: [],
    finalAnswer: "测试回答",
    structuredOutput: { scenario: "enterprise", intent: "knowledge_qa", answer: "测试回答", evidence: [], toolsUsed: [], sources: [], confidence: 0.9, riskLevel: "low", nextAction: "继续" },
    createdAt: new Date().toISOString(),
    mode: "mock",
    api: { requestedMode: "mock", responseMode: "mock" },
  } as unknown as AgentApiResponse;
}

function feedbackRun(index: number): OpsAgentRunRecord {
  return {
    id: `run-feedback-${index}`,
    createdAt: new Date().toISOString(),
    questionPreview: `反馈问题 ${index}`,
    responseMode: "mock",
    requestedMode: "mock",
    scenario: "enterprise",
    intent: "knowledge_qa",
    toolsUsed: [],
    sourcesCount: 1,
    fallback: false,
  };
}

async function parseJsonl(name: string) {
  const raw = await readFile(path.join(runtimeDir, name), "utf8");
  return raw.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

describe("Ops JSONL storage reliability", () => {
  beforeEach(async () => {
    runtimeDir = await mkdtemp(path.join(os.tmpdir(), "eah-ops-storage-"));
    process.env.EAH_OPS_DATA_DIR = runtimeDir;
    process.env.EAH_OPS_MAX_RECORDS = "100";
  });

  afterEach(async () => {
    await rm(runtimeDir, { recursive: true, force: true });
    delete process.env.EAH_OPS_DATA_DIR;
    delete process.env.EAH_OPS_MAX_RECORDS;
  });

  it("serializes concurrent Agent run writes without losing or corrupting JSONL records", async () => {
    await Promise.all(Array.from({ length: 40 }, (_, index) => recordAgentRun(agentResult(index))));
    const records = await parseJsonl("agent-runs.jsonl");
    expect(records).toHaveLength(40);
    expect(new Set(records.map((record) => record.id)).size).toBe(40);
    expect(getOpsStorageHealth()).toMatchObject({ storageHealthy: true, pendingWrites: 0 });
  });

  it("keeps concurrent feedback valid and atomically retains only the newest configured records", async () => {
    process.env.EAH_OPS_MAX_RECORDS = "20";
    await Promise.all(Array.from({ length: 30 }, (_, index) => recordChatFeedback({ run: feedbackRun(index), values: ["positive"] })));
    const records = await parseJsonl("feedback.jsonl");
    const files = await readdir(runtimeDir);
    expect(records).toHaveLength(20);
    expect(records.every((record) => typeof record.runId === "string")).toBe(true);
    expect(files.some((name) => name.endsWith(".tmp"))).toBe(false);
  });

  it("keeps aggregate dimensions while returning only sanitized question summaries", async () => {
    const result = agentResult(1);
    result.question = "订单10001请联系13800138000或user@example.com";
    result.api.responseMode = "real";
    result.route.scenario = "ecommerce";
    result.route.intent = "policy_check";
    await recordAgentRun(result);
    const summary = await getOpsSummary(true);
    expect(summary.recentRuns[0].questionPreview).not.toMatch(/10001|13800138000|user@example\.com/);
    expect(summary.responseModeDistribution).toContainEqual(expect.objectContaining({ key: "real", count: 1 }));
    expect(summary.scenarioDistribution).toContainEqual(expect.objectContaining({ key: "ecommerce", count: 1 }));
    expect(summary.intentDistribution).toContainEqual(expect.objectContaining({ key: "policy_check", count: 1 }));
  });

  it("stores only bounded context metadata and never conversation history", async () => {
    const result = agentResult(1);
    result.api.contextApplied = true;
    result.api.contextMessageCount = 2;
    result.api.contextTruncated = false;
    Object.assign(result, { conversationContext: { messages: [{ role: "user", content: "历史秘密订单10001" }] } });
    await recordAgentRun(result);
    const raw = await readFile(path.join(runtimeDir, "agent-runs.jsonl"), "utf8");
    const summary = await getOpsSummary(false);
    expect(raw).not.toMatch(/conversationContext|messages|历史秘密订单10001/);
    expect(summary.recentRuns[0]).toMatchObject({ contextApplied: true, contextMessageCount: 2, contextTruncated: false });
    expect(JSON.stringify(summary)).not.toContain("历史秘密订单10001");
  });

  it("stores only safe streaming metadata and never deltas or upstream stream payloads", async () => {
    const result = agentResult(2);
    result.api.contextApplied = true;
    result.api.contextMessageCount = 4;
    result.api.contextTruncated = true;
    Object.assign(result, {
      conversationContext: { messages: [{ role: "assistant", content: "private history" }] },
      answerDelta: "private incremental answer",
      upstreamSse: "data: private raw event",
      prompt: "private final prompt",
    });
    await recordAgentRun(result, {
      runId: "run-stream-safe",
      streamingRequested: true,
      streamingUsed: true,
      streamFallback: false,
      durationMs: 125.8,
    });

    const raw = await readFile(path.join(runtimeDir, "agent-runs.jsonl"), "utf8");
    const [record] = await parseJsonl("agent-runs.jsonl");
    const summary = await getOpsSummary(false);
    expect(record).toMatchObject({
      id: "run-stream-safe",
      streamingRequested: true,
      streamingUsed: true,
      streamFallback: false,
      aborted: false,
      durationMs: 125,
      contextApplied: true,
      contextMessageCount: 4,
      contextTruncated: true,
    });
    expect(raw).not.toMatch(/conversationContext|messages|answerDelta|upstreamSse|prompt|private history|private incremental answer|private raw event|private final prompt/);
    expect(summary.recentRuns[0]).toMatchObject({
      streamingRequested: true,
      streamingUsed: true,
      streamFallback: false,
      aborted: false,
      durationMs: 125,
    });
  });

  it("records an aborted stream once and keeps the first terminal outcome", async () => {
    const abort = {
      runId: "run-abort-once",
      question: "cancel private question",
      requestedMode: "mock",
      responseMode: "mock",
      durationMs: 80,
      contextApplied: false,
      contextMessageCount: 0,
      contextTruncated: false,
      streamingUsed: true,
      streamFallback: false,
    };
    await Promise.all(Array.from({ length: 8 }, () => recordAgentAbortedRun(abort)));
    await recordAgentRun(agentResult(3), {
      runId: abort.runId,
      streamingRequested: true,
      streamingUsed: true,
      durationMs: 120,
    });

    const records = await parseJsonl("agent-runs.jsonl");
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      id: abort.runId,
      responseMode: "aborted",
      errorType: "aborted",
      aborted: true,
      streamingRequested: true,
      streamingUsed: true,
      durationMs: 80,
    });
    expect(JSON.stringify(records[0])).not.toContain("delta");
    const summary = await getOpsSummary(false);
    expect(summary).toMatchObject({ recentAgentRunCount: 1, realCount: 0, mockCount: 0, fallbackCount: 0, realRate: 0, mockRate: 0, fallbackRate: 0 });
    await expect(validateFeedbackRun(abort.runId, ["positive"])).resolves.toEqual({ ok: false, reason: "invalid" });
  });

  it("records a safe degraded state on failure and recovers after a later successful write", async () => {
    const blockedPath = path.join(runtimeDir, "blocked");
    await writeFile(blockedPath, "not-a-directory", "utf8");
    process.env.EAH_OPS_DATA_DIR = blockedPath;
    await recordAgentRun(agentResult(1));
    expect(getOpsStorageHealth()).toMatchObject({ storageHealthy: false });
    expect(getOpsStorageHealth().lastErrorType).toBeTruthy();
    expect((await getOpsSummary(false)).storage.health.storageHealthy).toBe(false);

    const recoveryDir = await mkdtemp(path.join(os.tmpdir(), "eah-ops-recovery-"));
    process.env.EAH_OPS_DATA_DIR = recoveryDir;
    await recordAgentRun(agentResult(2));
    expect(getOpsStorageHealth()).toMatchObject({ storageHealthy: true, pendingWrites: 0 });
    expect(getOpsStorageHealth().lastSuccessAt).toBeTruthy();
    expect((await getOpsSummary(false)).storage.health.storageHealthy).toBe(true);
    await rm(recoveryDir, { recursive: true, force: true });
  });
});
