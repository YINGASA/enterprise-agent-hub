"use client";

import { useEffect, useMemo, useState } from "react";
import { ChunkList } from "@/components/ChunkList";
import { DocumentForm } from "@/components/DocumentForm";
import { MockJsonPanel } from "@/components/MockJsonPanel";
import { documents as defaultDocuments } from "@/data/mock";
import { knowledgePacks } from "@/data/knowledgePacks";
import { readUserKnowledgeDocuments, writeUserKnowledgeDocuments } from "@/lib/knowledge/storage";
import { splitDocument } from "@/lib/rag";
import type { ImportedKnowledgeDocument, KnowledgeDocument, KnowledgeSourceType } from "@/types";

type PackFilter = "all" | string;

function packName(packId?: string) {
  return knowledgePacks.find((pack) => pack.id === packId)?.name ?? "未归类";
}

function sourceTypeLabel(sourceType?: KnowledgeSourceType) {
  const labels: Record<KnowledgeSourceType, string> = {
    default: "默认知识库",
    user_upload: "用户上传",
    user_paste: "用户粘贴",
  };
  return sourceType ? labels[sourceType] ?? sourceType : "默认知识库";
}

function sourceBadgeClass(sourceType?: KnowledgeSourceType) {
  if (sourceType === "user_upload") return "bg-emerald-50 text-emerald-700 ring-emerald-100";
  if (sourceType === "user_paste") return "bg-amber-50 text-amber-700 ring-amber-100";
  return "bg-slate-100 text-ink-500 ring-slate-200";
}

function matchesSearch(document: KnowledgeDocument, keyword: string) {
  if (!keyword.trim()) return true;
  const normalized = keyword.trim().toLowerCase();
  return [document.title, document.category, document.summary ?? "", document.content, ...(document.tags ?? []), packName(document.packId), sourceTypeLabel(document.sourceType)]
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}

