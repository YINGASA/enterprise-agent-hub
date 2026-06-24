import type { RagAnswer } from "@/types";

export function SourceList({ sources }: { sources: RagAnswer["sources"] }) {
  if (sources.length === 0) {
    return <p className="text-sm text-ink-500">暂无来源引用。</p>;
  }

  return (
    <div className="space-y-2">
      {sources.map((source) => (
        <div key={source.documentId} className="rounded-md border border-slate-200 bg-white p-3">
          <p className="text-sm font-medium text-ink-900">{source.title}</p>
          <p className="mt-1 text-xs text-ink-500">
            {source.category} · chunks {source.chunkIndexes.join(", ")}
          </p>
        </div>
      ))}
    </div>
  );
}
