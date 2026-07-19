import type { KnowledgeSourceType, RagAnswer } from "@/types";
import { StatePanel } from "@/components/ui/StatePanel";
import { StatusBadge } from "@/components/ui/StatusBadge";

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
    return <StatePanel compact title="未返回可引用依据" description={ui.noSources} tone="neutral" />;
  }

  return (
    <div className="space-y-3">
      {sources.map((source) => (
        <details key={`${source.documentId}-${source.chunkIndexes.join("-")}`} className="group overflow-hidden rounded-lg border border-slate-200 bg-white open:border-brand-200">
          <summary className="flex min-h-12 cursor-pointer list-none items-start justify-between gap-3 px-3 py-2.5 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500">
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2">
                <span className="break-words text-sm font-semibold text-ink-900">{source.title}</span>
                <StatusBadge tone="neutral" showDot={false}>{sourceTypeLabel(source.sourceType)}</StatusBadge>
                {source.sourceType && source.sourceType !== "default" ? <StatusBadge tone="warning" showDot={false}>{ui.userDoc}</StatusBadge> : null}
              </span>
              <span className="mt-1 block break-words text-xs leading-5 text-ink-500">
                {source.category}{" \u00b7 "}{packLabel(source.packId)}{" \u00b7 "}{ui.chunks} {source.chunkIndexes.join(", ")}{typeof source.score === "number" ? ` · ${ui.score} ${Math.round(source.score * 10) / 10}` : ""}
              </span>
            </span>
            <span className="shrink-0 pt-0.5 text-xs font-semibold text-brand-700"><span className="group-open:hidden">查看</span><span className="hidden group-open:inline">收起</span></span>
          </summary>
          <div className="space-y-2 border-t border-slate-100 bg-slate-50/70 px-3 py-3 text-xs leading-5 text-ink-600">
            {source.packId ? <p className="break-words">{ui.pack}{packLabel(source.packId)}</p> : null}
            {source.tags?.length ? <p className="break-words">{ui.tags}{source.tags.join(" / ")}</p> : null}
            {source.matchedKeywords?.length ? <p className="break-words">{ui.matchedKeywords}{source.matchedKeywords.join(" / ")}</p> : null}
            {source.scoreReason?.length ? <p className="break-words">{ui.scoreReason}{source.scoreReason.join(" / ")}</p> : null}
            {source.scoreBreakdown ? (
              <details className="rounded-md bg-white p-2 ring-1 ring-slate-200">
                <summary className="min-h-8 cursor-pointer font-semibold text-ink-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">{ui.scoreBreakdown}</summary>
                <div className="mt-2 grid gap-1 sm:grid-cols-2">
                  {Object.entries(source.scoreBreakdown).map(([key, value]) => (
                    <span key={key} className="app-tabular break-all font-mono text-[11px] text-ink-500">{key}: {Math.round(Number(value) * 10) / 10}</span>
                  ))}
                </div>
              </details>
            ) : null}
            {source.contentPreview ? <div><p className="mb-1 font-semibold text-ink-600">内容摘要</p><p className="max-w-[76ch] whitespace-pre-wrap break-words rounded-md bg-white p-2.5 text-ink-700 ring-1 ring-slate-200">{source.contentPreview}{source.contentPreview.length >= 260 ? "..." : ""}</p></div> : null}
          </div>
        </details>
      ))}
    </div>
  );
}
