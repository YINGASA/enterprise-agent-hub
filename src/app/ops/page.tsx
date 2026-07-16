"use client";

import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { appVersion, buildCommit } from "@/lib/appVersion";
import type { OpsDistributionItem, OpsSummary } from "@/lib/ops/storage";

function percent(value: number) {
  return `${value}%`;
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleString() : "暂无数据";
}

function responseModeText(value: string) {
  const labels: Record<string, string> = {
    real: "真实模型",
    real_repaired: "真实模型 · JSON 修复",
    real_text_fallback: "真实模型 · 文本兜底",
    real_error_fallback: "Real API 失败兜底",
    mock: "开发模拟",
    fallback: "兜底模式",
  };
  return labels[value] ?? value;
}

function feedbackText(value: string) {
  const labels: Record<string, string> = {
    positive: "有帮助",
    negative: "没帮助",
    accurate: "引用准确",
    inaccurate: "引用不准确",
  };
  return labels[value] ?? value;
}

function distributionLabel(value: string) {
  const labels: Record<string, string> = {
    real: "真实模型",
    real_repaired: "真实模型 JSON 修复",
    real_text_fallback: "文本兜底",
    real_error_fallback: "Real API 失败兜底",
    mock: "开发模拟",
    enterprise: "企业制度",
    ecommerce: "电商售后",
    recruitment: "历史场景（已下线）",
    ai_engineering: "AI 工程规范",
    general: "通用场景",
    knowledge_qa: "知识库问答",
    policy_check: "规则判断",
    order_query: "订单查询",
    product_query: "商品查询",
    after_sale_reply: "售后回复",
    jd_match: "历史意图（已下线）",
    ticket_create: "工单创建",
    general_chat: "通用对话",
    rate_limited: "请求频率受限",
    unknown: "未知",
    queryOrder: "订单查询",
    queryProduct: "商品查询",
    searchPolicy: "规则检索",
    createTicket: "工单创建",
    analyzeJD: "历史工具（已下线）",
    generateCustomerReply: "客服回复生成",
  };
  return labels[value] ?? value;
}

