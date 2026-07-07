"use client";

import { useEffect, useMemo, useState } from "react";
import { EvaluationReportPreview } from "@/components/EvaluationReportPreview";
import { EvaluationTrendChart } from "@/components/EvaluationTrendChart";
import { ChatFeedbackStatsPanel } from "@/components/ChatFeedbackStatsPanel";
import { knowledgePacks } from "@/data/knowledgePacks";
import {
  clearEvaluationHistory,
  createEvaluationHistoryItem,
  deleteEvaluationRun,
  downloadTextFile,
  exportEvaluationAsJson,
  exportEvaluationAsMarkdown,
  getEvaluationReportFileName,
  loadEvaluationHistory,
  saveEvaluationRun,
} from "@/lib/evaluation/history";
import type { EvaluationFailureReason, EvaluationRunHistoryItem, EvaluationRunResponse, LlmMode } from "@/types";

type SuiteOption = "quick" | "standard" | "full";
type PackFilter = "all" | string;
type ReportPreviewState = { kind: "markdown" | "json"; title: string; content: string; run: EvaluationRunHistoryItem } | null;
type LlmHealthSnapshot = {
  configured: boolean;
  healthy: boolean;
  durationMs?: number;
  errorType?: string;
  message?: string;
};

const suiteOptions: Array<{ value: SuiteOption; label: string; description: string }> = [
  { value: "quick", label: "快速 15 条", description: "快速回归检查" },
  { value: "standard", label: "标准 30 条", description: "覆盖主要业务场景" },
  { value: "full", label: "完整 80条", description: "覆盖全部内置评测用例" },
];

const packOptions = [{ id: "all", name: "全部知识库" }, ...knowledgePacks, { id: "fallback", name: "兜底 / 超出范围" }];

const metricLabels: Array<{ key: keyof Pick<EvaluationRunResponse["summary"], "caseCount" | "passRate" | "scenarioAccuracy" | "intentAccuracy" | "toolHitRate" | "ragUsageAccuracy" | "citationRate" | "keywordHitRate" | "averageRagScore" | "fallbackCaseCount" | "fallbackRate" | "averageDurationMs">; label: string; suffix?: string }> = [
  { key: "caseCount", label: "用例数" },
  { key: "passRate", label: "通过率", suffix: "%" },
  { key: "scenarioAccuracy", label: "场景识别", suffix: "%" },
  { key: "intentAccuracy", label: "意图识别", suffix: "%" },
  { key: "toolHitRate", label: "工具命中", suffix: "%" },
  { key: "ragUsageAccuracy", label: "RAG 使用", suffix: "%" },
  { key: "citationRate", label: "来源引用", suffix: "%" },
  { key: "keywordHitRate", label: "关键词命中", suffix: "%" },
  { key: "averageRagScore", label: "平均 RAG 分" },
  { key: "fallbackCaseCount", label: "兜底用例数" },
  { key: "fallbackRate", label: "兜底率", suffix: "%" },
  { key: "averageDurationMs", label: "平均耗时", suffix: "ms" },
];

const failureBucketLabels: Record<EvaluationFailureReason, { label: string; advice: string }> = {
  scenario_mismatch: { label: "场景识别错误", advice: "检查 routeUserQuestion 的场景关键词和规则顺序。" },
  intent_mismatch: { label: "意图识别错误", advice: "检查意图关键词和边界表达。" },
  tool_mismatch: { label: "工具调用不匹配", advice: "检查 selectTools 或 expectedTools 是否符合业务链路。" },
  rag_usage_mismatch: { label: "RAG 使用不匹配", advice: "检查 route.needRag 和知识库包优先检索。" },
  keyword_miss: { label: "关键词未命中", advice: "检查回答、证据、来源或预期关键词。" },
  citation_miss: { label: "来源引用缺失", advice: "检查 RAG sources 和来源聚合逻辑。" },
  pipeline_error: { label: "Pipeline 异常", advice: "检查 API、本地工具函数或 fallback 处理。" },
};

