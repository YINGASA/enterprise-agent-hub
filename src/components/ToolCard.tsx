"use client";

import Link from "next/link";
import { useState } from "react";
import { MockJsonPanel } from "@/components/MockJsonPanel";
import { StatePanel } from "@/components/ui/StatePanel";
import { StatusBadge } from "@/components/ui/StatusBadge";
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
    <article data-testid={`tool-card-${tool.name}`} className="py-5 first:pt-0 last:pb-0">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-ink-950 sm:text-lg">{businessName ?? tool.description}</h3>
            <StatusBadge tone="info" showDot={false}>{tool.name}</StatusBadge>
          </div>
          <p className="mt-1 text-sm leading-6 text-ink-500">{businessGoal ?? tool.description}</p>
          <p className="mt-2 text-xs text-ink-500">适用范围：{tool.scenario}</p>
        </div>
        <button
          type="button"
          data-testid={`tool-run-${tool.name}`}
          onClick={handleRun}
          className="app-button-primary w-full lg:w-auto"
        >
          运行本地演示
        </button>
      </div>

      {exampleQuestions.length ? (
        <div className="mt-4 border-l-2 border-brand-200 pl-3">
          <p className="text-xs font-semibold text-ink-600">带入聊天工作台验证</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {exampleQuestions.map((question) => (
              <Link key={question} href={chatQuestionHref(question)} className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-brand-700 hover:border-brand-200 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                {question}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <details className="mt-4 rounded-lg border border-slate-200 bg-slate-50">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-ink-700 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500">
          查看接口输入与输出示例
        </summary>
        <div className="grid gap-4 border-t border-slate-200 p-4 lg:grid-cols-2">
          <MockJsonPanel title="输入参数示例" data={tool.inputExample} />
          <MockJsonPanel title="输出结果示例" data={tool.outputExample} />
        </div>
      </details>

      <div data-testid={`tool-result-${tool.name}`} className="mt-4" aria-live="polite" aria-atomic="true">
        {result ? (
          <section role={result.status === "failed" ? "alert" : "status"} className={`rounded-lg border p-4 ${result.status === "success" ? "border-emerald-200 bg-emerald-50/70" : "border-rose-200 bg-rose-50"}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-ink-950">本次执行结果</h4>
              <StatusBadge tone={result.status === "success" ? "success" : "danger"}>{statusLabel(result.status)}</StatusBadge>
            </div>
            <p className="mt-2 text-sm leading-6 text-ink-700">{summarizeResult(result)}</p>
            <details className="mt-3 rounded-md border border-current/10 bg-white/80">
              <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-ink-600 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500">
                查看本次执行的原始 JSON
              </summary>
              <pre className="max-h-[360px] overflow-auto whitespace-pre-wrap break-words border-t border-slate-200 p-3 text-xs leading-6 text-ink-700">
                {JSON.stringify(result, null, 2)}
              </pre>
            </details>
          </section>
        ) : (
          <StatePanel
            compact
            title="等待执行"
            description="运行后会在这里显示业务摘要和明确状态；技术 JSON 默认收起，避免干扰业务判断。"
          />
        )}
      </div>
    </article>
  );
}