function DistributionList({ items, emptyText }: { items: OpsDistributionItem[]; emptyText: string }) {
  if (!items.length) {
    return <p className="rounded-md bg-slate-50 p-4 text-sm text-ink-500">{emptyText}</p>;
  }

  const maxCount = Math.max(...items.map((item) => item.count), 1);
  return (
    <div className="space-y-3">
      {items.slice(0, 8).map((item) => (
        <div key={item.key}>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 break-words font-medium text-ink-700">{distributionLabel(item.key)}</span>
            <span className="shrink-0 text-ink-500">{item.count} 次 · {item.rate}%</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.max((item.count / maxCount) * 100, 4)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function OpsPage() {
  const [token, setToken] = useState("");
  const [summary, setSummary] = useState<OpsSummary | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function loadSummary() {
    const trimmedToken = token.trim();
    if (!trimmedToken) return;
    setIsLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/ops/summary", {
        headers: { "x-ops-token": trimmedToken },
      });
      const data = (await response.json()) as { ok: boolean; summary?: OpsSummary; message?: string; error?: string };
      if (!response.ok || !data.ok || !data.summary) {
        setSummary(null);
        setMessage(data.message || "无法读取运行状态，请检查运维口令或服务端配置。");
        return;
      }
      setSummary(data.summary);
      setMessage("运行分析已刷新。");
    } catch {
      setSummary(null);
      setMessage("无法读取运行状态，请稍后再试。");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations"
        title={`Agent 运行分析 · V${appVersion}`}
        description="查看在线调用质量、反馈表现、错误分布与最近 full Mock 评测结果。页面受服务端口令保护，仅返回聚合后的安全统计。"
      />
      <p className="-mt-4 text-xs text-ink-500">当前运行版本：V{appVersion}{buildCommit ? ` · 构建 ${buildCommit}` : ""}</p>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-ink-900">访问口令</h2>
        <p className="mt-1 text-sm leading-6 text-ink-500">
          请输入服务端环境变量 EAH_OPS_TOKEN 对应的口令。口令只会通过请求头发送给服务端校验，不会出现在 URL，也不会在页面明文展示。
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            type="password"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void loadSummary();
            }}
            className="min-h-10 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            placeholder="输入运维口令"
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={loadSummary}
            disabled={isLoading || !token.trim()}
            className="rounded-md bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {isLoading ? "读取中..." : summary ? "手动刷新" : "查看运行分析"}
          </button>
        </div>
        {message ? <p className="mt-3 rounded-md bg-slate-50 p-3 text-sm text-ink-600">{message}</p> : null}
      </section>

      {summary ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-ink-500">LLM 配置状态</p>
              <p className="mt-2 text-2xl font-semibold text-ink-900">{summary.llmConfigured ? "已配置" : "未配置"}</p>
              <p className="mt-2 text-xs text-ink-500">仅表示服务端环境变量是否存在，不展示任何具体配置。</p>
            </article>
            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-ink-500">最近调用次数</p>
              <p className="mt-2 text-2xl font-semibold text-ink-900">{summary.recentAgentRunCount}</p>
              <p className="mt-2 text-xs text-ink-500">按最近最多 80 次调用聚合。</p>
            </article>
            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-ink-500">Real / Mock / fallback</p>
              <p className="mt-2 text-xl font-semibold text-ink-900">{percent(summary.realRate)} / {percent(summary.mockRate)} / {percent(summary.fallbackRate)}</p>
              <p className="mt-2 text-xs text-ink-500">{summary.realCount} real，{summary.mockCount} mock，{summary.fallbackCount} fallback。</p>
            </article>
            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-ink-500">频率受限</p>
              <p className="mt-2 text-2xl font-semibold text-ink-900">{summary.rateLimitedCount}</p>
              <p className="mt-2 text-xs text-ink-500">最近调用中的 rate_limited 次数。</p>
            </article>
            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-ink-500">最近 full Mock</p>
              <p className="mt-2 text-2xl font-semibold text-ink-900">{summary.latestFullMockEvaluation ? `${summary.latestFullMockEvaluation.passed}/${summary.latestFullMockEvaluation.total}` : "暂无数据"}</p>
              <p className="mt-2 text-xs text-ink-500">{summary.latestFullMockEvaluation ? `passRate ${summary.latestFullMockEvaluation.passRate}% · ${formatDate(summary.latestFullMockEvaluation.createdAt)}` : "运行 /evaluation full Mock 后会写入摘要。"}</p>
            </article>
            <article className={`rounded-lg border p-5 shadow-sm ${summary.storage.health.storageHealthy ? "border-emerald-200 bg-emerald-50/50" : "border-amber-200 bg-amber-50/50"}`}>
              <p className="text-sm text-ink-600">运行摘要存储</p>
              <p className="mt-2 text-2xl font-semibold text-ink-900">{summary.storage.health.storageHealthy ? "正常" : "降级"}</p>
              <p className="mt-2 text-xs leading-5 text-ink-600">最近成功：{formatDate(summary.storage.health.lastSuccessAt)} · 保留上限：{summary.storage.retentionLimit} 条</p>
              {!summary.storage.health.storageHealthy ? <p className="mt-1 text-xs text-amber-800">最近错误类型：{summary.storage.health.lastErrorType || "storage_write_failed"}</p> : null}
              {summary.storage.health.pendingWrites > 0 ? <p className="mt-1 text-xs text-ink-500">待完成写入：{summary.storage.health.pendingWrites}</p> : null}
            </article>
            <article className={`rounded-lg border p-5 shadow-sm ${summary.serverStorage?.storageMode === "server" ? "border-emerald-200 bg-emerald-50/50" : summary.serverStorage?.storageMode === "degraded" ? "border-amber-200 bg-amber-50/50" : "border-slate-200 bg-white"}`}>
              <p className="text-sm text-ink-600">当前匿名工作区持久化</p>
              <p className="mt-2 text-2xl font-semibold text-ink-900">{summary.serverStorage?.storageMode ?? "local"}</p>
              <p className="mt-2 text-xs leading-5 text-ink-600">会话 {summary.serverStorage?.conversationCount ?? 0} · 消息 {summary.serverStorage?.messageCount ?? 0} · 知识文档 {summary.serverStorage?.knowledgeDocumentCount ?? 0} · 迁移 {summary.serverStorage?.migrationCount ?? 0}。仅统计此浏览器匿名工作区。</p>
            </article>
          </section>

          <section className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-ink-900">响应模式分布</h2>
              <div className="mt-4"><DistributionList items={summary.responseModeDistribution} emptyText="暂无调用数据。" /></div>
            </article>
            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-ink-900">业务场景分布</h2>
              <div className="mt-4"><DistributionList items={summary.scenarioDistribution} emptyText="暂无场景识别数据。" /></div>
            </article>
            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-ink-900">任务意图分布</h2>
              <div className="mt-4"><DistributionList items={summary.intentDistribution} emptyText="暂无意图识别数据。" /></div>
            </article>
            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-ink-900">工具调用统计</h2>
              <div className="mt-4"><DistributionList items={summary.toolDistribution} emptyText="最近调用尚未使用业务工具。" /></div>
            </article>
            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-ink-900">错误类型分布</h2>
              <div className="mt-4"><DistributionList items={summary.errorTypeDistribution} emptyText="最近调用没有记录到错误。" /></div>
            </article>
            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-ink-900">运行摘要策略</h2>
              <p className="mt-4 text-sm leading-6 text-ink-600">
                每类记录最多保留最近 {summary.storage.retentionLimit} 条，页面仅展示聚合统计与少量脱敏摘要，不返回完整问题、回答、异常堆栈或模型服务配置。
              </p>
              <p className="mt-3 text-xs text-ink-500">统计生成时间：{formatDate(summary.generatedAt)}</p>
            </article>
          </section>

          <section className="grid gap-5 lg:grid-cols-3">
            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm lg:col-span-1">
              <h2 className="font-semibold text-ink-900">反馈质量概览</h2>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-md bg-slate-50 p-3">
                  <p className="text-xs text-ink-500">总反馈数</p>
                  <p className="mt-1 text-xl font-semibold text-ink-900">{summary.feedback.total}</p>
                </div>
                <div className="rounded-md bg-slate-50 p-3">
                  <p className="text-xs text-ink-500">有帮助率</p>
                  <p className="mt-1 text-xl font-semibold text-ink-900">{percent(summary.feedback.helpfulRate)}</p>
                </div>
                <div className="rounded-md bg-slate-50 p-3">
                  <p className="text-xs text-ink-500">引用评价数</p>
                  <p className="mt-1 text-xl font-semibold text-ink-900">{summary.feedback.citationRatedCount}</p>
                </div>
                <div className="rounded-md bg-slate-50 p-3">
                  <p className="text-xs text-ink-500">引用准确率</p>
                  <p className="mt-1 text-xl font-semibold text-ink-900">{percent(summary.feedback.citationAccuracyRate)}</p>
                </div>
              </div>
            </article>

            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
              <h2 className="font-semibold text-ink-900">不同响应模式的反馈表现</h2>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-[560px] text-left text-sm">
                  <thead className="text-xs text-ink-500">
                    <tr><th className="px-3 py-2">响应模式</th><th className="px-3 py-2">反馈数</th><th className="px-3 py-2">有帮助率</th><th className="px-3 py-2">引用准确率</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {summary.feedback.responseModePerformance.map((item) => (
                      <tr key={item.responseMode}>
                        <td className="px-3 py-2 font-medium text-ink-800">{responseModeText(item.responseMode)}</td>
                        <td className="px-3 py-2 text-ink-600">{item.total}</td>
                        <td className="px-3 py-2 text-ink-600">{percent(item.helpfulRate)}</td>
                        <td className="px-3 py-2 text-ink-600">{percent(item.citationAccuracyRate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!summary.feedback.responseModePerformance.length ? <p className="rounded-md bg-slate-50 p-4 text-sm text-ink-500">暂无反馈数据，用户在回答卡片提交反馈后会显示统计。</p> : null}
              </div>
            </article>
          </section>

          <section className="grid gap-5 lg:grid-cols-2">
            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-ink-900">最近错误摘要</h2>
              <div className="mt-4 space-y-3">
                {summary.recentErrors.length ? summary.recentErrors.map((item) => (
                  <div key={item.createdAt + item.questionPreview} className="rounded-md bg-rose-50 p-3 text-sm leading-6 text-rose-800">
                    <p className="font-semibold">{formatDate(item.createdAt)} · {responseModeText(item.responseMode)}</p>
                    <p className="break-words">问题摘要：{item.questionPreview || "无问题摘要"}</p>
                    <p>错误类型：{item.errorType || "real_error_fallback"}{item.httpStatus ? ` · HTTP ${item.httpStatus}` : ""}</p>
                  </div>
                )) : <p className="rounded-md bg-slate-50 p-4 text-sm text-ink-500">暂无错误摘要。</p>}
              </div>
            </article>

            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-ink-900">最近负反馈摘要</h2>
              <div className="mt-4 space-y-3">
                {summary.feedback.recentNegative.length ? summary.feedback.recentNegative.map((item) => (
                  <div key={item.id} className="rounded-md bg-slate-50 p-3 text-sm leading-6 text-ink-600">
                    <p className="font-semibold text-ink-900">{formatDate(item.createdAt)} · {item.values.map(feedbackText).join(" / ")}</p>
                    <p className="break-words">问题摘要：{item.questionPreview}</p>
                    {item.reasonPreview ? <p className="break-words text-ink-500">原因摘要：{item.reasonPreview}</p> : null}
                  </div>
                )) : <p className="rounded-md bg-slate-50 p-4 text-sm text-ink-500">暂无负反馈或引用不准确记录。</p>}
              </div>
            </article>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-ink-900">最近 Agent 调用</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-[760px] text-left text-sm">
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
                      <td className="whitespace-nowrap px-3 py-2 font-semibold text-ink-900">{responseModeText(item.responseMode)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-ink-600">{distributionLabel(item.scenario)} / {distributionLabel(item.intent)}</td>
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
