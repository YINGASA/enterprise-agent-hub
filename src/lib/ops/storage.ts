import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { feedbackLimits } from "@/lib/ops/securityLimits";
import type { AgentApiResponse, ChatAnswerFeedbackValue, EvaluationRunResponse } from "@/types";

const MAX_RECENT_ITEMS = 80;
const DEFAULT_MAX_STORED_ITEMS = 200;
const MAX_SAFE_RECENT_RUNS = 12;
const MAX_SAFE_RECENT_ERRORS = 8;
const MAX_SAFE_NEGATIVE_FEEDBACK = 6;

export type OpsStorageHealth = {
  storageHealthy: boolean;
  lastSuccessAt?: string;
  lastErrorAt?: string;
  lastErrorType?: string;
  pendingWrites: number;
};

const writeQueues = new Map<string, Promise<void>>();
const storageHealth: OpsStorageHealth = {
  storageHealthy: true,
  pendingWrites: 0,
};

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
  runId: string;
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

export type OpsDistributionItem = {
  key: string;
  count: number;
  rate: number;
};

export type OpsFeedbackModePerformance = {
  responseMode: string;
  total: number;
  helpfulRate: number;
  citationAccuracyRate: number;
};

export type OpsSafeRunSummary = Pick<
  OpsAgentRunRecord,
  "id" | "createdAt" | "questionPreview" | "responseMode" | "scenario" | "intent" | "toolsUsed" | "sourcesCount" | "errorType" | "httpStatus"
>;

export type OpsSafeFeedbackSummary = Pick<
  OpsFeedbackRecord,
  "id" | "createdAt" | "questionPreview" | "values" | "reasonPreview" | "responseMode"
>;

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
  rateLimitedCount: number;
  responseModeDistribution: OpsDistributionItem[];
  errorTypeDistribution: OpsDistributionItem[];
  scenarioDistribution: OpsDistributionItem[];
  intentDistribution: OpsDistributionItem[];
  toolDistribution: OpsDistributionItem[];
  recentErrors: OpsSafeRunSummary[];
  recentRuns: OpsSafeRunSummary[];
  feedback: {
    total: number;
    helpfulCount: number;
    helpfulRate: number;
    citationRatedCount: number;
    accurateCount: number;
    citationAccuracyRate: number;
    responseModePerformance: OpsFeedbackModePerformance[];
    recentNegative: OpsSafeFeedbackSummary[];
  };
  latestFullMockEvaluation?: OpsEvaluationRecord;
  storage: {
    enabled: boolean;
    retentionLimit: number;
    health: OpsStorageHealth;
  };
};

function dataDir() {
  return process.env["EAH_OPS_DATA_DIR"] || path.join(process.env["HOME"] || process.env["USERPROFILE"] || "/tmp", ".enterprise-agent-hub-runtime");
}

function filePath(name: string) {
  return path.join(dataDir(), name);
}

function makeId(prefix: string) {
  return `${prefix}-${randomUUID()}`;
}

function maxStoredItems() {
  const raw = Number(process.env["EAH_OPS_MAX_RECORDS"] ?? DEFAULT_MAX_STORED_ITEMS);
  return Number.isFinite(raw) && raw >= 20 ? Math.floor(raw) : DEFAULT_MAX_STORED_ITEMS;
}

function preview(value: string | undefined, maxLength: number) {
  const safe = (value ?? "").replace(/\s+/g, " ").trim();
  return safe.length > maxLength ? `${safe.slice(0, maxLength - 1)}...` : safe;
}

