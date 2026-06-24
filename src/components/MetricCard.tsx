import type { EvaluationMetric } from "@/types";

export function MetricCard({ metric }: { metric: EvaluationMetric }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-ink-500">{metric.label}</p>
      <div className="mt-3 flex items-end justify-between gap-4">
        <p className="text-3xl font-bold text-ink-900">{metric.value}</p>
        <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">{metric.trend}</span>
      </div>
    </article>
  );
}
