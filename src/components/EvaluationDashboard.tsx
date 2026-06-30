"use client";

import { useEffect, useMemo, useState } from "react";
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

const suiteOptions: Array<{ value: SuiteOption; label: string; description: string }> = [
  { value: "quick", label: "Quick 15", description: "Fast smoke suite" },
  { value: "standard", label: "Standard 30", description: "Main scenario suite" },
  { value: "full", label: "Full suite", description: "All built-in cases" },
];

const packOptions = [{ id: "all", name: "All knowledge packs" }, ...knowledgePacks, { id: "fallback", name: "Fallback / out-of-scope" }];

const metricLabels: Array<{ key: keyof Omit<EvaluationRunResponse["summary"], "failureBuckets" | "packCoverage" | "selectedSuite">; label: string; suffix?: string }> = [
  { key: "caseCount", label: "Cases" },
  { key: "passRate", label: "Pass Rate", suffix: "%" },
  { key: "scenarioAccuracy", label: "Scenario" , suffix: "%" },
  { key: "intentAccuracy", label: "Intent", suffix: "%" },
  { key: "toolHitRate", label: "Tool Hit", suffix: "%" },
  { key: "ragUsageAccuracy", label: "RAG Usage", suffix: "%" },
  { key: "citationRate", label: "Citation", suffix: "%" },
  { key: "keywordHitRate", label: "Keyword", suffix: "%" },
  { key: "averageRagScore", label: "Avg RAG Score" },
  { key: "fallbackCaseCount", label: "Fallback Cases" },
  { key: "fallbackRate", label: "Fallback Rate", suffix: "%" },
  { key: "averageDurationMs", label: "Avg Latency", suffix: "ms" },
];

const failureBucketLabels: Record<EvaluationFailureReason, { label: string; advice: string }> = {
  scenario_mismatch: { label: "Scenario mismatch", advice: "Check routeUserQuestion scenario keywords and rule order." },
  intent_mismatch: { label: "Intent mismatch", advice: "Check intent keywords and edge cases." },
  tool_mismatch: { label: "Tool mismatch", advice: "Check selectTools or expectedTools." },
  rag_usage_mismatch: { label: "RAG usage mismatch", advice: "Check route.needRag and pack-aware retrieval." },
  keyword_miss: { label: "Keyword miss", advice: "Check answer, evidence, sources, or expected keywords." },
  citation_miss: { label: "Citation miss", advice: "Check RAG sources and source aggregation." },
  pipeline_error: { label: "Pipeline error", advice: "Check API, local tool functions, or fallback handling." },
};

