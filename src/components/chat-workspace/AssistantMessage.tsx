"use client";

import { useEffect, useRef, useState } from "react";
import { AgentTracePanel } from "@/components/AgentTracePanel";
import { AgentFeedbackPanel } from "@/components/agent-workspace/AgentFeedbackPanel";
import { MessageContent } from "@/components/chat-workspace/MessageContent";
import { SourceList } from "@/components/SourceList";
import { StatusBadge, type StatusTone } from "@/components/ui/StatusBadge";
import { copyAnswerText } from "@/lib/chat/messageActions";
import type { AgentApiResponse, ChatAnswerFeedbackValue, ConversationMessage, ToolName } from "@/types";
import type { MessageFeedbackDraft } from "@/components/chat-workspace/types";

type AssistantMessageProps = {
  message: ConversationMessage;
  result?: AgentApiResponse;
  feedback: MessageFeedbackDraft;
  canRegenerate: boolean;
  canSubmitFeedback: boolean;
  revisionActive: boolean;
  onRegenerate: (assistantMessageId: string) => void;
  onToggleFeedback: (messageId: string, value: ChatAnswerFeedbackValue) => void;
  onFeedbackReasonChange: (messageId: string, value: string) => void;
  onSubmitFeedback: (messageId: string) => void;
};

function responseModeLabel(mode?: string) {
  const labels: Record<string, string> = { mock: "模拟模式", real: "真实模型", real_repaired: "真实模型 · 已修复", real_text_fallback: "真实文本兜底", real_error_fallback: "真实模型失败 · 已兜底", fallback: "兜底模式" };
  return mode ? labels[mode] ?? mode : "Agent 回答";
}

function responseModeTone(mode?: string): StatusTone {
  if (mode === "real" || mode === "real_repaired") return "success";
  if (mode === "real_error_fallback") return "danger";
  if (mode === "fallback" || mode === "real_text_fallback") return "warning";
  return "neutral";
}

function toolLabel(tool: ToolName) {
  const labels: Record<ToolName, string> = { queryOrder: "订单查询", queryProduct: "商品查询", searchPolicy: "规则检索", createTicket: "工单创建", analyzeJD: "历史工具（已下线）", generateCustomerReply: "客服回复" };
  return labels[tool];
}

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }) : "";
}

function privacySafeTrace(result: AgentApiResponse): AgentApiResponse {
  return {
    ...result,
    steps: result.steps.map((step) => ({ ...step, input: { redacted: true }, output: { status: step.status } })),
    ragAnswer: result.ragAnswer ? {
      ...result.ragAnswer,
      answer: "回答内容已在当前消息正文中展示。",
      retrievedChunks: [],
      sources: result.ragAnswer.sources.map((source) => ({ documentId: source.documentId, title: source.title, category: source.category, packId: source.packId, sourceType: source.sourceType, score: source.score, chunkIndexes: source.chunkIndexes.slice(0, 8) })),
    } : null,
    toolResults: result.toolResults.map((tool) => ({ status: tool.status, tool: tool.tool, input: { redacted: true }, error: tool.error ? "tool_error" : undefined, executedAt: tool.executedAt })),
    api: {
      requestedMode: result.api.requestedMode,
      responseMode: result.api.responseMode,
      fallbackReason: result.api.fallbackReason,
      errorType: result.api.errorType,
      httpStatus: result.api.httpStatus,
      llmDurationMs: result.api.llmDurationMs,
      contextApplied: result.api.contextApplied,
      contextMessageCount: result.api.contextMessageCount,
      contextTruncated: result.api.contextTruncated,
      contextCharacterCount: result.api.contextCharacterCount,
      contextTrace: result.api.contextTrace ? { ...result.api.contextTrace } : undefined,
      streamingRequested: result.api.streamingRequested,
      streamingUsed: result.api.streamingUsed,
      streamFallback: result.api.streamFallback,
      aborted: result.api.aborted,
      streamDeltaCount: result.api.streamDeltaCount,
      requestAction: result.api.requestAction,
    },
  };
}

function stepStatusLabel(status: "success" | "failed" | "skipped") {
  return status === "success" ? "已完成" : status === "failed" ? "失败" : "已跳过";
}

function stepStatusTone(status: "success" | "failed" | "skipped"): StatusTone {
  return status === "success" ? "success" : status === "failed" ? "danger" : "neutral";
}

