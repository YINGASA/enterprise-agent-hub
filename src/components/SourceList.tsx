import type { KnowledgeSourceType, RagAnswer } from "@/types";

const ui = {
  defaultSource: "默认知识库",
  userUpload: "用户上传",
  userPaste: "用户粘贴",
  noSources: "暂无来源引用。",
  userDoc: "用户文档",
  pack: "知识库：",
  tags: "标签：",
  matchedKeywords: "命中关键词：",
  scoreReason: "命中原因：",
  chunks: "切片",
  score: "得分",
  scoreBreakdown: "评分拆解：",
};

function sourceTypeLabel(sourceType?: KnowledgeSourceType) {
  const labels: Record<KnowledgeSourceType, string> = {
    default: ui.defaultSource,
    user_upload: ui.userUpload,
    user_paste: ui.userPaste,
  };
  return sourceType ? labels[sourceType] ?? sourceType : ui.defaultSource;
}

function packLabel(packId?: string) {
  const labels: Record<string, string> = {
    "enterprise-policy": "企业 IT / 行政制度知识库",
    "ecommerce-support": "电商客服售后知识库",
    "recruitment-career": "历史知识包（已下线）",
    "ai-engineering": "AI 工程规范知识库",
  };
  return packId ? labels[packId] ?? packId : ui.defaultSource;
}

export function SourceList({ sources }: { sources: RagAnswer["sources"] }) {
  if (sources.length === 0) {
    return <p className="text-sm text-ink-500">{ui.noSources}</p>;
  }

  return (
    <div className="space-y-3">
      {sources.map((source) => (
        <details key={source.documentId} className="rounded-md border border-slate-200 bg-white p-3 open:bg-brand-50/40">
          <summary className="cursor-pointer list-none">
            <div className="flex flex-wrap items-center gap-2">
              <span className="break-words text-sm font-semibold text-ink-900">{source.title}</span>
              <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-ink-600">{sourceTypeLabel(source.sourceType)}</span>
              {source.sourceType && source.sourceType !== "default" ? <span className="rounded bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">{ui.userDoc}</span> : null}
            </div>
            <p className="mt-1 break-words text-xs text-ink-500">
              {source.category}{" \u00b7 "}{packLabel(source.packId)}{" \u00b7 "}{ui.chunks} {source.chunkIndexes.join(", ")}{" \u00b7 "}{ui.score} {source.score ?? 0}
            </p>
          </summary>
          <div className="mt-3 space-y-2 text-xs leading-5 text-ink-600">
            {source.packId ? <p className="break-words">{ui.pack}{packLabel(source.packId)}</p> : null}
            {source.tags?.length ? <p className="break-words">{ui.tags}{source.tags.join(" / ")}</p> : null}
            {source.matchedKeywords?.length ? <p className="break-words">{ui.matchedKeywords}{source.matchedKeywords.join(" / ")}</p> : null}
            {source.scoreReason?.length ? <p className="break-words">{ui.scoreReason}{source.scoreReason.join(" / ")}</p> : null}
            {source.scoreBreakdown ? (
              <details className="rounded bg-white p-2 ring-1 ring-slate-200">
                <summary className="cursor-pointer font-semibold text-ink-600">{ui.scoreBreakdown}</summary>
                <div className="mt-2 grid gap-1 sm:grid-cols-2">
                  {Object.entries(source.scoreBreakdown).map(([key, value]) => (
                    <span key={key} className="break-all font-mono text-[11px] text-ink-500">{key}: {Math.round(Number(value) * 10) / 10}</span>
                  ))}
                </div>
              </details>
            ) : null}
            {source.contentPreview ? <p className="whitespace-pre-wrap break-words rounded bg-white p-2 ring-1 ring-slate-200">{source.contentPreview}{source.contentPreview.length >= 260 ? "..." : ""}</p> : null}
          </div>
        </details>
      ))}
    </div>
  );
}
