import type { AgentScenario } from "./common";
import type { AgentIntent, AgentResponseMode, AgentRoute, LlmMode } from "./agent";
import type { KnowledgePackId } from "./knowledge";
import type { ToolName } from "./tools";

export type EvaluationCase = {
  id: string;
  question: string;
  expectedScenario: AgentScenario;
  expectedIntent: AgentIntent;
  expectedTools: ToolName[];
  expectedNeedRag: boolean;
  expectedKeywords: string[];
  category: AgentScenario;
  difficulty: "easy" | "medium" | "hard";
  packId?: KnowledgePackId | "fallback";
};

export type EvaluationFailureReason =
  | "scenario_mismatch"
  | "intent_mismatch"
  | "tool_mismatch"
  | "rag_usage_mismatch"
  | "keyword_miss"
  | "citation_miss"
  | "pipeline_error";

export type EvaluationCaseResult = {
  caseId: string;
  question: string;
  passed: boolean;
  scenarioMatched: boolean;
  intentMatched: boolean;
  toolsMatched: boolean;
  ragUsedMatched: boolean;
  keywordHit: boolean;
  citationHit: boolean;
  ragScore: number;
  responseMode: AgentResponseMode;
  durationMs: number;
  route: AgentRoute;
  toolsUsed: ToolName[];
  sources: string[];
  finalAnswer: string;
  failureReasons: EvaluationFailureReason[];
  failureSummary?: string;
  error?: string;
};

export type EvaluationSummary = {
  total: number;
  caseCount: number;
  selectedSuite: "quick" | "standard" | "full" | "custom";
  passed: number;
  passRate: number;
  scenarioAccuracy: number;
  intentAccuracy: number;
  toolHitRate: number;
  ragUsageAccuracy: number;
  citationRate: number;
  keywordHitRate: number;
  realSuccessRate: number;
  jsonParseSuccessRate: number;
  fallbackRate: number;
  averageDurationMs: number;
  averageRagScore: number;
  fallbackCaseCount: number;
  packCoverage: Record<string, number>;
  failureBuckets: Record<EvaluationFailureReason, number>;
};

export type EvaluationRunResponse = {
  summary: EvaluationSummary;
  results: EvaluationCaseResult[];
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  mode: LlmMode;
  selectedSuite: "quick" | "standard" | "full" | "custom";
};
export type EvaluationRunHistoryItem = {
  id: string;
  createdAt: string;
  mode: "mock" | "real";
  suite: "quick" | "standard" | "full" | string;
  caseCount: number;
  passed: number;
  passRate: number;
  scenarioAccuracy: number;
  intentAccuracy: number;
  toolHitRate: number;
  ragUsageAccuracy: number;
  citationRate: number;
  keywordHitRate: number;
  fallbackRate?: number;
  averageRagScore?: number;
  failureSummary?: string;
  failureBuckets?: Record<string, number>;
  resultSnapshot?: unknown;
};

export type EvaluationMetric = {
  label: string;
  value: string;
  trend: string;
};

export type TestCase = {
  id: string;
  scenario: string;
  input: string;
  expectedTool: string;
  result: "pass" | "review";
  latency: string;
};
