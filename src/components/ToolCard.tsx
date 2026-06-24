import { MockJsonPanel } from "@/components/MockJsonPanel";
import type { ToolDefinition } from "@/types";

export function ToolCard({ tool }: { tool: ToolDefinition }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="font-mono text-lg font-semibold text-brand-700">{tool.name}</h3>
        <p className="mt-2 text-sm leading-6 text-ink-500">{tool.description}</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <MockJsonPanel title="输入参数示例" data={tool.inputExample} />
        <MockJsonPanel title="输出结果示例" data={tool.outputExample} />
      </div>
    </article>
  );
}
