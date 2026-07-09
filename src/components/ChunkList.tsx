import { diagnoseKnowledgeChunks } from "@/lib/knowledge/quality";
import type { KnowledgeChunk } from "@/types";

export function ChunkList({ chunks }: { chunks: KnowledgeChunk[] }) {
  if (chunks.length === 0) {
    return <p className="rounded-md bg-slate-50 p-4 text-sm text-ink-500">暂无可展示的 chunks。</p>;
  }

  const diagnostics = new Map(diagnoseKnowledgeChunks(chunks).map((item) => [item.chunkId, item]));

  return (
    <div className="space-y-3">
      {chunks.map((chunk) => {
        const diagnostic = diagnostics.get(chunk.id);
        return (
        <article key={chunk.id} className="rounded-md border border-slate-200 bg-slate-50 p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-ink-500">
              <span className="font-mono text-brand-700">chunk #{chunk.chunkIndex}</span>
              <span>{diagnostic?.characterCount ?? chunk.content.length} 字</span>
              <span>{chunk.sourceTitle}</span>
              <span>{chunk.category}</span>
              <span>sourceType: {chunk.sourceType ?? "default"}</span>
              <span>packId: {chunk.packId ?? "none"}</span>
              <span>vectorReady: yes (mock)</span>
              {chunk.tags?.length ? <span>tags: {chunk.tags.join(" / ")}</span> : null}
            </div>
            <span className={diagnostic?.status === "warning" ? "rounded bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-100" : "rounded bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100"}>
              {diagnostic?.status === "warning" ? "建议优化" : "分块良好"}
            </span>
          </div>
          <p className="break-words text-sm leading-6 text-ink-700">{chunk.content}</p>
          {diagnostic?.issues.length ? (
            <ul className="mt-3 space-y-1 rounded-md bg-amber-50 p-3 text-xs leading-5 text-amber-800">
              {diagnostic.issues.map((issue) => <li key={issue}>· {issue}</li>)}
            </ul>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {chunk.keywords.slice(0, 12).map((keyword) => (
              <span key={keyword} className="rounded-md bg-white px-2 py-1 text-xs text-ink-500 ring-1 ring-slate-200">
                {keyword}
              </span>
            ))}
          </div>
        </article>
      )})}
    </div>
  );
}
