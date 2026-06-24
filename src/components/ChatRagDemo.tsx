"use client";

import { useState } from "react";
import { RagResultPanel } from "@/components/RagResultPanel";
import { documents } from "@/data/mock";
import { runMockRagPipeline } from "@/lib/rag";
import type { RagAnswer } from "@/types";

const examples = ["公司报销需要什么材料", "订单退货规则是什么", "火星基地怎么申请"];

export function ChatRagDemo() {
  const [question, setQuestion] = useState(examples[0]);
  const [result, setResult] = useState<RagAnswer | null>(null);

  function handleRun() {
    setResult(runMockRagPipeline(question, documents));
  }

  return (
    <section className="mt-8 space-y-5">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-semibold text-ink-900">基础 RAG 演示</h2>
            <p className="mt-1 text-sm text-ink-500">只运行 mock RAG：文档切片、关键词检索、TopK 召回、来源引用和 mock 回答。</p>
          </div>
          <span className="w-fit rounded-md bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">mock-rag</span>
        </div>
        <div className="flex flex-col gap-3 lg:flex-row">
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            placeholder="输入一个知识库问题"
          />
          <button type="button" onClick={handleRun} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
            运行 RAG
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {examples.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setQuestion(example)}
              className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-ink-500 hover:bg-brand-50 hover:text-brand-700"
            >
              {example}
            </button>
          ))}
        </div>
      </div>
      <RagResultPanel result={result} />
    </section>
  );
}