function formatMetric(value: number, suffix = "") { return String(value) + suffix; }
function statusClass(passed: boolean) { return passed ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"; }
function buttonClass(active: boolean) { return "rounded-md px-3 py-2 text-sm font-semibold transition " + (active ? "bg-brand-600 text-white" : "bg-slate-100 text-ink-600 hover:bg-slate-200"); }
function secondaryButtonClass() { return "min-h-10 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-brand-50 hover:text-brand-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-ink-400"; }
function reasonAdvice(reasons: EvaluationFailureReason[]) { return reasons.length === 0 ? "This case passed." : reasons.map((reason) => failureBucketLabels[reason].advice).join(" "); }
function formatDate(value: string) { return new Date(value).toLocaleString(); }
function avg(values: number[]) { return values.length ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10 : 0; }
function historyModeLabel(mode: LlmMode) { return mode === "real" ? "Real API" : "Mock"; }

function triggerMarkdownDownload(run: EvaluationRunHistoryItem) {
  downloadTextFile(getEvaluationReportFileName("md"), exportEvaluationAsMarkdown(run), "text/markdown;charset=utf-8");
}

function triggerJsonDownload(run: EvaluationRunHistoryItem) {
  downloadTextFile(getEvaluationReportFileName("json"), exportEvaluationAsJson(run), "application/json;charset=utf-8");
}

export function EvaluationDashboard() {
  const [mode, setMode] = useState<LlmMode>("mock");
  const [suite, setSuite] = useState<SuiteOption>("full");
  const [packId, setPackId] = useState<PackFilter>("all");
  const [result, setResult] = useState<EvaluationRunResponse | null>(null);
  const [history, setHistory] = useState<EvaluationRunHistoryItem[]>([]);
  const [expandedId, setExpandedId] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState("");
  const [historyMessage, setHistoryMessage] = useState("");

  useEffect(() => {
    const loaded = loadEvaluationHistory();
    setHistory(loaded.data);
    if (!loaded.ok) setHistoryMessage(loaded.error);
  }, []);

  const filteredResults = useMemo(() => result?.results ?? [], [result]);
  const failedResults = filteredResults.filter((item) => !item.passed);
  const currentRun = useMemo(() => result ? createEvaluationHistoryItem(result) : null, [result]);
  const latest = history[0];
  const previous = history[1];
  const recentFiveAverage = avg(history.slice(0, 5).map((item) => item.passRate));
  const passRateDelta = latest && previous ? Math.round((latest.passRate - previous.passRate) * 10) / 10 : null;

  async function runEvaluation() {
    setIsRunning(true);
    setError("");
    setHistoryMessage("");
    try {
      const response = await fetch("/api/evaluation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, suite, packId }) });
      if (!response.ok) throw new Error("Evaluation API failed: " + response.status);
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
    setHistoryMessage(saved.ok ? "Saved current evaluation run locally." : saved.error);
  }

  function handleDelete(id: string) {
    const next = deleteEvaluationRun(id);
    setHistory(next.data);
    setHistoryMessage(next.ok ? "Deleted one history item." : next.error);
  }

  function handleClear() {
    if (!window.confirm("Clear all local evaluation history?")) return;
    const next = clearEvaluationHistory();
    setHistory(next.data);
    setHistoryMessage(next.ok ? "Cleared local evaluation history." : next.error);
  }

  return <div className="space-y-6 overflow-x-hidden">
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ink-900">V1.3 Agent Evaluation Dashboard</h2>
          <p className="mt-1 text-sm leading-6 text-ink-500">Continuously validate Agent Router, Hybrid RAG, Tool Calling, fallback, and structured output quality. Runs can be saved to browser localStorage and exported as Markdown or JSON reports.</p>
        </div>
        <button type="button" onClick={runEvaluation} disabled={isRunning} className="min-h-10 rounded-md bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-400">{isRunning ? "Running evaluation..." : "Run Evaluation"}</button>
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div><p className="mb-2 text-xs font-semibold text-ink-500">Mode</p><div className="flex flex-wrap gap-2">{(["mock", "real"] as LlmMode[]).map((item) => <button key={item} type="button" onClick={() => setMode(item)} className={buttonClass(mode === item)}>{item === "mock" ? "Mock" : "Real API"}</button>)}</div>{mode === "real" ? <p className="mt-2 text-xs text-amber-700">Real mode may consume API quota.</p> : null}</div>
        <div><p className="mb-2 text-xs font-semibold text-ink-500">Suite</p><div className="flex flex-wrap gap-2">{suiteOptions.map((item) => <button key={item.value} type="button" title={item.description} onClick={() => setSuite(item.value)} className={buttonClass(suite === item.value)}>{item.label}</button>)}</div></div>
        <div><p className="mb-2 text-xs font-semibold text-ink-500">Knowledge Pack</p><select value={packId} onChange={(event) => setPackId(event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100">{packOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
      </div>
      {error ? <p className="mt-4 rounded-md bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
      {historyMessage ? <p className="mt-4 rounded-md bg-brand-50 p-3 text-sm text-brand-700">{historyMessage}</p> : null}
    </section>

    {result ? <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metricLabels.map((metric) => <article key={metric.key} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs text-ink-500">{metric.label}</p><p className="mt-2 text-2xl font-semibold text-ink-900">{formatMetric(Number(result.summary[metric.key]), metric.suffix)}</p></article>)}</section>
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div><h2 className="font-semibold text-ink-900">Current Evaluation Result</h2><p className="mt-1 text-sm text-ink-500">Started {formatDate(result.startedAt)} ? finished {formatDate(result.finishedAt)} ? duration {result.durationMs}ms</p></div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={handleSave} className={secondaryButtonClass()}>Save Current Run</button>
            <button type="button" onClick={() => currentRun && triggerMarkdownDownload(currentRun)} className={secondaryButtonClass()}>Export Markdown</button>
            <button type="button" onClick={() => currentRun && triggerJsonDownload(currentRun)} className={secondaryButtonClass()}>Export JSON</button>
          </div>
        </div>
      </section>
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-3 font-semibold text-ink-900">Knowledge Pack Coverage</h2><div className="flex flex-wrap gap-2">{Object.entries(result.summary.packCoverage).map(([key, value]) => <span key={key} className="rounded-md bg-slate-50 px-3 py-1.5 text-xs text-ink-600 ring-1 ring-slate-200">{key}: {value}</span>)}</div></section>
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-3 font-semibold text-ink-900">Failure Analysis</h2><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Object.entries(result.summary.failureBuckets).map(([reason, count]) => <article key={reason} className="rounded-md bg-slate-50 p-3"><p className="text-xs text-ink-500">{failureBucketLabels[reason as EvaluationFailureReason].label}</p><p className="mt-1 text-lg font-semibold text-ink-900">{count}</p></article>)}</div>{failedResults.length === 0 ? <p className="mt-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">All cases passed in this suite.</p> : null}</section>
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 p-5"><h2 className="font-semibold text-ink-900">Evaluation Results</h2><p className="mt-1 text-sm text-ink-500">Current response contains {filteredResults.length} case results. Expand a question to inspect answer and failure details.</p></div><div className="overflow-x-auto"><table className="min-w-[1100px] divide-y divide-slate-200 text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-ink-500"><tr><th className="px-4 py-3">Question</th><th className="px-4 py-3">Actual Scenario / Intent</th><th className="px-4 py-3">Tools</th><th className="px-4 py-3">Passed</th><th className="px-4 py-3">responseMode</th><th className="px-4 py-3">RAG Score</th><th className="px-4 py-3">Duration</th><th className="px-4 py-3">Error</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredResults.map((item) => <tr key={item.caseId} className="align-top"><td className="max-w-[320px] px-4 py-3"><button type="button" onClick={() => setExpandedId(expandedId === item.caseId ? "" : item.caseId)} className="break-words text-left font-medium text-ink-900 hover:text-brand-700">{item.question}</button>{expandedId === item.caseId ? <div className="mt-3 rounded-md bg-slate-50 p-3 text-xs leading-5 text-ink-600"><p>failureReasons: {item.failureReasons.length ? item.failureReasons.join(", ") : "none"}</p><p>failureSummary: {item.failureSummary ?? "none"}</p><p>Advice: {reasonAdvice(item.failureReasons)}</p><p className="mt-2 break-words">sources: {item.sources.join(" / ") || "none"}</p><p className="mt-2 whitespace-pre-wrap break-words">{item.finalAnswer}</p></div> : null}</td><td className="px-4 py-3 text-ink-600">{item.route.scenario}<br />{item.route.intent}</td><td className="px-4 py-3 text-ink-600">{item.toolsUsed.join(" + ") || "none"}</td><td className="px-4 py-3"><span className={"rounded-md px-2 py-1 text-xs font-semibold " + statusClass(item.passed)}>{item.passed ? "pass" : "failed"}</span></td><td className="px-4 py-3 text-ink-600">{item.responseMode}</td><td className="px-4 py-3 text-ink-600">{item.ragScore}</td><td className="px-4 py-3 text-ink-600">{item.durationMs}ms</td><td className="max-w-[220px] break-words px-4 py-3 text-rose-600">{item.error ?? ""}</td></tr>)}</tbody></table></div></section>
    </> : <p className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-ink-500">Choose a suite and run evaluation. Results, history, and export actions will appear here.</p>}

    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="font-semibold text-ink-900">Trend Summary</h2><p className="mt-1 text-sm text-ink-500">Stored locally in this browser. Latest 20 runs are retained.</p></div>{history.length ? <button type="button" onClick={handleClear} className={secondaryButtonClass()}>Clear History</button> : null}</div>
      <div className="mt-4 grid gap-4 md:grid-cols-3"><article className="rounded-md bg-slate-50 p-3"><p className="text-xs text-ink-500">Latest Pass Rate</p><p className="mt-1 text-xl font-semibold text-ink-900">{latest ? latest.passRate + "%" : "N/A"}</p></article><article className="rounded-md bg-slate-50 p-3"><p className="text-xs text-ink-500">Previous Delta</p><p className="mt-1 text-xl font-semibold text-ink-900">{passRateDelta === null ? "N/A" : (passRateDelta > 0 ? "+" : "") + passRateDelta + "%"}</p></article><article className="rounded-md bg-slate-50 p-3"><p className="text-xs text-ink-500">Recent 5 Avg Pass Rate</p><p className="mt-1 text-xl font-semibold text-ink-900">{history.length ? recentFiveAverage + "%" : "N/A"}</p></article></div>
      {passRateDelta !== null && passRateDelta < 0 ? <p className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-800">Pass rate decreased from the previous saved run. Please inspect failed cases.</p> : null}
      {passRateDelta !== null && passRateDelta > 0 ? <p className="mt-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">Pass rate improved from the previous saved run.</p> : null}
    </section>

    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-ink-900">Evaluation History</h2>
      {history.length === 0 ? <p className="mt-3 text-sm text-ink-500">No saved evaluation runs yet.</p> : <div className="mt-4 space-y-3">{history.map((item) => <article key={item.id} className="rounded-md border border-slate-200 bg-slate-50 p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><p className="break-words text-sm font-semibold text-ink-900">{formatDate(item.createdAt)} ? {historyModeLabel(item.mode)} ? {item.suite}</p><p className="mt-1 text-xs text-ink-500">{item.caseCount} cases ? {item.passed} passed ? passRate {item.passRate}% ? scenario {item.scenarioAccuracy}% ? intent {item.intentAccuracy}% ? tool {item.toolHitRate}% ? RAG {item.ragUsageAccuracy}% ? fallback {item.fallbackRate ?? 0}%</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => triggerMarkdownDownload(item)} className={secondaryButtonClass()}>Markdown</button><button type="button" onClick={() => triggerJsonDownload(item)} className={secondaryButtonClass()}>JSON</button><button type="button" onClick={() => handleDelete(item.id)} className={secondaryButtonClass()}>Delete</button></div></div></article>)}</div>}
    </section>
  </div>;
}
