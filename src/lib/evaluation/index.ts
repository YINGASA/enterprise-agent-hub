import { evaluationCases } from "@/data/evaluation";
import { runAgentApiPipeline } from "@/lib/agent/api";
import type {
  AgentApiResponse,
  EvaluationCase,
  EvaluationCaseResult,
  EvaluationFailureReason,
  EvaluationRunResponse,
  EvaluationSummary,
  LlmMode,
  ToolName,
} from "@/types";

const failureReasonLabels: Record<EvaluationFailureReason, string> = {
  scenario_mismatch: "Router 场景错误",
  intent_mismatch: "Intent 意图错误",
  tool_mismatch: "Tool 工具错误",
  rag_usage_mismatch: "RAG 使用错误",
  keyword_miss: "关键词未命中",
  citation_miss: "来源引用缺失",
  pipeline_error: "Pipeline 异常",
};

function pct(value: number) {
  return Number.isFinite(value) ? Math.round(value * 1000) / 10 : 0;
}

function expectedToolsIncluded(expected: ToolName[], actual: ToolName[]) {
  const actualSet = new Set(actual);
  return expected.every((tool) => actualSet.has(tool));
}

function uniqueTools(tools: ToolName[]) {
  return Array.from(new Set(tools));
}

function getToolsUsed(result: AgentApiResponse): ToolName[] {
  return uniqueTools([...result.toolResults.map((item) => item.tool), ...result.structuredOutput.toolsUsed]);
}

function getSources(result: AgentApiResponse) {
  return Array.from(new Set([...(result.ragAnswer?.sources.map((source) => source.title) ?? []), ...result.structuredOutput.sources]));
}

function includesKeyword(text: string, keywords: string[]) {
  if (keywords.length === 0) return true;
  const normalized = text.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
}

function usedRag(result: AgentApiResponse) {
  return Boolean(result.ragAnswer);
}

function collectFailureReasons(params: {
  scenarioMatched: boolean;
  intentMatched: boolean;
  toolsMatched: boolean;
  ragUsedMatched: boolean;
  keywordHit: boolean;
  citationHit: boolean;
  error?: string;
}): EvaluationFailureReason[] {
  const reasons: EvaluationFailureReason[] = [];
  if (!params.scenarioMatched) reasons.push("scenario_mismatch");
  if (!params.intentMatched) reasons.push("intent_mismatch");
  if (!params.toolsMatched) reasons.push("tool_mismatch");
  if (!params.ragUsedMatched) reasons.push("rag_usage_mismatch");
  if (!params.keywordHit) reasons.push("keyword_miss");
  if (!params.citationHit) reasons.push("citation_miss");
  if (params.error) reasons.push("pipeline_error");
  return reasons;
}

function summarizeFailure(reasons: EvaluationFailureReason[]) {
  if (reasons.length === 0) return undefined;
  return reasons.map((reason) => failureReasonLabels[reason]).join("、");
}

export function evaluateAgentResult(caseItem: EvaluationCase, pipelineResult: AgentApiResponse, durationMs: number): EvaluationCaseResult {
  const toolsUsed = getToolsUsed(pipelineResult);
  const sources = getSources(pipelineResult);
  const scenarioMatched = pipelineResult.route.scenario === caseItem.expectedScenario;
  const intentMatched = pipelineResult.route.intent === caseItem.expectedIntent;
  const toolsMatched = expectedToolsIncluded(caseItem.expectedTools, toolsUsed);
  const ragUsedMatched = usedRag(pipelineResult) === caseItem.expectedNeedRag;
  const keywordCorpus = [
    pipelineResult.finalAnswer,
    pipelineResult.structuredOutput.answer,
    ...pipelineResult.structuredOutput.evidence,
    ...pipelineResult.structuredOutput.sources,
    ...sources,
    ...toolsUsed,
  ].join(" ");
  const keywordHit = includesKeyword(keywordCorpus, caseItem.expectedKeywords);
  const citationHit = caseItem.expectedNeedRag ? sources.length > 0 : true;
  const error = pipelineResult.api.llmError ?? pipelineResult.api.parseError;
  const failureReasons = collectFailureReasons({ scenarioMatched, intentMatched, toolsMatched, ragUsedMatched, keywordHit, citationHit, error });
  const passed = failureReasons.length === 0;

  return {
    caseId: caseItem.id,
    question: caseItem.question,
    passed,
    scenarioMatched,
    intentMatched,
    toolsMatched,
    ragUsedMatched,
    keywordHit,
    citationHit,
    responseMode: pipelineResult.api.responseMode,
    durationMs,
    route: pipelineResult.route,
    toolsUsed,
    sources,
    finalAnswer: pipelineResult.finalAnswer,
    failureReasons,
    failureSummary: summarizeFailure(failureReasons),
    error,
  };
}

