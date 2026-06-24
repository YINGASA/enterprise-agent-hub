import type { AgentRoute } from "@/types";

export function AgentRouteCard({ route }: { route: AgentRoute }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-ink-900">Router 决策结果</h3>
        <span className="rounded-md bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">{Math.round(route.confidence * 100)}%</span>
      </div>
      <div className="grid gap-2 text-sm text-ink-700">
        <p>场景：{route.scenario}</p>
        <p>意图：{route.intent}</p>
        <p>RAG：{route.needRag ? "需要" : "跳过"}</p>
        <p>工具：{route.toolsNeeded.length > 0 ? route.toolsNeeded.join(", ") : "无"}</p>
      </div>
      <p className="mt-3 rounded-md bg-slate-50 p-3 text-xs leading-5 text-ink-500">{route.reason}</p>
    </section>
  );
}
