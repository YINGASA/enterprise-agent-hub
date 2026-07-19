"use client";

import { AgentRouteCard } from "@/components/AgentRouteCard";
import { AgentStepList } from "@/components/AgentStepList";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { SourceList } from "@/components/SourceList";
import { StructuredOutputPanel } from "@/components/StructuredOutputPanel";
import { StatePanel } from "@/components/ui/StatePanel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { AgentApiResponse, ContextStrategy, ContextTruncationReason } from "@/types";

function strategyLabel(strategy: ContextStrategy) {
  const labels: Record<ContextStrategy, string> = {
    recent_only: "最近消息",
    recent_selective: "最近消息 + 相关历史",
    summary_recent: "滚动摘要 + 最近消息",
    summary_selective: "滚动摘要 + 相关历史 + 最近消息",
  };
  return labels[strategy];
}

function truncationLabel(reason: ContextTruncationReason) {
  const labels: Record<ContextTruncationReason, string> = {
    none: "未裁剪",
    tool_results: "已裁剪工具结果",
    rag_evidence: "已裁剪检索依据",
    selected_history: "已裁剪相关历史",
    recent_messages: "已裁剪较早消息",
    priority_sections_exceed_budget: "优先内容超过预算",
    safety_margin_exceeded: "触发安全余量",
  };
  return labels[reason];
}

function TraceMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
      <dt className="text-xs text-ink-500">{label}</dt>
      <dd className="app-tabular mt-1 break-words text-sm font-semibold text-ink-800">{value}</dd>
    </div>
  );
}

export function AgentTracePanel({ result }: { result: AgentApiResponse | null }) {
  if (!result) {
    return <StatePanel title="暂无执行过程" description="回答完成后，可以在这里查看安全的路由、检索、工具和上下文预算状态。" tone="neutral" />;
  }

  const contextTrace = result.api.contextTrace;
  return (
    <div className="min-w-0 space-y-3">
      <CollapsibleSection title="流式状态" description="展示请求动作、流式使用情况、完成状态和耗时；不展示原始事件载荷。" defaultOpen={false}>
        <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <TraceMetric label="请求动作" value={result.api.requestAction ?? "send"} />
          <TraceMetric label="响应方式" value={result.api.streamingUsed ? "流式响应" : result.api.streamFallback ? "完整响应兜底" : "完整响应"} />
          <TraceMetric label="增量事件" value={Number.isInteger(result.api.streamDeltaCount) ? Math.max(0, result.api.streamDeltaCount ?? 0) : 0} />
          <TraceMetric label="模型耗时" value={`${Number.isFinite(result.api.llmDurationMs) ? Math.max(0, Math.floor(result.api.llmDurationMs ?? 0)) : 0}ms`} />
          <TraceMetric label="请求结果" value={result.api.aborted ? "已停止" : "已完成"} />
        </dl>
      </CollapsibleSection>

      <CollapsibleSection title="上下文预算" description="只展示服务端生成的安全 Context Trace 标量，不展示历史消息、摘要或提示词正文。" defaultOpen={false}>
        {contextTrace ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <StatusBadge tone="info">{strategyLabel(contextTrace.contextStrategy)}</StatusBadge>
              <StatusBadge tone={contextTrace.summaryUsed ? "success" : "neutral"}>摘要{contextTrace.summaryUsed ? "已使用" : "未使用"}</StatusBadge>
              <StatusBadge tone={contextTrace.truncationReason === "none" ? "success" : "warning"}>{truncationLabel(contextTrace.truncationReason)}</StatusBadge>
            </div>
            <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <TraceMetric label="输入估算" value={`${contextTrace.totalInputEstimate} tokens`} />
              <TraceMetric label="输入预算" value={`${contextTrace.budgetLimit} tokens`} />
              <TraceMetric label="候选消息" value={contextTrace.candidateMessageCount ?? 0} />
              <TraceMetric label="最近消息" value={contextTrace.recentMessageCount} />
              <TraceMetric label="相关历史" value={contextTrace.selectedHistoryCount} />
              <TraceMetric label="摘要覆盖消息" value={contextTrace.summaryMessageCount} />
              <TraceMetric label="已丢弃消息" value={contextTrace.droppedMessageCount} />
              <TraceMetric label="RAG 依据" value={contextTrace.ragIncluded ? "已纳入" : "未纳入"} />
              <TraceMetric label="工具结果" value={contextTrace.toolResultsIncluded ? "已纳入" : "未纳入"} />
            </dl>
            {contextTrace.summaryUpdated || contextTrace.summaryFallbackReason ? <p className="text-xs leading-5 text-ink-500">摘要状态：{contextTrace.summaryUpdated ? "本轮已增量更新" : "本轮未更新"}{contextTrace.summaryVersion ? ` · 版本 ${contextTrace.summaryVersion}` : ""}{contextTrace.summaryFallbackReason ? ` · 安全回退 ${contextTrace.summaryFallbackReason}` : ""}</p> : null}
          </div>
        ) : <StatePanel compact title="本次运行未返回 Context Trace" description="界面不会使用字符数推算或固定策略文案替代服务端预算结果。" tone="neutral" />}
      </CollapsibleSection>

      <CollapsibleSection title="路由决策" description="展示场景、意图、RAG 与工具选择。" defaultOpen={false}>
        <AgentRouteCard route={result.route} />
      </CollapsibleSection>
      <CollapsibleSection title="执行步骤" description="展示步骤状态和耗时；输入与输出内容已脱敏。" defaultOpen={false}>
        <AgentStepList steps={result.steps} />
      </CollapsibleSection>
      <CollapsibleSection title="检索依据" description="展示可引用来源及安全评分信息，不展示完整知识正文。" defaultOpen={false}>
        <SourceList sources={result.ragAnswer?.sources ?? []} />
      </CollapsibleSection>
      <CollapsibleSection title="工具状态" description="只展示工具名称、完成状态和执行时间。" defaultOpen={false}>
        {result.toolResults.length ? <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">{result.toolResults.map((tool, index) => <div key={`${tool.tool}-${index}`} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm"><span className="font-medium text-ink-800">{tool.tool}</span><span className="flex items-center gap-2"><StatusBadge tone={tool.status === "success" ? "success" : "danger"}>{tool.status === "success" ? "成功" : "失败"}</StatusBadge><time className="app-tabular text-xs text-ink-500" dateTime={tool.executedAt}>{tool.executedAt}</time></span></div>)}</div> : <StatePanel compact title="本轮未调用工具" description="Router 未选择业务工具，或工具阶段已安全跳过。" tone="neutral" />}
      </CollapsibleSection>
      <CollapsibleSection title="结构化结果" description="展示本轮 AgentResponse 的结构化输出。" defaultOpen={false}>
        <StructuredOutputPanel output={result.structuredOutput} />
      </CollapsibleSection>
    </div>
  );
}
