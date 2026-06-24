import { AgentRouteCard } from "@/components/AgentRouteCard";
import { AgentStepList } from "@/components/AgentStepList";
import { MockJsonPanel } from "@/components/MockJsonPanel";
import { StructuredOutputPanel } from "@/components/StructuredOutputPanel";
import type { AgentPipelineResult } from "@/types";

export function AgentTracePanel({ result }: { result: AgentPipelineResult | null }) {
  if (!result) {
    return (
      <aside className="space-y-4">
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-ink-900">Agent 执行轨迹</h3>
          <p className="mt-2 text-sm leading-6 text-ink-500">运行示例问题后，这里会展示 Router、RAG、工具调用和结构化输出。</p>
        </section>
      </aside>
    );
  }

  return (
    <aside className="space-y-4">
      <AgentRouteCard route={result.route} />
      <AgentStepList steps={result.steps} />
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
      <MockJsonPanel title="工具调用结果" data={result.toolResults.length > 0 ? result.toolResults : { skipped: true }} />
      <StructuredOutputPanel output={result.structuredOutput} />
    </aside>
  );
}
