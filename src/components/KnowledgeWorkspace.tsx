"use client";

import { useEffect, useMemo, useState } from "react";
import { ChunkList } from "@/components/ChunkList";
import { DocumentForm } from "@/components/DocumentForm";
import { MockJsonPanel } from "@/components/MockJsonPanel";
import { documents as defaultDocuments } from "@/data/mock";
import { splitDocument } from "@/lib/rag";
import type { KnowledgeDocument } from "@/types";

const storageKey = "enterprise-agent-hub-user-documents";

function readUserDocuments() {
  if (typeof window === "undefined") {
    return [] as KnowledgeDocument[];
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as KnowledgeDocument[]) : [];
  } catch {
    return [] as KnowledgeDocument[];
  }
}

export function KnowledgeWorkspace() {
  const [userDocuments, setUserDocuments] = useState<KnowledgeDocument[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState(defaultDocuments[0]?.id ?? "");

  useEffect(() => {
    setUserDocuments(readUserDocuments());
    setStorageReady(true);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && storageReady) {
      window.localStorage.setItem(storageKey, JSON.stringify(userDocuments));
    }
  }, [storageReady, userDocuments]);

  const allDocuments = useMemo(() => [...defaultDocuments, ...userDocuments], [userDocuments]);
  const selectedDocument = allDocuments.find((document) => document.id === selectedDocumentId) ?? allDocuments[0];
  const chunks = selectedDocument ? splitDocument(selectedDocument) : [];

  function handleAdd(document: KnowledgeDocument) {
    setUserDocuments((current) => [...current, document]);
    setSelectedDocumentId(document.id);
  }

  function handleDelete(documentId: string) {
    setUserDocuments((current) => current.filter((document) => document.id !== documentId));
    setSelectedDocumentId(defaultDocuments[0]?.id ?? "");
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-ink-900">默认知识库文档</h2>
          <p className="mt-1 text-sm text-ink-500">点击文档查看实时切片、关键词和来源信息。</p>
        </div>
        <div className="divide-y divide-slate-200">
          {allDocuments.map((document) => (
            <article key={document.id} className={`p-5 transition ${selectedDocument?.id === document.id ? "bg-brand-50/60" : "bg-white"}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <button type="button" onClick={() => setSelectedDocumentId(document.id)} className="text-left">
                  <h3 className="font-semibold text-ink-900">{document.title}</h3>
                  <p className="mt-1 text-sm text-ink-500">
                    {document.category} · 更新于 {document.updatedAt}
                  </p>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-ink-500">{document.content}</p>
                </button>
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-ink-500">{document.isDefault ? "默认" : "用户新增"}</span>
                  {!document.isDefault ? (
                    <button
                      type="button"
                      onClick={() => handleDelete(document.id)}
                      className="rounded-md border border-rose-200 px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50"
                    >
                      删除
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <aside className="space-y-5">
        <DocumentForm onAdd={handleAdd} />
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="font-semibold text-ink-900">文档切片 chunks</h2>
            <p className="mt-1 text-sm text-ink-500">当前文档：{selectedDocument?.title ?? "未选择"}</p>
          </div>
          <ChunkList chunks={chunks} />
        </section>
        <MockJsonPanel
          title="来源引用示例"
          data={allDocuments.map((document) => ({
            documentId: document.id,
            title: document.title,
            category: document.category,
            updatedAt: document.updatedAt,
          }))}
        />
      </aside>
    </div>
  );
}