export function AssistantMessage({ message, result, feedback, canRegenerate, canSubmitFeedback, revisionActive, onRegenerate, onToggleFeedback, onFeedbackReasonChange, onSubmitFeedback }: AssistantMessageProps) {
  const details = message.details;
  const contextRounds = Math.max(1, Math.ceil((message.contextMessageCount ?? 0) / 2));
  const [copyStatus, setCopyStatus] = useState("");
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyAttempt = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      copyAttempt.current += 1;
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  async function copyAnswer() {
    const attempt = copyAttempt.current + 1;
    copyAttempt.current = attempt;
    const copied = await copyAnswerText(message.content);
    if (!mounted.current || copyAttempt.current !== attempt) return;
    setCopyStatus(copied.ok ? "已复制" : copied.error);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => {
      if (mounted.current && copyAttempt.current === attempt) setCopyStatus("");
    }, 2_000);
  }

  const sources = result?.ragAnswer?.sources?.length ? result.ragAnswer.sources : details?.sources ?? [];
  const ragExpected = result?.route.needRag === true;
  const hasSupportingDetails = Boolean(sources.length || ragExpected || details?.tools?.length || details?.steps?.length || result);

  return (
    <article data-testid="conversation-message-assistant" data-message-id={message.id} data-run-id={message.runId ?? ""} className="min-w-0 w-full">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-ink-500">
        <span className="font-semibold text-ink-800">Enterprise Agent</span>
        <StatusBadge tone={responseModeTone(message.responseMode)} showDot>{responseModeLabel(message.responseMode)}</StatusBadge>
        <time className="app-tabular" dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
      </div>
      <div className="app-panel min-w-0 p-4 sm:p-5">
        {message.responseMode === "real_error_fallback" ? <div role="status" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900"><span className="font-semibold">已启用安全兜底：</span>真实模型连接失败，本次使用模拟模式完成回答。</div> : null}
        <div data-testid="assistant-answer" className="min-w-0"><div data-testid="agent-answer"><MessageContent content={message.content} /></div></div>
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-slate-100 pt-3 text-xs text-ink-500">
          {result?.api.streamFallback ? <span data-testid="assistant-stream-fallback">完整响应模式</span> : null}
          {message.contextApplied ? <span data-testid="assistant-context-meta">已参考最近 {contextRounds} 轮对话{message.contextTruncated ? "，较早内容已按预算压缩" : ""}</span> : null}
        </div>
        {details?.needsClarification ? <div role="status" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><span className="font-semibold">需要补充信息：</span><span>当前回答需要你补充信息后才能继续判断。</span></div> : null}

        <div className="mt-3 flex min-h-9 flex-wrap items-center gap-1 border-t border-slate-100 pt-3 text-xs">
          <button type="button" data-testid="assistant-copy" aria-label="复制 Assistant 回答正文" onClick={() => void copyAnswer()} className="app-button-tertiary">复制回答</button>
          {canRegenerate ? <button type="button" data-testid="assistant-regenerate" aria-label="重新生成最后一条回答" disabled={revisionActive} onClick={() => onRegenerate(message.id)} className="app-button-tertiary disabled:cursor-not-allowed disabled:opacity-50">重新生成</button> : null}
          <span data-testid="assistant-copy-status" aria-live="polite" className="ml-1 text-ink-500">{copyStatus}</span>
        </div>

        {hasSupportingDetails ? (
          <details data-testid="assistant-details" className="group mt-4 border-t border-slate-100 pt-3">
            <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 rounded-md px-2 text-sm font-semibold text-brand-700 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
              <span>查看依据、工具与执行过程</span>
              <span className="text-xs text-ink-500"><span className="group-open:hidden">展开</span><span className="hidden group-open:inline">收起</span></span>
            </summary>
            <div className="mt-3 space-y-5 border-l-2 border-slate-100 pl-3 sm:pl-4">
              {(sources.length > 0 || ragExpected) ? (
                <section data-testid="assistant-sources" aria-labelledby={`assistant-sources-${message.id}`}>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h3 id={`assistant-sources-${message.id}`} className="text-sm font-semibold text-ink-800">回答依据</h3>
                    {result?.ragAnswer?.retrievalConfidence ? <StatusBadge tone={result.ragAnswer.lowConfidenceRetrieval ? "warning" : "info"} showDot={false}>检索置信度：{result.ragAnswer.retrievalConfidence}</StatusBadge> : null}
                  </div>
                  {result?.ragAnswer?.lowConfidenceReason ? <p className="mb-2 text-xs leading-5 text-amber-800">检索提示：{result.ragAnswer.lowConfidenceReason}</p> : null}
                  <SourceList sources={sources} />
                </section>
              ) : null}
              {details?.tools?.length ? <section data-testid="assistant-tools"><h3 className="text-sm font-semibold text-ink-800">业务工具</h3><div className="mt-2 flex flex-wrap gap-2">{details.tools.map((tool, index) => <StatusBadge key={`${tool.tool}-${index}`} tone={tool.status === "success" ? "success" : "danger"}>{toolLabel(tool.tool)} · {tool.status === "success" ? "成功" : "失败"}</StatusBadge>)}</div></section> : null}
              {details?.steps?.length ? <section data-testid="assistant-trace-summary"><h3 className="text-sm font-semibold text-ink-800">执行摘要</h3><ol className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">{details.steps.map((step) => <li key={step.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-xs text-ink-600"><span className="font-medium text-ink-700">{step.name}</span><span className="flex items-center gap-2"><StatusBadge tone={stepStatusTone(step.status)} showDot={false}>{stepStatusLabel(step.status)}</StatusBadge><span className="app-tabular">{step.durationMs}ms</span></span></li>)}</ol></section> : null}
              {result ? <details data-testid="assistant-trace" className="group/trace rounded-lg border border-slate-200 bg-slate-50 p-3"><summary className="flex min-h-9 cursor-pointer list-none items-center justify-between gap-3 text-xs font-semibold text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"><span>运行期安全 Trace</span><span className="text-ink-500"><span className="group-open/trace:hidden">展开</span><span className="hidden group-open/trace:inline">收起</span></span></summary><div className="mt-3"><AgentTracePanel result={privacySafeTrace(result)} /></div></details> : null}
            </div>
          </details>
        ) : null}

        {canSubmitFeedback ? <details data-testid="assistant-feedback" className="mt-3 border-t border-slate-100 pt-3">
          <summary className="inline-flex min-h-9 cursor-pointer items-center rounded-md px-2 text-xs font-semibold text-ink-500 hover:bg-slate-100 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">评价本次回答</summary>
          <AgentFeedbackPanel values={feedback.values} reason={feedback.reason} message={feedback.message} disabled={revisionActive} onToggle={(value) => onToggleFeedback(message.id, value)} onReasonChange={(value) => onFeedbackReasonChange(message.id, value)} onSubmit={() => onSubmitFeedback(message.id)} />
        </details> : null}
      </div>
    </article>
  );
}
