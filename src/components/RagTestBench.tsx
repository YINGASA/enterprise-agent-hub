"use client";

import { useEffect, useState } from "react";
import { runRagTestDiagnostic } from "@/lib/knowledge/ragTest";
import { saveRagTestHistoryItem } from "@/lib/knowledge/ragTestHistory";
import type { KnowledgeDocument, KnowledgeSourceType, RagTestDiagnostic, RagTestHistoryItem } from "@/types";

type Props = {
  documents: KnowledgeDocument[];
  currentDocument?: KnowledgeDocument;
  suggestedQuestions: string[];
  presetQuestion?: string;
  onHistoryChange: (items: RagTestHistoryItem[]) => void;
};

function sourceTypeLabel(sourceType: KnowledgeSourceType) {
  return sourceType === "user_upload" ? "用户上传" : sourceType === "user_paste" ? "用户粘贴" : "默认知识库";
}

function confidenceLabel(value: RagTestDiagnostic["retrievalConfidence"]) {
  return value === "high" ? "高" : value === "medium" ? "中" : "低";
}

export function RagTestBench({ documents, currentDocument, suggestedQuestions, presetQuestion, onHistoryChange }: Props) {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<RagTestDiagnostic | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (presetQuestion) setQuestion(presetQuestion);
  }, [presetQuestion]);

  function runTest(documentId?: string) {
    const normalizedQuestion = question.trim();
    if (!normalizedQuestion) {
      setNotice("请输入一个测试问题后再执行检索。");
      return;
    }
    const diagnostic = runRagTestDiagnostic(normalizedQuestion, documents, documentId);
    setResult(diagnostic);
    const saved = saveRagTestHistoryItem(diagnostic);
    onHistoryChange(saved.data);
    setNotice(saved.ok ? "检索诊断已完成，并保存到当前浏览器本地历史。" : saved.error);
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-semibold text-ink-900">RAG 检索测试台</h2>
          <p className="mt-1 text-sm leading-6 text-ink-500">仅执行场景识别与本地 Retriever 诊断，不调用 Real API、不执行工具、不消耗模型 token。</p>
        </div>
        {currentDocument ? <span className="rounded-md bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700">当前文档：{currentDocument.title}</span> : null}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto_auto]">
        <textarea value={question} onChange={(event) => setQuestion(event.target.value)} rows={3} className="min-w-0 rounded-md border border-slate-300 px-3 py-2 text-sm leading-6 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" placeholder="输入要验证的业务问题，例如：公司电脑怎么申请？" />
        <button type="button" onClick={() => runTest()} className="min-h-10 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">测试检索</button>
        <button type="button" onClick={() => runTest(currentDocument?.id)} disabled={!currentDocument} className="min-h-10 rounded-md border border-brand-200 px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400">测试当前文档</button>
      </div>

      {suggestedQuestions.length ? <div className="mt-3 flex flex-wrap gap-2">{suggestedQuestions.slice(0, 3).map((item) => <button key={item} type="button" onClick={() => setQuestion(item)} className="rounded-md border border-slate-200 px-3 py-1.5 text-xs text-ink-600 hover:bg-slate-50">{item}</button>)}</div> : null}
      {notice ? <p className="mt-3 rounded-md bg-slate-50 p-3 text-sm text-ink-600">{notice}</p> : null}

      {result ? (
        <div className="mt-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-md bg-slate-50 p-3"><p className="text-xs text-ink-500">场景 / 意图</p><p className="mt-1 break-words text-sm font-semibold text-ink-900">{result.route.scenario} / {result.route.intent}</p></div>
            <div className="rounded-md bg-slate-50 p-3"><p className="text-xs text-ink-500">候选 / 可靠来源</p><p className="mt-1 text-sm font-semibold text-ink-900">{result.candidateCount} / {result.reliableSourceCount}</p></div>
            <div className="rounded-md bg-slate-50 p-3"><p className="text-xs text-ink-500">检索置信度</p><p className="mt-1 text-sm font-semibold text-ink-900">{confidenceLabel(result.retrievalConfidence)}{result.fallback ? " · 当前依据不足" : ""}</p></div>
            <div className="rounded-md bg-slate-50 p-3"><p className="text-xs text-ink-500">用户文档命中</p><p className="mt-1 text-sm font-semibold text-ink-900">{result.hitUserDocument ? "是" : "否"}</p></div>
          </div>

          {result.needsClarification ? <p className="rounded-md bg-amber-50 p-3 text-sm leading-6 text-amber-800">需要补充信息：{result.clarificationQuestion ?? "请补充更具体的业务信息。"}</p> : null}
          {result.currentDocumentId ? <p className={`rounded-md p-3 text-sm ${result.hitCurrentDocument ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>{result.hitCurrentDocument ? `当前文档已命中${result.currentDocumentIsTopSource ? "，且为第一来源" : `，位于第 ${result.sources.findIndex((source) => source.documentId === result.currentDocumentId) + 1} 个来源`}；chunk #${result.currentDocumentChunkIndex}。` : `当前文档未命中：${result.currentDocumentMissReason}`}</p> : null}
          {result.lowConfidenceReason ? <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">当前依据不足：{result.lowConfidenceReason}</p> : null}

          <div className="space-y-3">
            <h3 className="font-semibold text-ink-900">可靠来源</h3>
            {result.sources.length ? result.sources.map((source) => (
              <article key={source.sourceId} className="rounded-md border border-slate-200 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><p className="break-words font-semibold text-ink-900">{source.title}</p><p className="mt-1 break-all text-xs text-ink-500">{source.sourceId} · chunk #{source.chunkIndex}</p></div><span className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-ink-600">{source.score} 分 · {confidenceLabel(source.confidence)}</span></div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs"><span className="rounded bg-slate-100 px-2 py-1 text-ink-600">{sourceTypeLabel(source.sourceType)}</span>{source.isUserDocument ? <span className="rounded bg-emerald-50 px-2 py-1 text-emerald-700">用户新增文档</span> : null}{source.matchedSignals.map((signal) => <span key={signal} className="rounded bg-brand-50 px-2 py-1 text-brand-700">{signal}</span>)}</div>
                <p className="mt-3 break-words text-sm leading-6 text-ink-600">{source.contentPreview}</p>
                <p className="mt-2 break-words text-xs text-ink-500">命中原因：{source.scoreReason.join("；") || "有效关键词或结构化字段匹配"}</p>
              </article>
            )) : <p className="rounded-md bg-slate-50 p-4 text-sm text-ink-500">未找到可靠来源。建议补充标题、标签、正文关键词，或换一种更具体的问法。</p>}
          </div>
        </div>
      ) : null}
    </section>
  );
}
