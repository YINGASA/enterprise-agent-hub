import { evaluationCases } from "@/data/evaluation";
import { runAgentApiPipeline } from "@/lib/agent/api";
import type { AgentApiResponse, EvaluationCase, EvaluationCaseResult, EvaluationRunResponse, EvaluationSummary, LlmMode, ToolName } from "@/types";

function pct(value: number) {
  return Number.isFinite(value) ? Math.round(value * 1000) / 10 : 0;
}

function sameToolSet(expected: ToolName[], actual: ToolName[]) {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  return expected.every((tool) => actualSet.has(tool)) && actual.every((tool) => expectedSet.has(tool));
}

function uniqueTools(tools: ToolName[]) {
  return Array.from(new Set(tools));
}

function getToolsUsed(result: AgentApiResponse): ToolName[] {
  return uniqueTools([
    ...result.toolResults.map((item) => item.tool),
    ...result.structuredOutput.toolsUsed,
  ]);
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
  return Boolean(result.ragAnswer && result.ragAnswer.retrievedChunks.length > 0);
}

export function evaluateAgentResult(caseItem: EvaluationCase, pipelineResult: AgentApiResponse, durationMs: number): EvaluationCaseResult {
  const toolsUsed = getToolsUsed(pipelineResult);
  const sources = getSources(pipelineResult);
  const scenarioMatched = pipelineResult.route.scenario === caseItem.expectedScenario;
  const intentMatched = pipelineResult.route.intent === caseItem.expectedIntent;
  const toolsMatched = sameToolSet(caseItem.expectedTools, toolsUsed);
  const ragUsedMatched = usedRag(pipelineResult) === caseItem.expectedNeedRag;
  const keywordHit = includesKeyword(`${pipelineResult.finalAnswer} ${pipelineResult.structuredOutput.evidence.join(" ")}`, caseItem.expectedKeywords);
  const citationHit = caseItem.expectedNeedRag ? sources.length > 0 : true;
  const passed = scenarioMatched && intentMatched && toolsMatched && ragUsedMatched && keywordHit && citationHit;

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
    error: pipelineResult.api.llmError ?? pipelineResult.api.parseError,
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