export function KnowledgeWorkspace() {
  const [userDocuments, setUserDocuments] = useState<ImportedKnowledgeDocument[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [selectedPack, setSelectedPack] = useState<PackFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedDocumentId, setSelectedDocumentId] = useState(defaultDocuments[0]?.id ?? "");

  useEffect(() => {
    setUserDocuments(readUserKnowledgeDocuments());
    setStorageReady(true);
  }, []);

  useEffect(() => {
    if (storageReady) writeUserKnowledgeDocuments(userDocuments);
  }, [storageReady, userDocuments]);

  const allDocuments = useMemo(() => [...defaultDocuments, ...userDocuments], [userDocuments]);
  const filteredDocuments = useMemo(
    () => allDocuments.filter((document) => (selectedPack === "all" || document.packId === selectedPack) && matchesSearch(document, search)),
    [allDocuments, selectedPack, search],
  );
  const selectedDocument = allDocuments.find((document) => document.id === selectedDocumentId) ?? filteredDocuments[0] ?? allDocuments[0];
  const chunks = selectedDocument ? splitDocument(selectedDocument) : [];

  function handleAdd(document: ImportedKnowledgeDocument) {
    setUserDocuments((current) => [document, ...current]);
    setSelectedPack(document.packId ?? "all");
    setSelectedDocumentId(document.id);
  }

  function handleDelete(documentId: string) {
    setUserDocuments((current) => current.filter((document) => document.id !== documentId));
    setSelectedDocumentId(defaultDocuments[0]?.id ?? "");
  }

  function handleClearUserDocuments() {
    if (!userDocuments.length) return;
    const confirmed = window.confirm("确认清空所有用户导入文档吗？默认知识库不会被删除。");
    if (!confirmed) return;
    setUserDocuments([]);
    setSelectedDocumentId(defaultDocuments[0]?.id ?? "");
  }

  return (
    <div className="grid gap-5 overflow-x-hidden xl:grid-cols-[minmax(0,1fr)_460px]">
      <section className="min-w-0 rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="space-y-4 border-b border-slate-200 px-5 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="font-semibold text-ink-900">混合知识库管理</h2>
              <p className="mt-1 text-sm leading-6 text-ink-500">
                V1.0 支持默认 Knowledge Packs 与用户本地导入文档混合检索。用户内容保存在浏览器 localStorage，不上传服务器。
              </p>
            </div>
            <button type="button" onClick={handleClearUserDocuments} disabled={!userDocuments.length} className="rounded-md border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-ink-400">
              清空用户文档
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setSelectedPack("all")} className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${selectedPack === "all" ? "bg-brand-600 text-white" : "bg-slate-100 text-ink-600 hover:bg-slate-200"}`}>全部</button>
            {knowledgePacks.map((pack) => (
              <button key={pack.id} type="button" onClick={() => setSelectedPack(pack.id)} className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${selectedPack === pack.id ? "bg-brand-600 text-white" : "bg-slate-100 text-ink-600 hover:bg-slate-200"}`}>{pack.name}</button>
            ))}
          </div>
          <input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100" placeholder="搜索标题、摘要、标签、正文或来源类型，例如：报销、电脑申请、JSON、用户上传" />
          <div className="grid gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-md bg-slate-50 p-3"><p className="text-xs text-ink-500">默认文档</p><p className="mt-1 font-semibold text-ink-900">{defaultDocuments.length} 篇</p></div>
            <div className="rounded-md bg-slate-50 p-3"><p className="text-xs text-ink-500">用户文档</p><p className="mt-1 font-semibold text-ink-900">{userDocuments.length} 篇</p></div>
            <div className="rounded-md bg-slate-50 p-3"><p className="text-xs text-ink-500">当前筛选</p><p className="mt-1 font-semibold text-ink-900">{filteredDocuments.length} 篇</p></div>
          </div>
        </div>
        <div className="divide-y divide-slate-200">
          {filteredDocuments.map((document) => (
            <article key={document.id} className={`p-5 transition ${selectedDocument?.id === document.id ? "bg-brand-50/60" : "bg-white"}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <button type="button" onClick={() => setSelectedDocumentId(document.id)} className="min-w-0 flex-1 text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="break-words font-semibold text-ink-900">{document.title}</h3>
                    <span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-ink-500">{packName(document.packId)}</span>
                    <span className={`rounded-md px-2 py-1 text-xs font-medium ring-1 ${sourceBadgeClass(document.sourceType)}`}>{sourceTypeLabel(document.sourceType)}</span>
                  </div>
                  <p className="mt-1 text-sm text-ink-500">{document.category} · 更新于 {document.updatedAt}</p>
                  {document.originalFileName ? <p className="mt-1 break-all text-xs text-ink-500">原始文件：{document.originalFileName}</p> : null}
                  <p className="mt-2 text-sm leading-6 text-ink-600">{document.summary ?? document.content.slice(0, 120)}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(document.tags ?? []).map((tag) => <span key={tag} className="rounded-md bg-white px-2 py-1 text-xs text-ink-500 ring-1 ring-slate-200">{tag}</span>)}
                  </div>
                </button>
                <div className="flex shrink-0 items-center gap-2">
                  {!document.isDefault ? <button type="button" onClick={() => handleDelete(document.id)} className="rounded-md border border-rose-200 px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50">删除</button> : <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-ink-500">不可删除</span>}
                </div>
              </div>
            </article>
          ))}
          {filteredDocuments.length === 0 ? <p className="p-5 text-sm text-ink-500">没有匹配的文档，请调整知识库包或搜索关键词。</p> : null}
        </div>
      </section>

      <aside className="min-w-0 space-y-5">
        <DocumentForm onAdd={handleAdd} />
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="font-semibold text-ink-900">文档详情与 chunks</h2>
            <p className="mt-1 break-words text-sm text-ink-500">当前文档：{selectedDocument?.title ?? "未选择"}</p>
          </div>
          {selectedDocument ? (
            <div className="mb-4 space-y-3 rounded-md bg-slate-50 p-4 text-sm leading-6 text-ink-600">
              <div className="grid gap-2 text-xs sm:grid-cols-2">
                <p><span className="font-semibold text-ink-800">来源：</span>{sourceTypeLabel(selectedDocument.sourceType)}</p>
                <p><span className="font-semibold text-ink-800">知识库包：</span>{packName(selectedDocument.packId)}</p>
                <p><span className="font-semibold text-ink-800">分类：</span>{selectedDocument.category}</p>
                <p><span className="font-semibold text-ink-800">更新时间：</span>{selectedDocument.updatedAt}</p>
              </div>
              <p className="font-semibold text-ink-900">{selectedDocument.summary}</p>
              <p className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words rounded-md bg-white p-3 ring-1 ring-slate-200">{selectedDocument.content}</p>
            </div>
          ) : null}
          <ChunkList chunks={chunks} />
        </section>
        <MockJsonPanel title="来源引用示例" data={chunks.slice(0, 4).map((chunk) => ({ documentId: chunk.documentId, packId: chunk.packId, sourceTitle: chunk.sourceTitle, sourceType: chunk.sourceType, category: chunk.category, chunkIndex: chunk.chunkIndex, keywords: chunk.keywords.slice(0, 8) }))} />
      </aside>
    </div>
  );
}
