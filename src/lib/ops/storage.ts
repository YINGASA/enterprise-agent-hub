import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { AgentApiResponse, ChatAnswerFeedbackValue, EvaluationRunResponse } from "@/types";

const MAX_RECENT_ITEMS = 80;

export type OpsAgentRunRecord = {
  id: string;
  createdAt: string;
  questionPreview: string;
  responseMode: string;
  requestedMode: string;
  scenario: string;
  intent: string;
  toolsUsed: string[];
  sourcesCount: number;
  retrievalConfidence?: string;
  errorType?: string;
  httpStatus?: number;
  durationMs?: number;
  fallback: boolean;
};

export type OpsFeedbackRecord = {
  id: string;
  createdAt: string;
  questionPreview: string;
  values: ChatAnswerFeedbackValue[];
  reasonPreview?: string;
  responseMode: string;
  scenario: string;
  intent: string;
  sourcesCount: number;
};

export type OpsEvaluationRecord = {
  id: string;
  createdAt: string;
  mode: string;
  suite: string;
  total: number;
  passed: number;
  passRate: number;
  durationMs: number;
};

export type OpsSummary = {
  generatedAt: string;
  llmConfigured: boolean;
  recentAgentRunCount: number;
  realCount: number;
  mockCount: number;
  fallbackCount: number;
  realRate: number;
  mockRate: number;
  fallbackRate: number;
  recentErrors: Array<Pick<OpsAgentRunRecord, "createdAt" | "responseMode" | "errorType" | "httpStatus" | "questionPreview">>;
  recentRuns: OpsAgentRunRecord[];
  recentFeedback: OpsFeedbackRecord[];
  latestFullMockEvaluation?: OpsEvaluationRecord;
  storage: {
    enabled: boolean;
    directory: string;
  };
};

function dataDir() {
  return process.env["EAH_OPS_DATA_DIR"] || path.join(process.env["HOME"] || process.env["USERPROFILE"] || "/tmp", ".enterprise-agent-hub-runtime");
}

function filePath(name: string) {
  return path.join(dataDir(), name);
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function preview(value: string | undefined, maxLength: number) {
  const safe = (value ?? "").replace(/\s+/g, " ").trim();
  return safe.length > maxLength ? `${safe.slice(0, maxLength - 1)}...` : safe;
}

function isFallback(responseMode: string, intent?: string) {
  return responseMode === "fallback" || responseMode === "real_text_fallback" || responseMode === "real_error_fallback" || intent === "general_chat";
}

async function appendJsonLine(fileName: string, item: unknown) {
  try {
    await mkdir(dataDir(), { recursive: true });
    await appendFile(filePath(fileName), JSON.stringify(item) + "\n", "utf8");
  } catch {
    // Ops persistence should never break user-facing Agent flows.
  }
}

async function readJsonLines<T>(fileName: string, limit = MAX_RECENT_ITEMS): Promise<T[]> {
  try {
    const raw = await readFile(filePath(fileName), "utf8");
    return raw
      .split(/\r?\n/)
      .filter(Boolean)
      .slice(-limit)
      .map((line) => JSON.parse(line) as T)
      .reverse();
  } catch {
    return [];
  }
}

export async function recordAgentRun(result: AgentApiResponse) {
  const item: OpsAgentRunRecord = {
    id: makeId("run"),
    createdAt: new Date().toISOString(),
    questionPreview: preview(result.question, 180),
    responseMode: result.api.responseMode,
    requestedMode: result.api.requestedMode,
    scenario: result.route.scenario,
    intent: result.route.intent,
    toolsUsed: result.structuredOutput.toolsUsed,
    sourcesCount: result.ragAnswer?.sources.length ?? 0,
    retrievalConfidence: result.ragAnswer?.retrievalConfidence ?? result.ragAnswer?.retrievalMetadata?.retrievalConfidence,
    errorType: result.api.errorType,
    httpStatus: result.api.httpStatus,
    durationMs: result.api.llmDurationMs,
    fallback: isFallback(result.api.responseMode, result.route.intent),
  };
  await appendJsonLine("agent-runs.jsonl", item);
}

export async function recordChatFeedback(input: {
  question: string;
  values: ChatAnswerFeedbackValue[];
  reason?: string;
  responseMode: string;
  scenario: string;
  intent: string;
  sourcesCount: number;
}) {
  const item: OpsFeedbackRecord = {
    id: makeId("feedback"),
    createdAt: new Date().toISOString(),
    questionPreview: preview(input.question, 180),
    values: input.values.slice(0, 4),
    reasonPreview: input.reason ? preview(input.reason, 220) : undefined,
    responseMode: input.responseMode,
    scenario: input.scenario,
    intent: input.intent,
    sourcesCount: input.sourcesCount,
  };
  await appendJsonLine("feedback.jsonl", item);
}

export async function recordEvaluationRun(result: EvaluationRunResponse) {
  if (result.selectedSuite !== "full" || result.mode !== "mock") return;
  const item: OpsEvaluationRecord = {
    id: makeId("eval"),
    createdAt: new Date().toISOString(),
    mode: result.mode,
    suite: result.selectedSuite,
    total: result.summary.total,
    passed: result.summary.passed,
    passRate: result.summary.passRate,
    durationMs: result.durationMs,
  };
  await appendJsonLine("evaluations.jsonl", item);
}

export async function getOpsSummary(llmConfigured: boolean): Promise<OpsSummary> {
  const runs = await readJsonLines<OpsAgentRunRecord>("agent-runs.jsonl", 200);
  const feedback = await readJsonLines<OpsFeedbackRecord>("feedback.jsonl", 30);
  const evaluations = await readJsonLines<OpsEvaluationRecord>("evaluations.jsonl", 20);
  const recentRuns = runs.slice(0, MAX_RECENT_ITEMS);
  const total = recentRuns.length;
  const realCount = recentRuns.filter((item) => item.responseMode === "real" || item.responseMode === "real_repaired").length;
  const mockCount = recentRuns.filter((item) => item.responseMode === "mock").length;
  const fallbackCount = recentRuns.filter((item) => item.fallback).length;
  const rate = (count: number) => (total ? Math.round((count / total) * 100) : 0);

  return {
    generatedAt: new Date().toISOString(),
    llmConfigured,
    recentAgentRunCount: total,
    realCount,
    mockCount,
    fallbackCount,
    realRate: rate(realCount),
    mockRate: rate(mockCount),
    fallbackRate: rate(fallbackCount),
    recentErrors: recentRuns
      .filter((item) => item.errorType || item.responseMode === "real_error_fallback")
      .slice(0, 10)
      .map((item) => ({
        createdAt: item.createdAt,
        responseMode: item.responseMode,
        errorType: item.errorType,
        httpStatus: item.httpStatus,
        questionPreview: item.questionPreview,
      })),
    recentRuns,
    recentFeedback: feedback,
    latestFullMockEvaluation: evaluations[0],
    storage: {
      enabled: true,
      directory: dataDir(),
    },
  };
}
