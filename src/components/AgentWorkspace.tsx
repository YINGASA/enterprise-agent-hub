"use client";

import { useMemo, useState } from "react";
import { AgentTracePanel } from "@/components/AgentTracePanel";
import { SourceList } from "@/components/SourceList";
import { agentExamples } from "@/data/mock";
import type { AgentApiResponse, LlmMode } from "@/types";

const fallbackQuestion = agentExamples[0]?.question ?? "公司报销需要什么材料？";

function formatValue(value: unknown) {
  if (value === undefined || value === null || value === "") return "无";
  return String(value);
}

function responseModeLabel(mode: AgentApiResponse["api"]["responseMode"] | LlmMode) {
  const labels: Record<string, string> = {
    mock: "Mock",
    real: "Real JSON",
    real_repaired: "Real Repaired",
    real_text_fallback: "Real Text Fallback",
    fallback: "Mock Fallback",
  };
  return labels[mode] ?? mode;
}

export function AgentWorkspace() {
  const [question, setQuestion] = useState(fallbackQuestion);
  const [mode, setMode] = useState<LlmMode>("mock");
  const [result, setResult] = useState<AgentApiResponse | null>(null);
  const [healthResult, setHealthResult] = useState<unknown>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [clientError, setClientError] = useState("");

  const selectedExample = useMemo(() => agentExamples.find((example) => example.question === question), [question]);

  async function handleRun() {
    setIsLoading(true);
    setClientError("");

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, mode }),
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = (await response.json()) as AgentApiResponse;
      setResult(data);
    } catch (error) {
      setClientError(error instanceof Error ? error.message : "Unknown client error.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleHealthCheck() {
    setIsCheckingHealth(true);
    setClientError("");

    try {
      const response = await fetch("/api/llm/health", { method: "GET" });
      const data = (await response.json()) as unknown;
      setHealthResult(data);
    } catch (error) {
      setHealthResult({ ok: false, stage: "client_error", errorMessage: error instanceof Error ? error.message : "Unknown client error." });
    } finally {
      setIsCheckingHealth(false);
    }
  }

  return (
    <div className="w-full overflow-x-hidden">
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(240px,300px)_minmax(0,1fr)_minmax(320px,420px)]">
        <aside className="min-w-0 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="font-semibold text-ink-900">输入区</h2>
            <p className="mt-1 text-sm leading-6 text-ink-500">默认 Mock 模式。Real API 模式只通过服务端 API Route 读取环境变量，不会在浏览器暴露 Key。</p>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1 text-sm">
            {(["mock", "real"] as LlmMode[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setMode(item)}
                className={`min-h-10 rounded-md px-2 py-2 text-center text-sm font-semibold transition disabled:cursor-not-allowed ${
                  mode === item ? "bg-white text-brand-700 shadow-sm" : "text-ink-600 hover:bg-white/70 hover:text-ink-900"
                }`}
              >
                <span className="block truncate">{item === "mock" ? "Mock 模式" : "Real API 模式"}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleHealthCheck}
            disabled={isCheckingHealth}
            className="mb-4 min-h-10 w-full rounded-md border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-ink-500"
          >
            {isCheckingHealth ? "检查中..." : "检查 LLM 连接"}
          </button>

          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            rows={5}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm leading-6 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
          <button
            type="button"
            onClick={handleRun}
            disabled={isLoading}
            className="mt-3 min-h-10 w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:text-white"
          >
            {isLoading ? "运行中..." : "运行 Agent Pipeline"}
          </button>
          {clientError ? <p className="mt-3 break-words rounded-md bg-rose-50 p-3 text-sm text-rose-700">{clientError}</p> : null}

          <div className="mt-5">
            <h3 className="mb-3 text-sm font-semibold text-ink-900">示例问题</h3>
            <div className="space-y-2">
              {agentExamples.map((example) => (
                <button
                  key={example.question}
                  type="button"
                  onClick={() => setQuestion(example.question)}
                  className={`w-full rounded-md border px-3 py-2 text-left text-xs leading-5 transition ${
                    selectedExample?.question === example.question ? "border-brand-200 bg-brand-50 text-brand-700" : "border-slate-200 bg-slate-50 text-ink-600 hover:bg-brand-50"
                  }`}
                >
                  <span className="block break-words">{example.question}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <main className="min-w-0 space-y-5">
          <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-semibold text-ink-900">最终回答</h2>
                <p className="mt-1 break-words text-sm text-ink-500">问题：{result?.question ?? question}</p>
              </div>
              <span className="shrink-0 rounded-md bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">{responseModeLabel(result?.api.responseMode ?? mode)}</span>
            </div>
            <p className="whitespace-pre-wrap break-words rounded-md bg-slate-50 p-4 text-sm leading-7 text-ink-700">
              {result?.finalAnswer ?? "选择模式并运行 Agent Pipeline 后会在这里展示最终回答。"}
            </p>
          </section>

          {result ? (
            <section className="grid min-w-0 gap-4 md:grid-cols-4">
              <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs text-ink-500">场景</p>
                <p className="mt-2 break-words font-semibold text-ink-900">{result.route.scenario}</p>
              </div>
              <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs text-ink-500">意图</p>
                <p className="mt-2 break-words font-semibold text-ink-900">{result.route.intent}</p>
              </div>
              <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs text-ink-500">置信度</p>
                <p className="mt-2 font-semibold text-ink-900">{Math.round(result.route.confidence * 100)}%</p>
              </div>
              <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs text-ink-500">风险等级</p>
                <p className="mt-2 font-semibold text-ink-900">{result.structuredOutput.riskLevel}</p>
              </div>
            </section>
          ) : null}

          {result ? (
            <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 font-semibold text-ink-900">LLM 状态</h2>
              <div className="grid min-w-0 gap-3 text-sm text-ink-700 md:grid-cols-2">
                <p className="break-words">requestMode：{result.api.requestedMode}</p>
                <p className="break-words">responseMode：{result.api.responseMode}</p>
                <p className="break-words">provider：{result.api.provider}</p>
                <p className="break-words">model：{result.api.model}</p>
                <p className="break-all">requestUrl：{formatValue(result.api.requestUrl)}</p>
                <p className="break-words">hasProxy：{String(result.api.hasProxy ?? false)}</p>
                <p className="break-words">proxyType：{result.api.proxyType ?? "none"}</p>
                <p className="break-all">maskedProxyUrl：{result.api.maskedProxyUrl ?? "none"}</p>
                <p className="break-words">timeoutMs：{formatValue(result.api.timeoutMs)}</p>
                <p className="break-words">durationMs：{result.api.llmDurationMs ? `${result.api.llmDurationMs}ms` : "无"}</p>
                <p className="break-words">errorType：{result.api.errorType ?? "无"}</p>
                <p className="break-words">parseError：{result.api.parseError ?? "无"}</p>
              </div>
              {result.api.rawContentPreview ? (
                <div className="mt-3 rounded-md bg-slate-50 p-3">
                  <p className="mb-2 text-xs font-semibold text-ink-500">rawContentPreview</p>
                  <p className="whitespace-pre-wrap break-words text-xs leading-5 text-ink-700">{result.api.rawContentPreview.slice(0, 500)}</p>
                </div>
              ) : null}
              {result.api.llmError ? <p className="mt-3 break-words rounded-md bg-amber-50 p-3 text-sm text-amber-700">{result.api.llmError}</p> : null}
            </section>
          ) : null}

          {healthResult ? (
            <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 font-semibold text-ink-900">LLM 连接诊断</h2>
              <pre className="max-h-[420px] max-w-full overflow-x-auto overflow-y-auto whitespace-pre-wrap break-words rounded-md bg-slate-950 p-4 text-xs leading-6 text-slate-100">
                {JSON.stringify(healthResult, null, 2)}
              </pre>
            </section>
          ) : null}

          <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 font-semibold text-ink-900">来源引用</h2>
            <SourceList sources={result?.ragAnswer?.sources ?? []} />
          </section>
        </main>

        <div className="min-w-0">
          <AgentTracePanel result={result} />
        </div>
      </div>
    </div>
  );
}