function emptyFailureBuckets(): Record<EvaluationFailureReason, number> {
  return {
    scenario_mismatch: 0,
    intent_mismatch: 0,
    tool_mismatch: 0,
    rag_usage_mismatch: 0,
    keyword_miss: 0,
    citation_miss: 0,
    pipeline_error: 0,
  };
}

export function summarizeEvaluation(results: EvaluationCaseResult[]): EvaluationSummary {
  const total = results.length;
  const count = (predicate: (item: EvaluationCaseResult) => boolean) => results.filter(predicate).length;
  const passed = count((item) => item.passed);
  const realCount = count((item) => item.responseMode === "real" || item.responseMode === "real_repaired" || item.responseMode === "real_text_fallback");
  const realSuccess = count((item) => item.responseMode === "real" || item.responseMode === "real_repaired");
  const jsonParseSuccess = count((item) => item.responseMode === "mock" || item.responseMode === "real" || item.responseMode === "real_repaired");
  const fallback = count((item) => item.responseMode === "fallback" || item.responseMode === "real_text_fallback");
  const averageDurationMs = total ? Math.round(results.reduce((sum, item) => sum + item.durationMs, 0) / total) : 0;
  const failureBuckets = emptyFailureBuckets();
  for (const result of results) {
    for (const reason of result.failureReasons) {
      failureBuckets[reason] += 1;
    }
  }

  return {
    total,
    passed,
    passRate: pct(total ? passed / total : 0),
    scenarioAccuracy: pct(total ? count((item) => item.scenarioMatched) / total : 0),
    intentAccuracy: pct(total ? count((item) => item.intentMatched) / total : 0),
    toolHitRate: pct(total ? count((item) => item.toolsMatched) / total : 0),
    ragUsageAccuracy: pct(total ? count((item) => item.ragUsedMatched) / total : 0),
    citationRate: pct(total ? count((item) => item.citationHit) / total : 0),
    keywordHitRate: pct(total ? count((item) => item.keywordHit) / total : 0),
    realSuccessRate: pct(realCount ? realSuccess / realCount : 0),
    jsonParseSuccessRate: pct(total ? jsonParseSuccess / total : 0),
    fallbackRate: pct(total ? fallback / total : 0),
    averageDurationMs,
    failureBuckets,
  };
}

function failedCaseResult(caseItem: EvaluationCase, durationMs: number, error: string): EvaluationCaseResult {
  return {
    caseId: caseItem.id,
    question: caseItem.question,
    passed: false,
    scenarioMatched: false,
    intentMatched: false,
    toolsMatched: false,
    ragUsedMatched: false,
    keywordHit: false,
    citationHit: false,
    responseMode: "fallback",
    durationMs,
    route: {
      scenario: "general",
      intent: "general_chat",
      needRag: false,
      toolsNeeded: [],
      confidence: 0,
      reason: "Evaluation case failed before route result was available.",
    },
    toolsUsed: [],
    sources: [],
    finalAnswer: "",
    failureReasons: ["pipeline_error"],
    failureSummary: failureReasonLabels.pipeline_error,
    error,
  };
}

export async function runEvaluationSuite(cases: EvaluationCase[] = evaluationCases, mode: LlmMode = "mock"): Promise<EvaluationRunResponse> {
  const startedAt = new Date();
  const results: EvaluationCaseResult[] = [];

  for (const caseItem of cases) {
    const caseStart = Date.now();
    try {
      const pipelineResult = await runAgentApiPipeline(caseItem.question, mode);
      results.push(evaluateAgentResult(caseItem, pipelineResult, Math.max(1, Date.now() - caseStart)));
    } catch (error) {
      results.push(failedCaseResult(caseItem, Math.max(1, Date.now() - caseStart), error instanceof Error ? error.message : "Unknown evaluation error."));
    }
  }

  const finishedAt = new Date();
  return {
    summary: summarizeEvaluation(results),
    results,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    mode,
  };
}