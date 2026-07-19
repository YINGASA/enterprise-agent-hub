import type { EvaluationMetric } from "@/types";

export function MetricCard({ metric }: { metric: EvaluationMetric }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-panel">
      <p className="text-xs font-medium text-ink-500">{metric.label}</p>
      <div className="mt-2 flex items-end justify-between gap-4">
        <p className="app-tabular text-2xl font-semibold tracking-tight text-ink-950">{metric.value}</p>
        <span className="rounded-md border border-emerald-100 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">{metric.trend}</span>
      </div>
    </article>
  );
}
