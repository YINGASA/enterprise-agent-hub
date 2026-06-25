"use client";

import { AgentRouteCard } from "@/components/AgentRouteCard";
import { AgentStepList } from "@/components/AgentStepList";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { MockJsonPanel } from "@/components/MockJsonPanel";
import { StructuredOutputPanel } from "@/components/StructuredOutputPanel";
import type { AgentPipelineResult } from "@/types";

export function AgentTracePanel({ result }: { result: AgentPipelineResult | null }) {
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
