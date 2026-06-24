"use client";

import { useMemo, useState } from "react";
import { AgentTracePanel } from "@/components/AgentTracePanel";
import { SourceList } from "@/components/SourceList";
import { agentExamples } from "@/data/mock";
import type { AgentApiResponse, LlmMode } from "@/types";

const fallbackQuestion = agentExamples[0]?.question ?? "公司报销需要什么材料？";

export function AgentWorkspace() {
  const [question, setQuestion] = useState(fallbackQuestion);
  const [mode, setMode] = useState<LlmMode>("mock");
  const [result, setResult] = useState<AgentApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
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

  return (
    <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)_420px]">
      <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="font-semibold text-ink-900">输入区</h2>
          <p className="mt-1 text-sm text-ink-500">默认 Mock 模式。Real API 模式只通过服务端 API Route 读取环境变量，不会在浏览器暴露 Key。</p>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1 text-sm">
          {(["mock", "real"] as LlmMode[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setMode(item)}
              className={`rounded-md px-3 py-2 font-semibold transition ${mode === item ? "bg-white text-brand-700 shadow-sm" : "text-ink-500 hover:text-ink-900"}`}
            >
              {item === "mock" ? "Mock 模式" : "Real API 模式"}
            </button>
          ))}
        </div>

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
          className="mt-3 w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isLoading ? "运行中..." : "运行 Agent Pipeline"}
        </button>
        {clientError ? <p className="mt-3 rounded-md bg-rose-50 p-3 text-sm text-rose-700">{clientError}</p> : null}

        <div className="mt-5">
          <h3 className="mb-3 text-sm font-semibold text-ink-900">示例问题</h3>
          <div className="space-y-2">
            {agentExamples.map((example) => (
              <button
                key={example.question}
                type="button"
                onClick={() => setQuestion(example.question)}
                className={`w-full rounded-md border px-3 py-2 text-left text-xs leading-5 transition ${
                  selectedExample?.question === example.question ? "border-brand-200 bg-brand-50 text-brand-700" : "border-slate-200 bg-slate-50 text-ink-500 hover:bg-brand-50"
                }`}
              >
                {example.question}
              </button>
            ))}
          </div>
        </div>
      </aside>

      <main className="space-y-5">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-ink-900">最终回答</h2>
              <p className="mt-1 text-sm text-ink-500">问题：{result?.question ?? question}</p>
            </div>
            <span className="rounded-md bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">{result?.api.responseMode ?? mode}</span>
          </div>
          <p className="rounded-md bg-slate-50 p-4 text-sm leading-7 text-ink-700">
            {result?.finalAnswer ?? "选择模式并运行 Agent Pipeline 后会在这里展示最终回答。"}
          </p>
        </section>

        {result ? (
          <section className="grid gap-4 md:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs text-ink-500">场景</p>
              <p className="mt-2 font-semibold text-ink-900">{result.route.scenario}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs text-ink-500">意图</p>
              <p className="mt-2 font-semibold text-ink-900">{result.route.intent}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs text-ink-500">置信度</p>
              <p className="mt-2 font-semibold text-ink-900">{Math.round(result.route.confidence * 100)}%</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs text-ink-500">风险等级</p>
              <p className="mt-2 font-semibold text-ink-900">{result.structuredOutput.riskLevel}</p>
            </div>
          </section>
        ) : null}

        {result ? (
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 font-semibold text-ink-900">LLM 状态</h2>
            <div className="grid gap-3 text-sm text-ink-700 md:grid-cols-2">
              <p>请求模式：{result.api.requestedMode}</p>
              <p>响应模式：{result.api.responseMode}</p>
              <p>provider：{result.api.provider}</p>
              <p>model：{result.api.model}</p>
              <p>fallbackReason：{result.api.fallbackReason ?? "无"}</p>
              <p>LLM duration：{result.api.llmDurationMs ? `${result.api.llmDurationMs}ms` : "无"}</p>
            </div>
            {result.api.llmError ? <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-700">{result.api.llmError}</p> : null}
          </section>
        ) : null}

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold text-ink-900">来源引用</h2>
          <SourceList sources={result?.ragAnswer?.sources ?? []} />
        </section>
      </main>

      <AgentTracePanel result={result} />
    </div>
  );
}