function formatMetric(value: number, suffix = "") {
  return String(value) + suffix;
}

function statusClass(passed: boolean) {
  return passed ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700";
}

function buttonClass(active: boolean) {
  return "rounded-md px-3 py-2 text-sm font-semibold transition " + (active ? "bg-brand-600 text-white" : "bg-slate-100 text-ink-600 hover:bg-slate-200");
}

function secondaryButtonClass() {
  return "min-h-10 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-brand-50 hover:text-brand-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-ink-400";
}

function reasonAdvice(reasons: EvaluationFailureReason[]) {
  return reasons.length === 0 ? "当前用例通过。" : reasons.map((reason) => failureBucketLabels[reason].advice).join(" ");
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function avg(values: number[]) {
  return values.length ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10 : 0;
}

function displayValue(value: number | undefined, suffix = "") {
  return typeof value === "number" ? `${value}${suffix}` : "暂无数据";
}

function suiteLabel(value: string) {
  if (value === "quick") return "快速 15 条";
  if (value === "standard") return "标准 30 条";
  if (value === "full") return "完整 80条";
  return value;
}

function historyModeLabel(mode: LlmMode) {
  return mode === "real" ? "Real API" : "Mock 模式";
}

function triggerMarkdownDownload(run: EvaluationRunHistoryItem) {
  downloadTextFile(getEvaluationReportFileName("md"), exportEvaluationAsMarkdown(run), "text/markdown;charset=utf-8");
}

function triggerJsonDownload(run: EvaluationRunHistoryItem) {
  downloadTextFile(getEvaluationReportFileName("json"), exportEvaluationAsJson(run), "application/json;charset=utf-8");
}

function failureBucketText(item: EvaluationRunHistoryItem) {
  const buckets = item.failureBuckets ?? {};
  return Object.keys(buckets).length ? JSON.stringify(buckets, null, 2) : "暂无失败原因分桶";
}

export function EvaluationDashboard() {
  const [mode, setMode] = useState<LlmMode>("mock");
  const [suite, setSuite] = useState<SuiteOption>("full");
  const [packId, setPackId] = useState<PackFilter>("all");
  const [result, setResult] = useState<EvaluationRunResponse | null>(null);
  const [history, setHistory] = useState<EvaluationRunHistoryItem[]>([]);
  const [expandedCaseId, setExpandedCaseId] = useState("");
  const [expandedHistoryId, setExpandedHistoryId] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState("");
  const [historyMessage, setHistoryMessage] = useState("");
  const [preview, setPreview] = useState<ReportPreviewState>(null);
  const [llmHealth, setLlmHealth] = useState<LlmHealthSnapshot | null>(null);
  const [llmHealthMessage, setLlmHealthMessage] = useState("");

  useEffect(() => {
    const loaded = loadEvaluationHistory();
    setHistory(loaded.data);
    if (!loaded.ok) setHistoryMessage(loaded.error);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadHealth() {
      try {
        const response = await fetch("/api/llm/health", { method: "GET" });
        const data = (await response.json()) as LlmHealthSnapshot;
        if (!cancelled) setLlmHealth(data);
      } catch (error) {
        if (!cancelled) {
          setLlmHealthMessage(error instanceof Error ? error.message : "无法读取 Real API 健康状态。");
        }
      }
    }

    loadHealth();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredResults = useMemo(() => result?.results ?? [], [result]);
  const failedResults = filteredResults.filter((item) => !item.passed);
  const currentRun = useMemo(() => (result ? createEvaluationHistoryItem(result) : null), [result]);
  const latest = history[0];
  const previous = history[1];
  const recentFiveAverage = avg(history.slice(0, 5).map((item) => item.passRate));
  const passRateDelta = latest && previous ? Math.round((latest.passRate - previous.passRate) * 10) / 10 : null;
  const latestMockRun = history.find((item) => item.mode === "mock");
  const realApiHealthLabel = llmHealth
    ? !llmHealth.configured
      ? "Real API 未配置"
      : llmHealth.healthy
        ? "Real API 连接正常"
        : "Real API 连接失败"
    : llmHealthMessage || "正在检查 Real API 状态";
  const realApiHealthClass = llmHealth?.healthy
    ? "border-emerald-100 bg-emerald-50 text-emerald-800"
    : llmHealth?.configured
      ? "border-amber-100 bg-amber-50 text-amber-800"
      : "border-slate-200 bg-slate-50 text-ink-700";

  async function runEvaluation() {
    setIsRunning(true);
    setError("");
    setHistoryMessage("");
    try {
      const response = await fetch("/api/evaluation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, suite, packId }) });
      if (!response.ok) throw new Error("Evaluation API 失败: " + response.status);
      setResult((await response.json()) as EvaluationRunResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown evaluation error.");
    } finally {
      setIsRunning(false);
    }
  }

  function handleSave() {
    if (!result) return;
    const saved = saveEvaluationRun(result);
    setHistory(saved.data);
    setHistoryMessage(saved.ok ? "已将本次评测保存到浏览器本地。" : saved.error);
  }

  function handleDelete(id: string) {
    const next = deleteEvaluationRun(id);
    setHistory(next.data);
    setExpandedHistoryId("");
    setHistoryMessage(next.ok ? "已删除一条历史记录。" : next.error);
  }

  function handleClear() {
    if (!window.confirm("确认清空所有本地评测历史吗？")) return;
    const next = clearEvaluationHistory();
    setHistory(next.data);
    setExpandedHistoryId("");
    setHistoryMessage(next.ok ? "已清空本地评测历史。" : next.error);
  }

  function openMarkdownPreview(run: EvaluationRunHistoryItem) {
    setPreview({ kind: "markdown", title: "Markdown 报告", content: exportEvaluationAsMarkdown(run), run });
  }

  function openJsonPreview(run: EvaluationRunHistoryItem) {
    setPreview({ kind: "json", title: "JSON 报告", content: exportEvaluationAsJson(run), run });
  }

  return <div className="space-y-6 overflow-x-hidden">
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ink-900">V1.4 Agent 评测面板</h2>
          <p className="mt-1 text-sm leading-6 text-ink-500">用于持续验证 Agent Router、Hybrid RAG、Tool Calling、fallback 与结构化输出质量。评测结果可保存到浏览器本地，查看趋势图表，并预览或导出 Markdown / JSON 报告。</p>
        </div>
        <button type="button" onClick={runEvaluation} disabled={isRunning} className="min-h-10 rounded-md bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-400">{isRunning ? "评测中..." : "运行评测"}</button>
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div><p className="mb-2 text-xs font-semibold text-ink-500">评测模式</p><div className="flex flex-wrap gap-2">{(["mock", "real"] as LlmMode[]).map((item) => <button key={item} type="button" onClick={() => setMode(item)} className={buttonClass(mode === item)}>{item === "mock" ? "Mock 模式" : "Real API"}</button>)}</div>{mode === "real" ? <p className="mt-2 text-xs text-amber-700">Real API 模式可能消耗 API 额度。</p> : null}</div>
        <div><p className="mb-2 text-xs font-semibold text-ink-500">测试集规模</p><div className="flex flex-wrap gap-2">{suiteOptions.map((item) => <button key={item.value} type="button" title={item.description} onClick={() => setSuite(item.value)} className={buttonClass(suite === item.value)}>{item.label}</button>)}</div></div>
        <div><p className="mb-2 text-xs font-semibold text-ink-500">知识库范围</p><select value={packId} onChange={(event) => setPackId(event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100">{packOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
      </div>
      {error ? <p className="mt-4 rounded-md bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
      {historyMessage ? <p className="mt-4 rounded-md bg-brand-50 p-3 text-sm text-brand-700">{historyMessage}</p> : null}
    </section>

    <section className="grid gap-4 lg:grid-cols-2">
      <article className={"rounded-lg border p-5 shadow-sm " + realApiHealthClass}>
        <p className="text-xs font-semibold uppercase tracking-wide">Real API 健康状态</p>
        <h3 className="mt-2 text-lg font-semibold">{realApiHealthLabel}</h3>
        <p className="mt-2 text-sm leading-6">
          {llmHealth?.healthy
            ? `真实模型链路可用，最近一次检查耗时 ${llmHealth.durationMs ?? 0}ms。`
            : llmHealth?.configured
              ? "模型服务已配置但连接未通过。Real 评测可能失败或走兜底，Mock 回归不受影响。"
              : "当前环境未配置模型服务；Real 评测不可用，仍可使用 Mock 完整回归验证核心链路。"}
        </p>
        {llmHealth?.errorType ? <p className="mt-2 break-words text-xs">错误类型：{llmHealth.errorType}</p> : null}
      </article>
      <article className="rounded-lg border border-brand-100 bg-brand-50 p-5 text-brand-800 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide">Mock 回归摘要</p>
        <h3 className="mt-2 text-lg font-semibold">{latestMockRun ? `最近 Mock：${latestMockRun.passed}/${latestMockRun.caseCount}` : "建议先运行完整 80 条 Mock 回归"}</h3>
        <p className="mt-2 text-sm leading-6">
          Mock 回归用于验证 Agent Router、Hybrid RAG、Tool Calling、fallback、结构化输出和引用链路，不依赖外部模型服务。
        </p>
        <p className="mt-2 text-xs">目标：完整评测 80/80 或 passRate ≥ 90%。</p>
      </article>
    </section>

    {result ? <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metricLabels.map((metric) => <article key={metric.key} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs text-ink-500">{metric.label}</p><p className="mt-2 text-2xl font-semibold text-ink-900">{formatMetric(Number(result.summary[metric.key]), metric.suffix)}</p></article>)}</section>
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div><h2 className="font-semibold text-ink-900">当前评测结果</h2><p className="mt-1 text-sm text-ink-500">开始：{formatDate(result.startedAt)}{" · "}完成：{formatDate(result.finishedAt)}{" · "}耗时：{result.durationMs}ms</p></div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={handleSave} className={secondaryButtonClass()}>保存本次评测</button>
            <button type="button" onClick={() => currentRun && openMarkdownPreview(currentRun)} disabled={!currentRun} className={secondaryButtonClass()}>预览 Markdown</button>
            <button type="button" onClick={() => currentRun && openJsonPreview(currentRun)} disabled={!currentRun} className={secondaryButtonClass()}>预览 JSON</button>
            <button type="button" onClick={() => currentRun && triggerMarkdownDownload(currentRun)} disabled={!currentRun} className={secondaryButtonClass()}>导出 Markdown</button>
            <button type="button" onClick={() => currentRun && triggerJsonDownload(currentRun)} disabled={!currentRun} className={secondaryButtonClass()}>导出 JSON</button>
          </div>
        </div>
      </section>
      {preview ? <EvaluationReportPreview kind={preview.kind} title={preview.title} content={preview.content} onClose={() => setPreview(null)} onDownload={() => preview.kind === "markdown" ? triggerMarkdownDownload(preview.run) : triggerJsonDownload(preview.run)} /> : null}
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-3 font-semibold text-ink-900">知识库覆盖</h2><div className="flex flex-wrap gap-2">{Object.entries(result.summary.packCoverage).map(([key, value]) => <span key={key} className="rounded-md bg-slate-50 px-3 py-1.5 text-xs text-ink-600 ring-1 ring-slate-200">{key}: {value}</span>)}</div></section>
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-3 font-semibold text-ink-900">失败分析</h2><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Object.entries(result.summary.failureBuckets).map(([reason, count]) => <article key={reason} className="rounded-md bg-slate-50 p-3"><p className="text-xs text-ink-500">{failureBucketLabels[reason as EvaluationFailureReason].label}</p><p className="mt-1 text-lg font-semibold text-ink-900">{count}</p></article>)}</div>{failedResults.length === 0 ? <p className="mt-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">当前评测集全部通过。</p> : null}</section>
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 p-5"><h2 className="font-semibold text-ink-900">评测结果</h2><p className="mt-1 text-sm text-ink-500">当前返回 {filteredResults.length} 条用例结果，可展开问题查看回答和失败原因。</p></div><div className="overflow-x-auto"><table className="min-w-[1100px] divide-y divide-slate-200 text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-ink-500"><tr><th className="px-4 py-3">问题</th><th className="px-4 py-3">实际场景 / 意图</th><th className="px-4 py-3">工具</th><th className="px-4 py-3">是否通过</th><th className="px-4 py-3">responseMode</th><th className="px-4 py-3">RAG 分</th><th className="px-4 py-3">耗时</th><th className="px-4 py-3">错误</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredResults.map((item) => <tr key={item.caseId} className="align-top"><td className="max-w-[320px] px-4 py-3"><button type="button" onClick={() => setExpandedCaseId(expandedCaseId === item.caseId ? "" : item.caseId)} className="break-words text-left font-medium text-ink-900 hover:text-brand-700">{item.question}</button>{expandedCaseId === item.caseId ? <div className="mt-3 rounded-md bg-slate-50 p-3 text-xs leading-5 text-ink-600"><p>失败原因：{item.failureReasons.length ? item.failureReasons.join(", ") : "无"}</p><p>失败摘要：{item.failureSummary ?? "无"}</p><p>修复建议：{reasonAdvice(item.failureReasons)}</p><p className="mt-2 break-words">来源：{item.sources.join(" / ") || "无"}</p><p className="mt-2 whitespace-pre-wrap break-words">{item.finalAnswer}</p></div> : null}</td><td className="px-4 py-3 text-ink-600">{item.route.scenario}<br />{item.route.intent}</td><td className="px-4 py-3 text-ink-600">{item.toolsUsed.join(" + ") || "无"}</td><td className="px-4 py-3"><span className={"rounded-md px-2 py-1 text-xs font-semibold " + statusClass(item.passed)}>{item.passed ? "通过" : "失败"}</span></td><td className="px-4 py-3 text-ink-600">{item.responseMode}</td><td className="px-4 py-3 text-ink-600">{item.ragScore}</td><td className="px-4 py-3 text-ink-600">{item.durationMs}ms</td><td className="max-w-[220px] break-words px-4 py-3 text-rose-600">{item.error ?? ""}</td></tr>)}</tbody></table></div></section>
    </> : <p className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-ink-500">请选择测试集规模并运行评测。评测结果、历史记录和报告导出操作会显示在这里。</p>}

    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="font-semibold text-ink-900">趋势摘要</h2><p className="mt-1 text-sm text-ink-500">评测历史保存在当前浏览器本地，最多保留最近 20 次记录。</p></div>{history.length ? <button type="button" onClick={handleClear} className={secondaryButtonClass()}>清空历史</button> : null}</div>
      <div className="mt-4 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <article className="rounded-md bg-slate-50 p-3"><p className="text-xs text-ink-500">最近通过率</p><p className="mt-1 text-xl font-semibold text-ink-900">{latest ? latest.passRate + "%" : "暂无数据"}</p></article>
        <article className="rounded-md bg-slate-50 p-3"><p className="text-xs text-ink-500">较上次变化</p><p className="mt-1 text-xl font-semibold text-ink-900">{passRateDelta === null ? "暂无数据" : (passRateDelta > 0 ? "+" : "") + passRateDelta + "%"}</p></article>
        <article className="rounded-md bg-slate-50 p-3"><p className="text-xs text-ink-500">近 5 次平均通过率</p><p className="mt-1 text-xl font-semibold text-ink-900">{history.length ? recentFiveAverage + "%" : "暂无数据"}</p></article>
        <article className="rounded-md bg-slate-50 p-3"><p className="text-xs text-ink-500">最近兜底率</p><p className="mt-1 text-xl font-semibold text-ink-900">{displayValue(latest?.fallbackRate, "%")}</p></article>
        <article className="rounded-md bg-slate-50 p-3"><p className="text-xs text-ink-500">最近平均 RAG 分</p><p className="mt-1 text-xl font-semibold text-ink-900">{displayValue(latest?.averageRagScore)}</p></article>
        <article className="rounded-md bg-slate-50 p-3"><p className="text-xs text-ink-500">最近运行时间</p><p className="mt-1 text-sm font-semibold leading-6 text-ink-900">{latest ? formatDate(latest.createdAt) : "暂无数据"}</p></article>
      </div>
      {passRateDelta !== null && passRateDelta < 0 ? <p className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-800">评测通过率较上次下降，请检查失败用例。</p> : null}
      {passRateDelta !== null && passRateDelta > 0 ? <p className="mt-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">评测通过率较上次提升。</p> : null}
    </section>

    <EvaluationTrendChart history={history} />

    <ChatFeedbackStatsPanel />

    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-ink-900">评测历史记录</h2>
      {history.length === 0 ? <p className="mt-3 text-sm text-ink-500">暂无历史记录。</p> : <div className="mt-4 space-y-3">{history.map((item) => <article key={item.id} className="rounded-md border border-slate-200 bg-slate-50 p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><p className="break-words text-sm font-semibold text-ink-900">{formatDate(item.createdAt)}{" · "}{historyModeLabel(item.mode)}{" · "}{suiteLabel(item.suite)}</p><p className="mt-1 text-xs text-ink-500">{item.caseCount} 条用例{" · "}{item.passed} 条通过{" · "}通过率 {item.passRate}%{" · "}场景 {item.scenarioAccuracy}%{" · "}意图 {item.intentAccuracy}%{" · "}工具 {item.toolHitRate}%{" · "}RAG {item.ragUsageAccuracy}%{" · "}兜底 {item.fallbackRate ?? 0}%</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setExpandedHistoryId(expandedHistoryId === item.id ? "" : item.id)} className={secondaryButtonClass()}>{expandedHistoryId === item.id ? "收起详情" : "查看详情"}</button><button type="button" onClick={() => openMarkdownPreview(item)} className={secondaryButtonClass()}>预览 Markdown</button><button type="button" onClick={() => openJsonPreview(item)} className={secondaryButtonClass()}>预览 JSON</button><button type="button" onClick={() => triggerMarkdownDownload(item)} className={secondaryButtonClass()}>导出 Markdown</button><button type="button" onClick={() => triggerJsonDownload(item)} className={secondaryButtonClass()}>导出 JSON</button><button type="button" onClick={() => handleDelete(item.id)} className={secondaryButtonClass()}>删除</button></div></div>{expandedHistoryId === item.id ? <div className="mt-4 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-3"><p>创建时间：{formatDate(item.createdAt)}</p><p>模式：{historyModeLabel(item.mode)}</p><p>测试集：{suiteLabel(item.suite)}</p><p>用例数量：{item.caseCount}</p><p>通过数量：{item.passed}</p><p>通过率：{item.passRate}%</p><p>场景识别准确率：{item.scenarioAccuracy}%</p><p>意图识别准确率：{item.intentAccuracy}%</p><p>工具命中率：{item.toolHitRate}%</p><p>RAG 使用准确率：{item.ragUsageAccuracy}%</p><p>来源引用率：{item.citationRate}%</p><p>关键词命中率：{item.keywordHitRate}%</p><p>兜底率：{displayValue(item.fallbackRate, "%")}</p><p>平均 RAG 分：{displayValue(item.averageRagScore)}</p><p className="md:col-span-2 xl:col-span-3">失败摘要：{item.failureSummary ?? "暂无失败摘要"}</p><pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md bg-white p-3 text-xs text-ink-600 md:col-span-2 xl:col-span-3">{failureBucketText(item)}</pre></div> : null}</article>)}</div>}
    </section>
  </div>;
}
