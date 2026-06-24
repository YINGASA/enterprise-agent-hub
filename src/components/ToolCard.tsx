"use client";

import { useState } from "react";
import { MockJsonPanel } from "@/components/MockJsonPanel";
import { runToolDemo } from "@/lib/tools";
import type { ToolDefinition, ToolRunResult } from "@/types";

export function ToolCard({ tool }: { tool: ToolDefinition }) {
  const [result, setResult] = useState<ToolRunResult | null>(null);

  function handleRun() {
    setResult(runToolDemo(tool.name, tool.inputExample));
  }

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="font-mono text-lg font-semibold text-brand-700">{tool.name}</h3>
            <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-ink-500">{tool.scenario}</span>
          </div>
          <p className="mt-2 text-sm leading-6 text-ink-500">{tool.description}</p>
        </div>
        <button
          type="button"
          onClick={handleRun}
          className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 lg:w-auto"
        >
          运行示例
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <MockJsonPanel title="输入参数示例" data={tool.inputExample} />
        <MockJsonPanel title="输出结果示例" data={tool.outputExample} />
      </div>

      <section className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h4 className="text-sm font-semibold text-ink-900">本地工具调用结果</h4>
          <span
            className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
              result?.status === "success"
                ? "bg-emerald-50 text-emerald-700"
                : result?.status === "failed"
                  ? "bg-rose-50 text-rose-700"
                  : "bg-slate-200 text-ink-500"
            }`}
          >
            {result?.status ?? "idle"}
          </span>
        </div>
        {result ? (
          <pre className="max-h-[360px] overflow-auto rounded-md bg-white p-4 text-xs leading-6 text-ink-700 ring-1 ring-slate-200">
            {JSON.stringify(result, null, 2)}
          </pre>
        ) : (
          <p className="rounded-md bg-white p-4 text-sm text-ink-500 ring-1 ring-slate-200">
            点击“运行示例”后，会调用 src/lib/tools 中的本地 mock 工具函数，并在这里展示返回 JSON。
          </p>
        )}
      </section>
    </article>
  );
}
