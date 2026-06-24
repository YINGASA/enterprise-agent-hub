import { MockJsonPanel } from "@/components/MockJsonPanel";
import { PageHeader } from "@/components/PageHeader";
import { documents } from "@/data/mock";

export default function KnowledgePage() {
  return (
    <div>
      <PageHeader
        eyebrow="Knowledge Base"
        title="知识库管理"
        description="展示 mock 文档列表、切片 chunks 示例与来源引用示例。V0.1 暂不提供真实上传、向量化和检索能力。"
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="font-semibold text-ink-900">文档列表</h2>
          </div>
          <div className="divide-y divide-slate-200">
            {documents.map((doc) => (
              <article key={doc.id} className="p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="font-semibold text-ink-900">{doc.title}</h3>
                    <p className="mt-1 text-sm text-ink-500">
                      {doc.source} · {doc.owner} · 更新于 {doc.updatedAt}
                    </p>
                  </div>
                  <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-ink-500">{doc.id}</span>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {doc.chunks.map((chunk) => (
                    <div key={chunk.id} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="font-mono text-xs text-brand-700">{chunk.id}</span>
                        <span className="text-xs text-ink-500">score {chunk.score}</span>
                      </div>
                      <p className="text-sm leading-6 text-ink-700">{chunk.content}</p>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
        <aside className="space-y-4">
          <MockJsonPanel
            title="来源引用示例"
            data={documents.map((doc) => ({
              document: doc.title,
              source: doc.source,
              citations: doc.citations,
            }))}
          />
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-ink-900">V0.2 预留能力</h2>
            <p className="mt-2 text-sm leading-6 text-ink-500">
              后续可接入文件上传、文本切分、Embedding、向量检索、召回重排和引用高亮。
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
