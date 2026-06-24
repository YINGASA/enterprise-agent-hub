import { SourceList } from "@/components/SourceList";
import type { RagAnswer } from "@/types";

export function RagResultPanel({ result }: { result: RagAnswer | null }) {
  if (!result) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-ink-900">RAG mock 回答</h2>
        <p className="mt-2 text-sm leading-6 text-ink-500">输入问题后，这里会展示 mock RAG 回答、召回 chunks、来源引用和检索分数。</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-ink-900">RAG mock 回答</h2>
          <p className="mt-1 text-sm text-ink-500">问题：{result.question}</p>
        </div>
        <span className="rounded-md bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">{result.mode}</span>
      </div>
      <p className="rounded-md bg-slate-50 p-4 text-sm leading-7 text-ink-700">{result.answer}</p>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div>
          <h3 className="mb-3 text-sm font-semibold text-ink-900">检索到的 chunks</h3>
          <div className="space-y-3">
            {result.retrievedChunks.length > 0 ? (
              result.retrievedChunks.map((item) => (
                <article key={item.chunk.id} className="rounded-md border border-slate-200 p-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-3 text-xs text-ink-500">
                    <span className="font-mono text-brand-700">{item.chunk.id}</span>
                    <span>score {item.score}</span>
                  </div>
                  <p className="text-sm leading-6 text-ink-700">{item.chunk.content}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.matchedKeywords.map((keyword) => (
                      <span key={keyword} className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                        {keyword}
                      </span>
                    ))}
                  </div>
                </article>
              ))
            ) : (
              <p className="rounded-md bg-slate-50 p-4 text-sm text-ink-500">未召回相关 chunk。</p>
            )}
          </div>
        </div>
        <aside>
          <h3 className="mb-3 text-sm font-semibold text-ink-900">来源引用</h3>
          <SourceList sources={result.sources} />
        </aside>
      </div>
    </section>
  );
}