export function sanitizeQuestionPreview(value: string | undefined, maxLength = 48) {
  const masked = (value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[邮箱已脱敏]")
    .replace(/(?<!\d)1[3-9]\d{9}(?!\d)/g, "[手机号已脱敏]")
    .replace(/(?<!\d)\d{17}[\dXx](?!\d)/g, "[证件号已脱敏]")
    .replace(/订单(?:号)?[\s:#：-]*[A-Z0-9-]{4,}/gi, "订单[已脱敏]")
    .replace(/(?<!\d)\d{6,}(?!\d)/g, "[长数字已脱敏]");
  if (!masked) return "[空问题]";
  const limit = Math.max(8, maxLength);
  if (masked.length > limit) return `${masked.slice(0, limit - 1)}…`;
  if (masked.includes("已脱敏")) return `${masked}…[已截断]`;
  const visibleLength = Math.max(1, Math.min(masked.length - 1, Math.ceil(masked.length / 2)));
  return `${masked.slice(0, visibleLength)}…[已截断]`;
}

function percentage(count: number, total: number) {
  return total ? Math.round((count / total) * 100) : 0;
}

function distribution(values: string[], total = values.length): OpsDistributionItem[] {
  const counts = values.reduce<Record<string, number>>((result, value) => {
    const key = value || "unknown";
    result[key] = (result[key] ?? 0) + 1;
    return result;
  }, {});

  return Object.entries(counts)
    .map(([key, count]) => ({ key, count, rate: percentage(count, total) }))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
}

function safeRunSummary(item: OpsAgentRunRecord): OpsSafeRunSummary {
  return {
    id: item.id,
    createdAt: item.createdAt,
    questionPreview: sanitizeQuestionPreview(item.questionPreview),
    responseMode: item.responseMode,
    scenario: item.scenario,
    intent: item.intent,
    toolsUsed: item.toolsUsed.slice(0, 8),
    sourcesCount: item.sourcesCount,
    errorType: item.errorType,
    httpStatus: item.httpStatus,
  };
}

function safeFeedbackSummary(item: OpsFeedbackRecord): OpsSafeFeedbackSummary {
  return {
    id: item.id,
    createdAt: item.createdAt,
    questionPreview: sanitizeQuestionPreview(item.questionPreview),
    values: item.values.slice(0, 4),
    reasonPreview: item.reasonPreview ? preview(item.reasonPreview, 140) : undefined,
    responseMode: item.responseMode,
  };
}

function isFallback(responseMode: string, intent?: string) {
  return responseMode === "fallback" || responseMode === "real_text_fallback" || responseMode === "real_error_fallback" || intent === "general_chat";
}

function safeErrorType(error: unknown) {
  if (error instanceof Error && error.name) return error.name.slice(0, 80);
  return "storage_write_failed";
}

function recordStorageSuccess() {
  storageHealth.storageHealthy = true;
  storageHealth.lastSuccessAt = new Date().toISOString();
  storageHealth.lastErrorType = undefined;
}

function recordStorageFailure(error: unknown) {
  storageHealth.storageHealthy = false;
  storageHealth.lastErrorAt = new Date().toISOString();
  storageHealth.lastErrorType = safeErrorType(error);
}

function publicStorageHealth(): OpsStorageHealth {
  return { ...storageHealth };
}

export function getOpsStorageHealth() {
  return publicStorageHealth();
}

async function readRawLines(fileName: string) {
  try {
    const raw = await readFile(filePath(fileName), "utf8");
    return raw.split(/\r?\n/).filter(Boolean);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function writeJsonLinesAtomically(fileName: string, lines: string[]) {
  const target = filePath(fileName);
  const temp = `${target}.${randomUUID()}.tmp`;
  try {
    await mkdir(dataDir(), { recursive: true });
    await writeFile(temp, `${lines.join("\n")}\n`, "utf8");
    await rename(temp, target);
  } catch (error) {
    await unlink(temp).catch(() => undefined);
    throw error;
  }
}

function enqueueWrite(fileName: string, task: () => Promise<void>) {
  const previous = writeQueues.get(fileName) ?? Promise.resolve();
  storageHealth.pendingWrites += 1;
  const current = previous.catch(() => undefined).then(task);
  const settled = current
    .then(() => recordStorageSuccess())
    .catch((error) => recordStorageFailure(error))
    .finally(() => {
      storageHealth.pendingWrites = Math.max(0, storageHealth.pendingWrites - 1);
      if (writeQueues.get(fileName) === settled) writeQueues.delete(fileName);
    });
  writeQueues.set(fileName, settled);
  return settled;
}

async function appendJsonLine(fileName: string, item: unknown) {
  const serialized = JSON.stringify(item);
  await enqueueWrite(fileName, async () => {
    const lines = await readRawLines(fileName);
    const retained = [...lines, serialized].slice(-maxStoredItems());
    await writeJsonLinesAtomically(fileName, retained);
  });
}

async function readJsonLines<T>(fileName: string, limit = MAX_RECENT_ITEMS): Promise<T[]> {
  try {
    const pending = writeQueues.get(fileName);
    if (pending) await pending;
    return (await readRawLines(fileName))
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
    questionPreview: sanitizeQuestionPreview(result.question),
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
  return item.id;
}

export async function recordAgentError(input: {
  question?: string;
  requestedMode: string;
  responseMode: string;
  errorType: string;
  httpStatus?: number;
}) {
  const item: OpsAgentRunRecord = {
    id: makeId("run"),
    createdAt: new Date().toISOString(),
    questionPreview: sanitizeQuestionPreview(input.question),
    responseMode: input.responseMode,
    requestedMode: input.requestedMode,
    scenario: "unknown",
    intent: "unknown",
    toolsUsed: [],
    sourcesCount: 0,
    errorType: input.errorType,
    httpStatus: input.httpStatus,
    fallback: input.responseMode === "real_error_fallback" || input.errorType === "rate_limited",
  };
  await appendJsonLine("agent-runs.jsonl", item);
}

type FeedbackValidation =
  | { ok: true; run: OpsAgentRunRecord }
  | { ok: false; reason: "invalid" | "expired" | "duplicate" };

function feedbackCategories(values: ChatAnswerFeedbackValue[]) {
  return values.map((value) => (value === "positive" || value === "negative" ? "helpfulness" : "citation"));
}

export async function validateFeedbackRun(runId: string, values: ChatAnswerFeedbackValue[]): Promise<FeedbackValidation> {
  const runs = await readJsonLines<OpsAgentRunRecord>("agent-runs.jsonl", maxStoredItems());
  const run = runs.find((item) => item.id === runId);
  if (!run) return { ok: false, reason: "invalid" };
  const createdAt = Date.parse(run.createdAt);
  if (!Number.isFinite(createdAt) || Date.now() - createdAt > feedbackLimits.runTtlMs) return { ok: false, reason: "expired" };

  const feedback = await readJsonLines<OpsFeedbackRecord>("feedback.jsonl", maxStoredItems());
  const requestedCategories = new Set(feedbackCategories(values));
  const alreadyRatedCategories = new Set(feedback.filter((item) => item.runId === runId).flatMap((item) => feedbackCategories(item.values)));
  if ([...requestedCategories].some((category) => alreadyRatedCategories.has(category))) return { ok: false, reason: "duplicate" };
  return { ok: true, run };
}

export async function recordChatFeedback(input: {
  run: OpsAgentRunRecord;
  values: ChatAnswerFeedbackValue[];
  reason?: string;
}) {
  const item: OpsFeedbackRecord = {
    id: makeId("feedback"),
    runId: input.run.id,
    createdAt: new Date().toISOString(),
    questionPreview: input.run.questionPreview,
    values: input.values.slice(0, 4),
    reasonPreview: input.reason ? preview(input.reason, 220) : undefined,
    responseMode: input.run.responseMode,
    scenario: input.run.scenario,
    intent: input.run.intent,
    sourcesCount: input.run.sourcesCount,
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
  const feedback = await readJsonLines<OpsFeedbackRecord>("feedback.jsonl", 200);
  const evaluations = await readJsonLines<OpsEvaluationRecord>("evaluations.jsonl", 20);
  const recentRuns = runs.slice(0, MAX_RECENT_ITEMS);
  const total = recentRuns.length;
  const realCount = recentRuns.filter((item) => item.responseMode === "real" || item.responseMode === "real_repaired").length;
  const mockCount = recentRuns.filter((item) => item.responseMode === "mock").length;
  const fallbackCount = recentRuns.filter((item) => item.fallback).length;
  const rateLimitedCount = recentRuns.filter((item) => item.errorType === "rate_limited").length;
  const helpfulCount = feedback.filter((item) => item.values.includes("positive")).length;
  const citationRated = feedback.filter((item) => item.values.includes("accurate") || item.values.includes("inaccurate"));
  const accurateCount = citationRated.filter((item) => item.values.includes("accurate")).length;
  const feedbackModes = distribution(feedback.map((item) => item.responseMode));
  const responseModePerformance = feedbackModes.map(({ key, count }) => {
    const modeFeedback = feedback.filter((item) => item.responseMode === key);
    const modeCitationRated = modeFeedback.filter((item) => item.values.includes("accurate") || item.values.includes("inaccurate"));
    return {
      responseMode: key,
      total: count,
      helpfulRate: percentage(modeFeedback.filter((item) => item.values.includes("positive")).length, count),
      citationAccuracyRate: percentage(modeCitationRated.filter((item) => item.values.includes("accurate")).length, modeCitationRated.length),
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    llmConfigured,
    recentAgentRunCount: total,
    realCount,
    mockCount,
    fallbackCount,
    realRate: percentage(realCount, total),
    mockRate: percentage(mockCount, total),
    fallbackRate: percentage(fallbackCount, total),
    rateLimitedCount,
    responseModeDistribution: distribution(recentRuns.map((item) => item.responseMode)),
    errorTypeDistribution: distribution(recentRuns.filter((item) => item.errorType).map((item) => item.errorType ?? "unknown")),
    scenarioDistribution: distribution(recentRuns.map((item) => item.scenario)),
    intentDistribution: distribution(recentRuns.map((item) => item.intent)),
    toolDistribution: distribution(recentRuns.flatMap((item) => item.toolsUsed)),
    recentErrors: recentRuns
      .filter((item) => item.errorType || item.responseMode === "real_error_fallback")
      .slice(0, MAX_SAFE_RECENT_ERRORS)
      .map(safeRunSummary),
    recentRuns: recentRuns.slice(0, MAX_SAFE_RECENT_RUNS).map(safeRunSummary),
    feedback: {
      total: feedback.length,
      helpfulCount,
      helpfulRate: percentage(helpfulCount, feedback.length),
      citationRatedCount: citationRated.length,
      accurateCount,
      citationAccuracyRate: percentage(accurateCount, citationRated.length),
      responseModePerformance,
      recentNegative: feedback
        .filter((item) => item.values.includes("negative") || item.values.includes("inaccurate"))
        .slice(0, MAX_SAFE_NEGATIVE_FEEDBACK)
        .map(safeFeedbackSummary),
    },
    latestFullMockEvaluation: evaluations[0],
    storage: {
      enabled: publicStorageHealth().storageHealthy,
      retentionLimit: maxStoredItems(),
      health: publicStorageHealth(),
    },
  };
}
