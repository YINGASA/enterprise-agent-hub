"use client";

import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { OpsSummary } from "@/lib/ops/storage";

function percent(value: number) {
  return `${value}%`;
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleString() : "暂无数据";
}

export default function OpsPage() {
  const [token, setToken] = useState("");
  const [summary, setSummary] = useState<OpsSummary | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function loadSummary() {
    setIsLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/ops/summary", {
        headers: { "x-ops-token": token },
      });
      const data = (await response.json()) as { ok: boolean; summary?: OpsSummary; message?: string; error?: string };
      if (!response.ok || !data.ok || !data.summary) {
        setSummary(null);
        setMessage(data.message || data.error || "无法读取运行状态。");
        return;
      }
      setSummary(data.summary);
    } catch (error) {
      setSummary(null);
      setMessage(error instanceof Error ? error.message : "无法读取运行状态。");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="运行状态"
        description="轻量查看 Agent 运行摘要、Real / Mock / fallback 比例、最近错误和 full Mock 评测结果。页面受服务端口令保护，不展示 API Key、模型名称、baseUrl 或 provider。"
      />

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-ink-900">访问口令</h2>
        <p className="mt-1 text-sm leading-6 text-ink-500">请输入服务端环境变量 EAH_OPS_TOKEN 对应的口令。口令只发送给本项目服务端校验，不会写入代码或页面。</p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            type="password"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            className="min-h-10 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            placeholder="输入运维口令"
          />
          <button
            type="button"
            onClick={loadSummary}
            disabled={isLoading || !token.trim()}
            className="rounded-md bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {isLoading ? "读取中..." : "查看运行状态"}
          </button>
        </div>
        {message ? <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-800">{message}</p> : null}
      </section>

      {summary ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-ink-500">LLM configured</p>
              <p className="mt-2 text-2xl font-semibold text-ink-900">{summary.llmConfigured ? "已配置" : "未配置"}</p>
              <p className="mt-2 text-xs text-ink-500">仅表示服务端环境变量是否存在，不展示任何具体配置。</p>
            </article>
            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-ink-500">最近调用次数</p>
              <p className="mt-2 text-2xl font-semibold text-ink-900">{summary.recentAgentRunCount}</p>
              <p className="mt-2 text-xs text-ink-500">统计最近 {summary.recentRuns.length} 条服务端运行摘要。</p>
            </article>
            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-ink-500">Real / Mock / fallback</p>
              <p className="mt-2 text-xl font-semibold text-ink-900">{percent(summary.realRate)} / {percent(summary.mockRate)} / {percent(summary.fallbackRate)}</p>
              <p className="mt-2 text-xs text-ink-500">{summary.realCount} real，{summary.mockCount} mock，{summary.fallbackCount} fallback。</p>
            </article>
            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-ink-500">最近 full Mock</p>
              <p className="mt-2 text-2xl font-semibold text-ink-900">{summary.latestFullMockEvaluation ? `${summary.latestFullMockEvaluation.passed}/${summary.latestFullMockEvaluation.total}` : "暂无数据"}</p>
              <p className="mt-2 text-xs text-ink-500">{summary.latestFullMockEvaluation ? `passRate ${summary.latestFullMockEvaluation.passRate}% · ${formatDate(summary.latestFullMockEvaluation.createdAt)}` : "运行 /evaluation full Mock 后会写入摘要。"}</p>
            </article>
          </section>

          <section className="grid gap-5 lg:grid-cols-2">
            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-ink-900">最近错误摘要</h2>
              <div className="mt-4 space-y-3">
                {summary.recentErrors.length ? summary.recentErrors.map((item) => (
                  <div key={item.createdAt + item.questionPreview} className="rounded-md bg-rose-50 p-3 text-sm leading-6 text-rose-800">
                    <p className="font-semibold">{formatDate(item.createdAt)} · {item.responseMode}</p>
                    <p className="break-words">问题：{item.questionPreview || "无问题摘要"}</p>
                    <p>错误：{item.errorType || "real_error_fallback"}{item.httpStatus ? ` · HTTP ${item.httpStatus}` : ""}</p>
                  </div>
                )) : <p className="rounded-md bg-slate-50 p-4 text-sm text-ink-500">暂无错误摘要。</p>}
              </div>
            </article>

            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-ink-900">最近反馈</h2>
              <div className="mt-4 space-y-3">
                {summary.recentFeedback.length ? summary.recentFeedback.slice(0, 8).map((item) => (
                  <div key={item.id} className="rounded-md bg-slate-50 p-3 text-sm leading-6 text-ink-600">
                    <p className="font-semibold text-ink-900">{formatDate(item.createdAt)} · {item.values.join(" / ")}</p>
                    <p className="break-words">问题：{item.questionPreview}</p>
                    {item.reasonPreview ? <p className="break-words text-ink-500">原因：{item.reasonPreview}</p> : null}
                  </div>
                )) : <p className="rounded-md bg-slate-50 p-4 text-sm text-ink-500">暂无服务端反馈摘要。</p>}
              </div>
            </article>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-ink-900">最近 Agent 调用</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase text-ink-500">
                  <tr>
                    <th className="whitespace-nowrap px-3 py-2">时间</th>
                    <th className="whitespace-nowrap px-3 py-2">模式</th>
                    <th className="whitespace-nowrap px-3 py-2">场景 / 意图</th>
                    <th className="whitespace-nowrap px-3 py-2">工具</th>
                    <th className="whitespace-nowrap px-3 py-2">来源</th>
                    <th className="px-3 py-2">问题摘要</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summary.recentRuns.slice(0, 20).map((item) => (
                    <tr key={item.id} className="align-top">
                      <td className="whitespace-nowrap px-3 py-2 text-ink-500">{formatDate(item.createdAt)}</td>
                      <td className="whitespace-nowrap px-3 py-2 font-semibold text-ink-900">{item.responseMode}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-ink-600">{item.scenario} / {item.intent}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-ink-600">{item.toolsUsed.length}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-ink-600">{item.sourcesCount}</td>
                      <td className="break-words px-3 py-2 text-ink-600">{item.questionPreview}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!summary.recentRuns.length ? <p className="rounded-md bg-slate-50 p-4 text-sm text-ink-500">暂无 Agent 调用摘要。运行 /chat 后会开始记录。</p> : null}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
