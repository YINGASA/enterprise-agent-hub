"use client";

import { AgentRouteCard } from "@/components/AgentRouteCard";
import { AgentStepList } from "@/components/AgentStepList";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { MockJsonPanel } from "@/components/MockJsonPanel";
import { StructuredOutputPanel } from "@/components/StructuredOutputPanel";
import type { AgentApiResponse } from "@/types";

export function AgentTracePanel({ result }: { result: AgentApiResponse | null }) {
  if (!result) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-ink-900">Agent 执行轨迹</h3>
        <p className="mt-2 text-sm leading-6 text-ink-500">运行问题后，可在这里展开 Router、RAG、工具调用和结构化输出。</p>
      </section>
    );
  }

  return (
    <div className="min-w-0 space-y-4">
      <CollapsibleSection title="Streaming" description="只展示流式模式、降级、停止和事件数量等安全标量，不展示原始事件载荷。" defaultOpen={false}>
        <MockJsonPanel title="流式安全摘要" data={{ streamingRequested: result.api.streamingRequested === true, streamingUsed: result.api.streamingUsed === true, streamFallback: result.api.streamFallback === true, aborted: result.api.aborted === true, deltaCount: Number.isInteger(result.api.streamDeltaCount) ? Math.max(0, result.api.streamDeltaCount ?? 0) : 0, durationMs: Number.isFinite(result.api.llmDurationMs) ? Math.max(0, Math.floor(result.api.llmDurationMs ?? 0)) : 0 }} />
      </CollapsibleSection>
      <CollapsibleSection title="Conversation Context" description="仅展示安全的上下文数量、预算和裁剪策略，不展示历史原文。" defaultOpen={false}>
        <MockJsonPanel title="上下文安全摘要" data={{ contextApplied: result.api.contextApplied === true, contextMessageCount: result.api.contextMessageCount ?? 0, contextCharacterCount: result.api.contextCharacterCount ?? 0, estimatedTokens: Math.ceil((result.api.contextCharacterCount ?? 0) / 4), contextTruncated: result.api.contextTruncated === true, strategy: "recent-complete-messages", finalMessageStructure: { systemRules: 1, untrustedHistoryMessages: result.api.contextMessageCount ?? 0, currentQuestion: 1 }, longTermMemoryApplied: false, summaryApplied: false }} />
      </CollapsibleSection>
      <CollapsibleSection title="Router 决策" description="场景、意图、是否需要 RAG 与工具选择。" defaultOpen={false}>
        <AgentRouteCard route={result.route} />
      </CollapsibleSection>
      <CollapsibleSection title="Full Agent Steps" description="完整步骤输入、输出、状态和耗时。" defaultOpen={false}>
        <AgentStepList steps={result.steps} />
      </CollapsibleSection>
      <CollapsibleSection title="Full Retrieved Chunks" description="RAG 召回 chunk、score、matchedKeywords 与 scoreReason。" defaultOpen={false}>
        <MockJsonPanel
          title="RAG 检索结果"
          data={
            result.ragAnswer
              ? {
                  mode: result.ragAnswer.mode,
                  answer: result.ragAnswer.answer,
                  retrievedChunks: result.ragAnswer.retrievedChunks,
                  sources: result.ragAnswer.sources,
                }
              : { skipped: true }
          }
        />
      </CollapsibleSection>
      <CollapsibleSection title="Tool Results" description="本地业务工具调用结果。" defaultOpen={false}>
        <MockJsonPanel title="工具调用结果" data={result.toolResults.length > 0 ? result.toolResults : { skipped: true }} />
      </CollapsibleSection>
      <CollapsibleSection title="Structured JSON" description="最终 AgentResponse 结构化输出。" defaultOpen={false}>
        <StructuredOutputPanel output={result.structuredOutput} />
      </CollapsibleSection>
    </div>
  );
}
