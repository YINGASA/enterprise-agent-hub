"use client";

import { useMemo, useState } from "react";
import { knowledgePacks } from "@/data/knowledgePacks";
import type { EvaluationFailureReason, EvaluationRunResponse, LlmMode } from "@/types";

type SuiteOption = "quick" | "standard" | "full";
type PackFilter = "all" | string;

const suiteOptions: Array<{ value: SuiteOption; label: string; description: string }> = [
  { value: "quick", label: "快速评测 15 条", description: "适合开发中快速检查" },
  { value: "standard", label: "标准评测 30 条", description: "覆盖前三类主场景" },
  { value: "full", label: "完整评测 50 条", description: "覆盖知识库包和兜底问题" },
];
const packOptions = [{ id: "all", name: "全部知识库包" }, ...knowledgePacks, { id: "fallback", name: "兜底/异常问题" }];
const metricLabels: Array<{ key: keyof Omit<EvaluationRunResponse["summary"], "failureBuckets" | "packCoverage" | "selectedSuite">; label: string; suffix?: string }> = [
  { key: "caseCount", label: "用例数" }, { key: "passRate", label: "通过率", suffix: "%" }, { key: "scenarioAccuracy", label: "场景识别", suffix: "%" }, { key: "intentAccuracy", label: "意图识别", suffix: "%" }, { key: "toolHitRate", label: "工具命中", suffix: "%" }, { key: "ragUsageAccuracy", label: "RAG 使用", suffix: "%" }, { key: "citationRate", label: "来源引用", suffix: "%" }, { key: "keywordHitRate", label: "关键词命中", suffix: "%" }, { key: "averageRagScore", label: "平均 RAG 分" }, { key: "fallbackCaseCount", label: "兜底用例数" }, { key: "fallbackRate", label: "fallback 率", suffix: "%" }, { key: "averageDurationMs", label: "平均耗时", suffix: "ms" },
];
const failureBucketLabels: Record<EvaluationFailureReason, { label: string; advice: string }> = {
  scenario_mismatch: { label: "Router 场景错误", advice: "检查 routeUserQuestion 的场景关键词和规则顺序。" },
  intent_mismatch: { label: "Intent 意图错误", advice: "检查意图关键词是否覆盖该表达方式。" },
  tool_mismatch: { label: "Tool 工具错误", advice: "检查 selectTools 或 expectedTools 是否符合业务链路。" },
  rag_usage_mismatch: { label: "RAG 使用错误", advice: "检查 route.needRag 或 pack-aware retrieval。" },
  keyword_miss: { label: "关键词未命中", advice: "检查回答、证据、来源或评测关键词。" },
  citation_miss: { label: "来源引用缺失", advice: "检查 RAG 召回 sources。" },
  pipeline_error: { label: "Pipeline 异常", advice: "检查 API、工具函数或 fallback。" },
};
function formatMetric(value: number, suffix = "") { return String(value) + suffix; }
function statusClass(passed: boolean) { return passed ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"; }
function buttonClass(active: boolean) { return "rounded-md px-3 py-2 text-sm font-semibold transition " + (active ? "bg-brand-600 text-white" : "bg-slate-100 text-ink-600 hover:bg-slate-200"); }
function reasonAdvice(reasons: EvaluationFailureReason[]) { return reasons.length === 0 ? "当前用例通过，无需修复。" : reasons.map((reason) => failureBucketLabels[reason].advice).join(" "); }

export function EvaluationDashboard() {
  const [mode, setMode] = useState<LlmMode>("mock");
  const [suite, setSuite] = useState<SuiteOption>("full");
  const [packId, setPackId] = useState<PackFilter>("all");
  const [result, setResult] = useState<EvaluationRunResponse | null>(null);
  const [expandedId, setExpandedId] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState("");
  const filteredResults = useMemo(() => result?.results ?? [], [result]);
  const failedResults = filteredResults.filter((item) => !item.passed);

  async function runEvaluation() {
    setIsRunning(true); setError("");
    try {
      const response = await fetch("/api/evaluation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, suite, packId }) });
      if (!response.ok) throw new Error("Evaluation API failed: " + response.status);
      setResult((await response.json()) as EvaluationRunResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown evaluation error.");
    } finally { setIsRunning(false); }
  }

  return <div className="space-y-6 overflow-x-hidden">
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><h2 className="text-lg font-semibold text-ink-900">V0.9 Agent Evaluation Dashboard</h2><p className="mt-1 text-sm leading-6 text-ink-500">支持 15/30/50 条测试集、知识库包筛选、失败原因分桶和 RAG 评分统计。Real 模式会消耗 API 额度，默认建议使用 Mock。</p></div><button type="button" onClick={runEvaluation} disabled={isRunning} className="min-h-10 rounded-md bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-400">{isRunning ? "评测中..." : "运行评测"}</button></div>
      <div className="mt-5 grid gap-4 lg:grid-cols-3"><div><p className="mb-2 text-xs font-semibold text-ink-500">模式</p><div className="flex flex-wrap gap-2">{(["mock", "real"] as LlmMode[]).map((item) => <button key={item} type="button" onClick={() => setMode(item)} className={buttonClass(mode === item)}>{item === "mock" ? "Mock 模式" : "Real API 模式"}</button>)}</div></div><div><p className="mb-2 text-xs font-semibold text-ink-500">测试集规模</p><div className="flex flex-wrap gap-2">{suiteOptions.map((item) => <button key={item.value} type="button" onClick={() => setSuite(item.value)} className={buttonClass(suite === item.value)}>{item.label}</button>)}</div></div><div><p className="mb-2 text-xs font-semibold text-ink-500">知识库包</p><select value={packId} onChange={(event) => setPackId(event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100">{packOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div></div>
      {error ? <p className="mt-4 rounded-md bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}</section>
    {result ? <><section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metricLabels.map((metric) => <article key={metric.key} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs text-ink-500">{metric.label}</p><p className="mt-2 text-2xl font-semibold text-ink-900">{formatMetric(Number(result.summary[metric.key]), metric.suffix)}</p></article>)}</section>
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-3 font-semibold text-ink-900">知识库包覆盖</h2><div className="flex flex-wrap gap-2">{Object.entries(result.summary.packCoverage).map(([key, value]) => <span key={key} className="rounded-md bg-slate-50 px-3 py-1.5 text-xs text-ink-600 ring-1 ring-slate-200">{key}: {value}</span>)}</div></section>
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-3 font-semibold text-ink-900">失败分析</h2><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Object.entries(result.summary.failureBuckets).map(([reason, count]) => <article key={reason} className="rounded-md bg-slate-50 p-3"><p className="text-xs text-ink-500">{failureBucketLabels[reason as EvaluationFailureReason].label}</p><p className="mt-1 text-lg font-semibold text-ink-900">{count}</p></article>)}</div>{failedResults.length === 0 ? <p className="mt-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">当前评测集全部通过。</p> : null}</section>
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 p-5"><h2 className="font-semibold text-ink-900">评测结果</h2><p className="mt-1 text-sm text-ink-500">当前返回 {filteredResults.length} 条结果，长回答可展开查看。</p></div><div className="overflow-x-auto"><table className="min-w-[1100px] divide-y divide-slate-200 text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-ink-500"><tr><th className="px-4 py-3">问题</th><th className="px-4 py-3">实际场景/意图</th><th className="px-4 py-3">工具</th><th className="px-4 py-3">通过</th><th className="px-4 py-3">responseMode</th><th className="px-4 py-3">RAG 分</th><th className="px-4 py-3">耗时</th><th className="px-4 py-3">错误</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredResults.map((item) => <tr key={item.caseId} className="align-top"><td className="max-w-[320px] px-4 py-3"><button type="button" onClick={() => setExpandedId(expandedId === item.caseId ? "" : item.caseId)} className="break-words text-left font-medium text-ink-900 hover:text-brand-700">{item.question}</button>{expandedId === item.caseId ? <div className="mt-3 rounded-md bg-slate-50 p-3 text-xs leading-5 text-ink-600"><p>failureReasons：{item.failureReasons.length ? item.failureReasons.join(", ") : "无"}</p><p>failureSummary：{item.failureSummary ?? "无"}</p><p>修复建议：{reasonAdvice(item.failureReasons)}</p><p className="mt-2 break-words">sources：{item.sources.join("、") || "无"}</p><p className="mt-2 whitespace-pre-wrap break-words">{item.finalAnswer}</p></div> : null}</td><td className="px-4 py-3 text-ink-600">{item.route.scenario}<br />{item.route.intent}</td><td className="px-4 py-3 text-ink-600">{item.toolsUsed.join(" + ") || "无"}</td><td className="px-4 py-3"><span className={"rounded-md px-2 py-1 text-xs font-semibold " + statusClass(item.passed)}>{item.passed ? "pass" : "failed"}</span></td><td className="px-4 py-3 text-ink-600">{item.responseMode}</td><td className="px-4 py-3 text-ink-600">{item.ragScore}</td><td className="px-4 py-3 text-ink-600">{item.durationMs}ms</td><td className="max-w-[220px] break-words px-4 py-3 text-rose-600">{item.error ?? ""}</td></tr>)}</tbody></table></div></section></> : <p className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-ink-500">选择测试集规模后点击“运行评测”。</p>}
  </div>;
}
