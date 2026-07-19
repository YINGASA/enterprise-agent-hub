"use client";

import type { EvaluationRunHistoryItem } from "@/types";

type TrendSeries = {
  key: "passRate" | "fallbackRate" | "averageRagScore";
  label: string;
  color: string;
  values: number[];
  suffix: string;
};

type EvaluationTrendChartProps = {
  history: EvaluationRunHistoryItem[];
};

function metricValue(item: EvaluationRunHistoryItem, key: TrendSeries["key"]) {
  const value = item[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function buildPoints(values: number[], width: number, height: number, maxValue: number) {
  if (values.length < 2) return "";
  return values
    .map((value, index) => {
      const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
      const y = height - (Math.max(0, Math.min(value, maxValue)) / maxValue) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function formatValue(value: number, suffix: string) {
  return `${Math.round(value * 10) / 10}${suffix}`;
}

export function EvaluationTrendChart({ history }: EvaluationTrendChartProps) {
  const chronological = history.slice(0, 20).reverse();

  if (chronological.length < 2) {
    return (
      <section className="app-panel p-5">
        <h2 className="font-semibold text-ink-900">趋势图表</h2>
        <p className="mt-3 rounded-md border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-ink-500">
          保存至少 2 次评测后，可查看趋势变化。
        </p>
      </section>
    );
  }

  const series: TrendSeries[] = [
    { key: "passRate", label: "通过率", color: "#2563eb", values: chronological.map((item) => metricValue(item, "passRate") ?? 0), suffix: "%" },
    { key: "fallbackRate", label: "兜底率", color: "#d97706", values: chronological.map((item) => metricValue(item, "fallbackRate") ?? 0), suffix: "%" },
    { key: "averageRagScore", label: "平均 RAG 分数", color: "#059669", values: chronological.map((item) => metricValue(item, "averageRagScore") ?? 0), suffix: "" },
  ];

  const ragMax = Math.max(10, ...series[2].values);
  const width = 720;
  const height = 220;

  return (
    <section className="app-panel p-4 sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-semibold text-ink-900">趋势图表</h2>
          <p className="mt-1 text-sm text-ink-500">基于当前浏览器本地保存的最近 20 次评测记录生成。</p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-ink-500">
          {series.map((item) => (
            <span key={item.key} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              {item.label}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-5 overflow-x-auto rounded-lg border border-slate-100 bg-slate-50 p-3">
        <svg viewBox={`0 0 ${width} ${height + 36}`} className="h-72 min-w-[640px] w-full" role="img" aria-label="评测趋势图表">
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
            <line key={ratio} x1="0" x2={width} y1={height - ratio * height} y2={height - ratio * height} stroke="#e2e8f0" strokeWidth="1" />
          ))}
          {series.map((item) => {
            const maxValue = item.key === "averageRagScore" ? ragMax : 100;
            const points = buildPoints(item.values, width, height, maxValue);
            return (
              <g key={item.key}>
                <polyline points={points} fill="none" stroke={item.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                {item.values.map((value, index) => {
                  const x = item.values.length === 1 ? width / 2 : (index / (item.values.length - 1)) * width;
                  const y = height - (Math.max(0, Math.min(value, maxValue)) / maxValue) * height;
                  return <circle key={`${item.key}-${index}`} cx={x} cy={y} r="4" fill={item.color}><title>{`${item.label}: ${formatValue(value, item.suffix)}`}</title></circle>;
                })}
              </g>
            );
          })}
          {chronological.map((item, index) => {
            const x = chronological.length === 1 ? width / 2 : (index / (chronological.length - 1)) * width;
            return (
              <text key={item.id} x={x} y={height + 28} textAnchor="middle" className="fill-slate-500 text-[11px]">
                {new Date(item.createdAt).toLocaleDateString(undefined, { month: "2-digit", day: "2-digit" })}
              </text>
            );
          })}
        </svg>
      </div>
      <div className="sr-only">
        {series.map((item) => (
          <p key={item.key}>{item.label}：从 {formatValue(item.values[0] ?? 0, item.suffix)} 变化到 {formatValue(item.values[item.values.length - 1] ?? 0, item.suffix)}。</p>
        ))}
      </div>
    </section>
  );
}
