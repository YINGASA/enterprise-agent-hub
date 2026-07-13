"use client";

import { AgentTracePanel } from "@/components/AgentTracePanel";
import { AgentFeedbackPanel } from "@/components/agent-workspace/AgentFeedbackPanel";
import type { AgentApiResponse, ChatAnswerFeedbackValue, ConversationMessage, KnowledgeSourceType, ToolName } from "@/types";
import type { MessageFeedbackDraft } from "@/components/chat-workspace/types";

type AssistantMessageProps = {
  message: ConversationMessage;
  result?: AgentApiResponse;
  feedback: MessageFeedbackDraft;
  onToggleFeedback: (messageId: string, value: ChatAnswerFeedbackValue) => void;
  onFeedbackReasonChange: (messageId: string, value: string) => void;
  onSubmitFeedback: (messageId: string) => void;
};

function responseModeLabel(mode?: string) {
  const labels: Record<string, string> = { mock: "模拟模式", real: "真实模型", real_repaired: "真实模型 · 已修复", real_text_fallback: "真实文本兜底", real_error_fallback: "真实模型失败 · 已兜底", fallback: "兜底模式" };
  return mode ? labels[mode] ?? mode : "Agent 回答";
}

function responseModeClass(mode?: string) {
  if (mode === "real" || mode === "real_repaired") return "bg-emerald-50 text-emerald-700";
  if (mode === "real_error_fallback") return "bg-rose-50 text-rose-700";
  if (mode === "fallback" || mode === "real_text_fallback") return "bg-amber-50 text-amber-800";
  return "bg-slate-100 text-ink-600";
}

function sourceTypeLabel(sourceType?: KnowledgeSourceType) {
  if (sourceType === "user_upload") return "用户上传";
  if (sourceType === "user_paste") return "用户粘贴";
  return "默认知识库";
}

function toolLabel(tool: ToolName) {
  const labels: Record<ToolName, string> = { queryOrder: "订单查询", queryProduct: "商品查询", searchPolicy: "规则检索", createTicket: "工单创建", analyzeJD: "JD 匹配", generateCustomerReply: "客服回复" };
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
    },
  };
}

export function AssistantMessage({ message, result, feedback, onToggleFeedback, onFeedbackReasonChange, onSubmitFeedback }: AssistantMessageProps) {
  const details = message.details;
  const contextRounds = Math.max(1, Math.ceil((message.contextMessageCount ?? 0) / 2));
  return (
    <article data-testid="conversation-message-assistant" data-message-id={message.id} className="flex min-w-0 justify-start">
      <div className="min-w-0 max-w-[92%] sm:max-w-[86%] lg:max-w-[82%]">
        <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs text-ink-500">
          <span className="font-semibold text-ink-700">Enterprise Agent</span>
          <span className={"rounded px-2 py-0.5 font-medium " + responseModeClass(message.responseMode)}>{responseModeLabel(message.responseMode)}</span>
          <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
        </div>
        <div className="rounded-2xl rounded-tl-md border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          {message.responseMode === "real_error_fallback" ? <p className="mb-3 rounded-lg bg-amber-50 p-3 text-sm leading-6 text-amber-900">真实模型连接失败，本次已使用模拟模式。</p> : null}
          <div data-testid="assistant-answer" className="min-w-0"><p data-testid="agent-answer" className="whitespace-pre-wrap break-words text-[15px] leading-7 text-ink-800">{message.content}</p></div>
          {message.contextApplied ? <p data-testid="assistant-context-meta" className="mt-3 text-xs text-ink-500">已参考最近 {contextRounds} 轮对话{message.contextTruncated ? "，较早内容已省略" : ""}</p> : null}
          {details?.needsClarification ? <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">当前回答需要你补充信息后才能继续判断。</p> : null}

          {(details?.sources?.length || details?.tools?.length || details?.steps?.length) ? (
            <details data-testid="assistant-details" className="mt-4 border-t border-slate-100 pt-3">
              <summary className="cursor-pointer text-sm font-semibold text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">查看依据、工具与执行过程</summary>
              <div className="mt-3 space-y-4">
                {details?.sources?.length ? <section data-testid="assistant-sources"><h3 className="text-xs font-semibold uppercase tracking-wide text-ink-500">回答依据</h3><div className="mt-2 space-y-2">{details.sources.map((source) => <div key={`${source.documentId}-${source.chunkIndexes.join("-")}`} className="rounded-lg bg-slate-50 p-3 text-sm"><p className="break-words font-semibold text-ink-800">{source.title}</p><p className="mt-1 text-xs text-ink-500">{source.category} · {sourceTypeLabel(source.sourceType)}{typeof source.score === "number" ? ` · 相关度 ${source.score}` : ""}</p></div>)}</div></section> : null}
                {details?.tools?.length ? <section data-testid="assistant-tools"><h3 className="text-xs font-semibold uppercase tracking-wide text-ink-500">业务工具</h3><div className="mt-2 flex flex-wrap gap-2">{details.tools.map((tool, index) => <span key={`${tool.tool}-${index}`} className={"rounded-md px-2.5 py-1.5 text-xs font-semibold " + (tool.status === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}>{toolLabel(tool.tool)} · {tool.status === "success" ? "成功" : "失败"}</span>)}</div></section> : null}
                {details?.steps?.length ? <section data-testid="assistant-trace-summary"><h3 className="text-xs font-semibold uppercase tracking-wide text-ink-500">Trace 摘要</h3><ol className="mt-2 space-y-2">{details.steps.map((step) => <li key={step.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-ink-600"><span>{step.name}</span><span>{step.status} · {step.durationMs}ms</span></li>)}</ol></section> : null}
                {result ? <details data-testid="assistant-trace" className="rounded-lg border border-slate-200 bg-slate-50 p-3"><summary className="cursor-pointer text-xs font-semibold text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">查看运行期安全 Trace</summary><div className="mt-3"><AgentTracePanel result={privacySafeTrace(result)} /></div></details> : null}
              </div>
            </details>
          ) : null}

          <details data-testid="assistant-feedback" className="mt-3 border-t border-slate-100 pt-3">
            <summary className="cursor-pointer text-xs font-semibold text-ink-500 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">评价本次回答</summary>
            <AgentFeedbackPanel values={feedback.values} reason={feedback.reason} message={feedback.message} onToggle={(value) => onToggleFeedback(message.id, value)} onReasonChange={(value) => onFeedbackReasonChange(message.id, value)} onSubmit={() => onSubmitFeedback(message.id)} />
          </details>
        </div>
      </div>
    </article>
  );
}
