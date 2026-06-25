"use client";

import { useEffect, useMemo, useState } from "react";
import { ChunkList } from "@/components/ChunkList";
import { DocumentForm } from "@/components/DocumentForm";
import { MockJsonPanel } from "@/components/MockJsonPanel";
import { documents as defaultDocuments } from "@/data/mock";
import { knowledgePacks } from "@/data/knowledgePacks";
import { splitDocument } from "@/lib/rag";
import type { KnowledgeDocument } from "@/types";

const storageKey = "enterprise-agent-hub-user-documents";
type PackFilter = "all" | string;

function readUserDocuments() {
  if (typeof window === "undefined") return [] as KnowledgeDocument[];
  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as KnowledgeDocument[]) : [];
  } catch {
    return [] as KnowledgeDocument[];
  }
}

function packName(packId?: string) {
  return knowledgePacks.find((pack) => pack.id === packId)?.name ?? "未归类";
}

function matchesSearch(document: KnowledgeDocument, keyword: string) {
  if (!keyword.trim()) return true;
  const normalized = keyword.trim().toLowerCase();
  return [document.title, document.category, document.summary ?? "", document.content, ...(document.tags ?? []), packName(document.packId)]
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}

export function KnowledgeWorkspace() {
  const [userDocuments, setUserDocuments] = useState<KnowledgeDocument[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [selectedPack, setSelectedPack] = useState<PackFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedDocumentId, setSelectedDocumentId] = useState(defaultDocuments[0]?.id ?? "");

  useEffect(() => {
    setUserDocuments(readUserDocuments());
    setStorageReady(true);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && storageReady) window.localStorage.setItem(storageKey, JSON.stringify(userDocuments));
  }, [storageReady, userDocuments]);

  const allDocuments = useMemo(() => [...defaultDocuments, ...userDocuments], [userDocuments]);
  const filteredDocuments = useMemo(
    () => allDocuments.filter((document) => (selectedPack === "all" || document.packId === selectedPack) && matchesSearch(document, search)),
    [allDocuments, selectedPack, search],
  );
  const selectedDocument = allDocuments.find((document) => document.id === selectedDocumentId) ?? filteredDocuments[0] ?? allDocuments[0];
  const chunks = selectedDocument ? splitDocument(selectedDocument) : [];

  function handleAdd(document: KnowledgeDocument) {
    setUserDocuments((current) => [...current, document]);
    setSelectedPack(document.packId ?? "all");
    setSelectedDocumentId(document.id);
  }

  function handleDelete(documentId: string) {
    setUserDocuments((current) => current.filter((document) => document.id !== documentId));
    setSelectedDocumentId(defaultDocuments[0]?.id ?? "");
  }

  return (
    <div className="grid gap-5 overflow-x-hidden xl:grid-cols-[minmax(0,1fr)_440px]">
      <section className="min-w-0 rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="space-y-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="font-semibold text-ink-900">知识库场景包</h2>
            <p className="mt-1 text-sm text-ink-500">V0.9 内置 4 个知识库包、42 篇 mock 文档，可按包、分类、标签和正文搜索。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setSelectedPack("all")} className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${selectedPack === "all" ? "bg-brand-600 text-white" : "bg-slate-100 text-ink-600 hover:bg-slate-200"}`}>全部</button>
            {knowledgePacks.map((pack) => (
              <button key={pack.id} type="button" onClick={() => setSelectedPack(pack.id)} className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${selectedPack === pack.id ? "bg-brand-600 text-white" : "bg-slate-100 text-ink-600 hover:bg-slate-200"}`}>{pack.name}</button>
            ))}
          </div>
          <input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100" placeholder="搜索标题、摘要、标签或正文，例如：退货、JSON、简历、报销" />
        </div>
        <div className="divide-y divide-slate-200">
          {filteredDocuments.map((document) => (
            <article key={document.id} className={`p-5 transition ${selectedDocument?.id === document.id ? "bg-brand-50/60" : "bg-white"}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <button type="button" onClick={() => setSelectedDocumentId(document.id)} className="min-w-0 flex-1 text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-ink-900">{document.title}</h3>
                    <span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-ink-500">{packName(document.packId)}</span>
                  </div>
                  <p className="mt-1 text-sm text-ink-500">{document.category} · 更新于 {document.updatedAt}</p>
                  <p className="mt-2 text-sm leading-6 text-ink-600">{document.summary ?? document.content.slice(0, 100)}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(document.tags ?? []).map((tag) => <span key={tag} className="rounded-md bg-white px-2 py-1 text-xs text-ink-500 ring-1 ring-slate-200">{tag}</span>)}
                  </div>
                </button>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-ink-500">{document.isDefault ? "默认" : "用户新增"}</span>
                  {!document.isDefault ? <button type="button" onClick={() => handleDelete(document.id)} className="rounded-md border border-rose-200 px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50">删除</button> : null}
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
            <div className="mb-4 rounded-md bg-slate-50 p-4 text-sm leading-6 text-ink-600">
              <p className="font-semibold text-ink-900">{selectedDocument.summary}</p>
              <p className="mt-2 break-words">{selectedDocument.content}</p>
              <p className="mt-2 text-xs text-ink-500">来源：{selectedDocument.source ?? "mock"} · Owner：{selectedDocument.owner ?? "Enterprise Agent Hub"}</p>
            </div>
          ) : null}
          <ChunkList chunks={chunks} />
        </section>
        <MockJsonPanel title="来源引用示例" data={chunks.slice(0, 4).map((chunk) => ({ documentId: chunk.documentId, packId: chunk.packId, sourceTitle: chunk.sourceTitle, category: chunk.category, chunkIndex: chunk.chunkIndex, keywords: chunk.keywords.slice(0, 8) }))} />
      </aside>
    </div>
  );
}
