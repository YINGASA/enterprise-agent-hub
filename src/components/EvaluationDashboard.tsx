"use client";

import { useMemo, useState } from "react";
import { evaluationCases } from "@/data/evaluation";
import type { AgentScenario, EvaluationFailureReason, EvaluationRunResponse, LlmMode } from "@/types";

type ScenarioFilter = "all" | AgentScenario;

const scenarioOptions: ScenarioFilter[] = ["all", "enterprise", "ecommerce", "recruitment"];

const metricLabels: Array<{ key: keyof Omit<EvaluationRunResponse["summary"], "failureBuckets">; label: string; suffix?: string }> = [
  { key: "total", label: "总用例数" },
  { key: "passRate", label: "通过率", suffix: "%" },
  { key: "scenarioAccuracy", label: "场景识别准确率", suffix: "%" },
  { key: "intentAccuracy", label: "意图识别准确率", suffix: "%" },
  { key: "toolHitRate", label: "工具调用命中率", suffix: "%" },
  { key: "ragUsageAccuracy", label: "RAG 使用准确率", suffix: "%" },
  { key: "citationRate", label: "来源引用率", suffix: "%" },
  { key: "keywordHitRate", label: "关键词命中率", suffix: "%" },
  { key: "realSuccessRate", label: "LLM 成功率", suffix: "%" },
  { key: "fallbackRate", label: "fallback 率", suffix: "%" },
  { key: "averageDurationMs", label: "平均耗时", suffix: "ms" },
];

const failureBucketLabels: Record<EvaluationFailureReason, { label: string; advice: string }> = {
  scenario_mismatch: { label: "Router 场景错误", advice: "检查 routeUserQuestion 的场景关键词和规则顺序。" },
  intent_mismatch: { label: "Intent 意图错误", advice: "检查意图关键词是否覆盖该表达方式。" },
  tool_mismatch: { label: "Tool 工具错误", advice: "检查 selectTools 或评测 expectedTools 是否符合业务链路。" },
  rag_usage_mismatch: { label: "RAG 使用错误", advice: "检查 route.needRag 或 RAG 查询增强规则。" },
  keyword_miss: { label: "关键词未命中", advice: "检查回答、证据、来源是否覆盖评测关键词，或评测关键词是否过窄。" },
  citation_miss: { label: "来源引用缺失", advice: "检查 RAG 是否召回 sources，或该 case 是否确实需要来源引用。" },
  pipeline_error: { label: "Pipeline 异常", advice: "检查 API、工具函数或 LLM fallback 是否抛错。" },
};

function formatMetric(value: number, suffix = "") {
  return `${value}${suffix}`;
}

function statusClass(passed: boolean) {
  return passed ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700";
}

function reasonAdvice(reasons: EvaluationFailureReason[]) {
  if (reasons.length === 0) return "当前用例通过，无需修复。";
  return reasons.map((reason) => failureBucketLabels[reason].advice).join(" ");
}

