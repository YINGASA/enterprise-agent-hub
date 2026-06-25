import type { KnowledgeSourceType, RagAnswer } from "@/types";

const ui = {
  defaultSource: "\u9ed8\u8ba4\u77e5\u8bc6\u5e93",
  userUpload: "\u7528\u6237\u4e0a\u4f20",
  userPaste: "\u7528\u6237\u7c98\u8d34",
  noSources: "\u6682\u65e0\u6765\u6e90\u5f15\u7528\u3002",
  userDoc: "\u7528\u6237\u6587\u6863",
  tags: "\u6807\u7b7e\uff1a",
  matchedKeywords: "\u547d\u4e2d\u5173\u952e\u8bcd\uff1a",
  scoreReason: "\u547d\u4e2d\u539f\u56e0\uff1a",
  chunks: "chunks",
  score: "score",
};

function sourceTypeLabel(sourceType?: KnowledgeSourceType) {
  const labels: Record<KnowledgeSourceType, string> = {
    default: ui.defaultSource,
    user_upload: ui.userUpload,
    user_paste: ui.userPaste,
  };
  return sourceType ? labels[sourceType] ?? sourceType : ui.defaultSource;
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
              {source.category} ? {ui.chunks} {source.chunkIndexes.join(", ")} ? {ui.score} {source.score ?? 0}
            </p>
          </summary>
          <div className="mt-3 space-y-2 text-xs leading-5 text-ink-600">
            {source.tags?.length ? <p className="break-words">{ui.tags}{source.tags.join(" / ")}</p> : null}
            {source.matchedKeywords?.length ? <p className="break-words">{ui.matchedKeywords}{source.matchedKeywords.join(" / ")}</p> : null}
            {source.scoreReason?.length ? <p className="break-words">{ui.scoreReason}{source.scoreReason.join(" / ")}</p> : null}
            {source.contentPreview ? <p className="whitespace-pre-wrap break-words rounded bg-white p-2 ring-1 ring-slate-200">{source.contentPreview}{source.contentPreview.length >= 260 ? "..." : ""}</p> : null}
          </div>
        </details>
      ))}
    </div>
  );
}
