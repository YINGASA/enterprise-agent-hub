"use client";

import { useState } from "react";
import { knowledgePacks } from "@/data/knowledgePacks";
import type { KnowledgeDocument } from "@/types";

type DocumentFormProps = {
  onAdd: (document: KnowledgeDocument) => void;
};

const categories = ["制度流程", "售后规则", "岗位说明", "AI工程规范", "General"];

export function DocumentForm({ onAdd }: DocumentFormProps) {
  const [title, setTitle] = useState("");
  const [packId, setPackId] = useState<string>(knowledgePacks[0]?.id ?? "enterprise-policy");
  const [category, setCategory] = useState(categories[0]);
  const [tags, setTags] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || !content.trim()) {
      setError("请输入标题和正文后再添加文档。");
      return;
    }

    const createdAt = new Date().toISOString();
    onAdd({
      id: "user-doc-" + Date.now(),
      packId,
      title: title.trim(),
      category,
      tags: tags.split(/[，,]/).map((item) => item.trim()).filter(Boolean),
      summary: summary.trim() || content.trim().slice(0, 80),
      content: content.trim(),
      createdAt,
      updatedAt: createdAt.slice(0, 10),
      source: "localStorage",
      owner: "用户新增",
      isDefault: false,
    });

    setTitle("");
    setPackId(knowledgePacks[0]?.id ?? "enterprise-policy");
    setCategory(categories[0]);
    setTags("");
    setSummary("");
    setContent("");
    setError("");
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="font-semibold text-ink-900">新增知识库文档</h2>
        <p className="mt-1 text-sm text-ink-500">V0.9 使用浏览器 localStorage 保存用户新增文档，不接数据库。</p>
      </div>
      <div className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-ink-700">标题</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100" placeholder="例如：销售合同审批流程" />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-ink-700">知识库包</span>
          <select value={packId} onChange={(event) => setPackId(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100">
            {knowledgePacks.map((pack) => <option key={pack.id} value={pack.id}>{pack.name}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium text-ink-700">分类</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100">
            {categories.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium text-ink-700">标签</span>
          <input value={tags} onChange={(event) => setTags(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100" placeholder="例如：合同, 审批, 法务" />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-ink-700">摘要</span>
          <input value={summary} onChange={(event) => setSummary(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100" placeholder="一句话说明文档用途" />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-ink-700">正文</span>
          <textarea value={content} onChange={(event) => setContent(event.target.value)} rows={7} className="mt-1 w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100" placeholder="输入制度、流程、SOP 或岗位说明正文。" />
        </label>
        {error ? <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p> : null}
        <button type="submit" className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700">添加到知识库</button>
      </div>
    </form>
  );
}