export function EvaluationDashboard() {
  const [mode, setMode] = useState<LlmMode>("mock");
  const [scenario, setScenario] = useState<ScenarioFilter>("all");
  const [result, setResult] = useState<EvaluationRunResponse | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [clientError, setClientError] = useState("");

  const selectedCaseIds = useMemo(
    () => evaluationCases.filter((caseItem) => scenario === "all" || caseItem.category === scenario).map((caseItem) => caseItem.id),
    [scenario],
  );

  const visibleResults = useMemo(
    () => result?.results.filter((item) => scenario === "all" || item.route.scenario === scenario || evaluationCases.find((caseItem) => caseItem.id === item.caseId)?.category === scenario) ?? [],
    [result, scenario],
  );

  const failedResults = useMemo(() => visibleResults.filter((item) => !item.passed), [visibleResults]);

  async function handleRun() {
    setIsLoading(true);
    setClientError("");
    setExpandedId(null);

    try {
      const response = await fetch("/api/evaluation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, caseIds: selectedCaseIds }),
      });

      if (!response.ok) {
        throw new Error(`Evaluation request failed: ${response.status}`);
      }

      const data = (await response.json()) as EvaluationRunResponse;
      setResult(data);
    } catch (error) {
      setClientError(error instanceof Error ? error.message : "Unknown evaluation error.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="w-full overflow-x-hidden">
      <section className="mb-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h2 className="font-semibold text-ink-900">评测控制台</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-500">
              默认 Mock 模式用于稳定验证 Router、RAG 和 Tools。Real API 模式会消耗 API 额度，建议按场景筛选后少量运行。
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1 text-sm">
              {(["mock", "real"] as LlmMode[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setMode(item)}
                  className={`min-h-10 rounded-md px-4 py-2 font-semibold transition ${mode === item ? "bg-white text-brand-700 shadow-sm" : "text-ink-600 hover:bg-white/70"}`}
                >
                  {item === "mock" ? "Mock 模式" : "Real API 模式"}
                </button>
              ))}
            </div>
            <select
              value={scenario}
              onChange={(event) => setScenario(event.target.value as ScenarioFilter)}
              className="min-h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-ink-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            >
              {scenarioOptions.map((item) => (
                <option key={item} value={item}>
                  {item === "all" ? "全部场景" : item}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleRun}
              disabled={isLoading}
              className="min-h-10 rounded-md bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:text-white"
            >
              {isLoading ? "评测中..." : "运行评测"}
            </button>
          </div>
        </div>
        {mode === "real" ? <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-700">Real API 模式会调用真实模型并消耗额度，建议先筛选 1 个场景运行。</p> : null}
        {clientError ? <p className="mt-3 break-words rounded-md bg-rose-50 p-3 text-sm text-rose-700">{clientError}</p> : null}
      </section>

      {result ? (
        <section className="mb-6 grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">
          {metricLabels.map((metric) => (
            <article key={metric.key} className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs text-ink-500">{metric.label}</p>
              <p className="mt-2 break-words text-2xl font-semibold text-ink-900">{formatMetric(Number(result.summary[metric.key]), metric.suffix)}</p>
            </article>
          ))}
        </section>
      ) : (
        <section className="mb-6 grid min-w-0 gap-4 md:grid-cols-3">
          <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-ink-500">内置测试集</p>
            <p className="mt-2 text-2xl font-semibold text-ink-900">{selectedCaseIds.length}</p>
          </article>
          <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-ink-500">默认模式</p>
            <p className="mt-2 text-2xl font-semibold text-ink-900">Mock</p>
          </article>
          <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-ink-500">覆盖场景</p>
            <p className="mt-2 text-2xl font-semibold text-ink-900">3</p>
          </article>
        </section>
      )}

      {result ? (
        <section className="mb-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-ink-900">失败分析</h2>
              <p className="mt-1 text-sm text-ink-500">按失败原因分桶，帮助定位 Router、RAG、Tools 或评测规则问题。</p>
            </div>
            <span className={`rounded-md px-2.5 py-1 text-xs font-semibold ${failedResults.length === 0 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
              {failedResults.length === 0 ? "当前评测集全部通过" : `${failedResults.length} 条失败`}
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {(Object.keys(failureBucketLabels) as EvaluationFailureReason[]).map((reason) => (
              <article key={reason} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs text-ink-500">{failureBucketLabels[reason].label}</p>
                <p className="mt-2 text-2xl font-semibold text-ink-900">{result.summary.failureBuckets[reason]}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-ink-900">评测结果</h2>
          <p className="mt-1 text-sm text-ink-500">
            {result ? `本次运行 ${visibleResults.length} 条，模式 ${result.mode}，耗时 ${result.durationMs}ms。` : "点击运行评测后展示逐条结果。"}
          </p>
        </div>
        <div className="max-w-full overflow-x-auto">
          <table className="min-w-[1280px] divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-4 py-3">问题</th>
                <th className="px-4 py-3">场景</th>
                <th className="px-4 py-3">意图</th>
                <th className="px-4 py-3">工具</th>
                <th className="px-4 py-3">通过</th>
                <th className="px-4 py-3">失败原因</th>
                <th className="px-4 py-3">responseMode</th>
                <th className="px-4 py-3">耗时</th>
                <th className="px-4 py-3">详情</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {(result ? visibleResults : []).map((item) => {
                const caseItem = evaluationCases.find((candidate) => candidate.id === item.caseId);
                const expanded = expandedId === item.caseId;
                return (
                  <tr key={item.caseId} className="align-top">
                    <td className="min-w-[240px] px-4 py-4 text-ink-700">
                      <p className="break-words font-medium">{item.question}</p>
                      <p className="mt-1 font-mono text-xs text-ink-400">{item.caseId}</p>
                    </td>
                    <td className="px-4 py-4 text-xs text-ink-600">
                      <p>预期：{caseItem?.expectedScenario ?? "-"}</p>
                      <p className={item.scenarioMatched ? "text-emerald-700" : "text-rose-700"}>实际：{item.route.scenario}</p>
                    </td>
                    <td className="px-4 py-4 text-xs text-ink-600">
                      <p>预期：{caseItem?.expectedIntent ?? "-"}</p>
                      <p className={item.intentMatched ? "text-emerald-700" : "text-rose-700"}>实际：{item.route.intent}</p>
                    </td>
                    <td className="min-w-[190px] px-4 py-4 text-xs text-ink-600">
                      <p className="break-words">预期：{caseItem?.expectedTools.join(", ") || "无"}</p>
                      <p className="break-words">实际：{item.toolsUsed.join(", ") || "无"}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`rounded-md px-2.5 py-1 text-xs font-semibold ${statusClass(item.passed)}`}>{item.passed ? "pass" : "fail"}</span>
                    </td>
                    <td className="min-w-[180px] px-4 py-4 text-xs text-ink-600">
                      <span className="break-words">{item.failureSummary ?? "无"}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 font-mono text-xs text-brand-700">{item.responseMode}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-ink-500">{item.durationMs}ms</td>
                    <td className="px-4 py-4">
                      <button type="button" onClick={() => setExpandedId(expanded ? null : item.caseId)} className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-ink-600 hover:bg-slate-50">
                        {expanded ? "收起" : "展开"}
                      </button>
                      {expanded ? (
                        <div className="mt-3 w-[460px] max-w-[70vw] rounded-md bg-slate-50 p-3 text-xs leading-5 text-ink-700">
                          <p className="font-semibold text-ink-900">failureReasons</p>
                          <p className="mt-1 break-words">{item.failureReasons.join(", ") || "无"}</p>
                          <p className="mt-3 font-semibold text-ink-900">修复建议</p>
                          <p className="mt-1 break-words">{reasonAdvice(item.failureReasons)}</p>
                          <p className="mt-3 font-semibold text-ink-900">预期 vs 实际</p>
                          <p className="mt-1 break-words">场景：{caseItem?.expectedScenario} / {item.route.scenario}</p>
                          <p className="break-words">意图：{caseItem?.expectedIntent} / {item.route.intent}</p>
                          <p className="break-words">工具：{caseItem?.expectedTools.join(", ") || "无"} / {item.toolsUsed.join(", ") || "无"}</p>
                          <p className="mt-3 font-semibold text-ink-900">finalAnswer</p>
                          <p className="mt-1 whitespace-pre-wrap break-words">{item.finalAnswer}</p>
                          <p className="mt-3 font-semibold text-ink-900">sources</p>
                          <p className="mt-1 break-words">{item.sources.join(", ") || "无"}</p>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
              {!result ? (
                <tr>
                  <td colSpan={9} className="px-5 py-10 text-center text-sm text-ink-500">
                    选择模式并点击“运行评测”。Mock 模式会运行全部内置用例，Real API 模式建议先按场景筛选。
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}