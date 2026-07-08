"use client";

import { useState } from "react";
import { MockJsonPanel } from "@/components/MockJsonPanel";
import { runToolDemo } from "@/lib/tools";
import type { ToolDefinition, ToolRunResult } from "@/types";

type ToolCardProps = {
  tool: ToolDefinition;
  businessName?: string;
  businessGoal?: string;
  exampleQuestions?: string[];
};

function chatQuestionHref(question: string) {
  return `/chat?question=${encodeURIComponent(question)}`;
}

function statusLabel(status?: ToolRunResult["status"]) {
  if (status === "success") return "执行成功";
  if (status === "failed") return "执行失败";
  return "待执行";
}

function summarizeResult(result: ToolRunResult | null) {
  if (!result) return "点击运行后会模拟 Agent 调用该业务工具，并展示返回结果。";
  if (result.status === "failed") return result.error ?? "工具执行失败，请检查输入参数。";

  const data = result.data as Record<string, unknown> | undefined;
  if (!data) return "工具已执行，返回结果为空。";
  if (typeof data.message === "string") return data.message;
  if (typeof data.returnAdvice === "string") return data.returnAdvice;
  if (typeof data.reply === "string") return data.reply;
  if (typeof data.ticketId === "string") return `已创建工单：${data.ticketId}`;
  if (typeof data.matchScore === "number") return `匹配分：${data.matchScore}，可继续查看匹配点和能力缺口。`;
  if (typeof data.stockStatus === "string") return `库存状态：${data.stockStatus}`;
  return "工具已执行，可查看下方结构化结果。";
}

export function ToolCard({ tool, businessName, businessGoal, exampleQuestions = [] }: ToolCardProps) {
  const [result, setResult] = useState<ToolRunResult | null>(null);

  function handleRun() {
    setResult(runToolDemo(tool.name, tool.inputExample));
  }

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-lg font-semibold text-ink-900">{businessName ?? tool.description}</h3>
            <span className="rounded-md bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 ring-1 ring-brand-100">{tool.name}</span>
            <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-ink-500">{tool.scenario}</span>
          </div>
          <p className="mt-2 text-sm leading-6 text-ink-600">{businessGoal ?? tool.description}</p>
        </div>
        <button
          type="button"
          onClick={handleRun}
          className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 lg:w-auto"
        >
          模拟执行业务工具
        </button>
      </div>

      {exampleQuestions.length ? (
        <div className="mb-4 rounded-lg border border-brand-100 bg-brand-50 p-4">
          <p className="text-xs font-semibold text-brand-700">可直接用这些问题验证 Agent 编排</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {exampleQuestions.map((question) => (
              <a key={question} href={chatQuestionHref(question)} className="rounded-md bg-white px-3 py-2 text-xs font-semibold text-brand-700 ring-1 ring-brand-100 hover:bg-brand-100">{question}</a>
            ))}
          </div>
        </div>
      ) : null}

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
            {statusLabel(result?.status)}
          </span>
        </div>
        <p className="mb-3 rounded-md bg-white p-3 text-sm leading-6 text-ink-600 ring-1 ring-slate-200">
          {summarizeResult(result)}
        </p>
        {result ? (
          <pre className="max-h-[360px] overflow-auto rounded-md bg-white p-4 text-xs leading-6 text-ink-700 ring-1 ring-slate-200">
            {JSON.stringify(result, null, 2)}
          </pre>
        ) : (
          <p className="rounded-md bg-white p-4 text-sm text-ink-500 ring-1 ring-slate-200">
            这里展示的是本地业务工具的模拟返回，用于解释 Agent 在回答前做了哪些查询、判断或工单动作。
          </p>
        )}
      </section>
    </article>
  );
}
