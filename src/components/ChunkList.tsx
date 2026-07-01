import type { KnowledgeChunk } from "@/types";

export function ChunkList({ chunks }: { chunks: KnowledgeChunk[] }) {
  if (chunks.length === 0) {
    return <p className="rounded-md bg-slate-50 p-4 text-sm text-ink-500">暂无可展示的 chunks。</p>;
  }

  return (
    <div className="space-y-3">
      {chunks.map((chunk) => (
        <article key={chunk.id} className="rounded-md border border-slate-200 bg-slate-50 p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-ink-500">
              <span className="font-mono text-brand-700">chunk #{chunk.chunkIndex}</span>
              <span>{chunk.sourceTitle}</span>
              <span>{chunk.category}</span>
              <span>sourceType: {chunk.sourceType ?? "default"}</span>
              <span>packId: {chunk.packId ?? "none"}</span>
              <span>vectorReady: yes (mock)</span>
              {chunk.tags?.length ? <span>tags: {chunk.tags.join(" / ")}</span> : null}
            </div>
          </div>
          <p className="text-sm leading-6 text-ink-700">{chunk.content}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {chunk.keywords.map((keyword) => (
              <span key={keyword} className="rounded-md bg-white px-2 py-1 text-xs text-ink-500 ring-1 ring-slate-200">
                {keyword}
              </span>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}
