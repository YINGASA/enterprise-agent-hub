"use client";

import { useState } from "react";
import type { KnowledgeDocument } from "@/types";

type DocumentFormProps = {
  onAdd: (document: KnowledgeDocument) => void;
};

const categories = ["HR Policy", "Security", "After Sales", "Recruiting", "General"];

export function DocumentForm({ onAdd }: DocumentFormProps) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(categories[0]);
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
      id: `user-doc-${Date.now()}`,
      title: title.trim(),
      category,
      content: content.trim(),
      createdAt,
      updatedAt: createdAt,
      isDefault: false,
    });

    setTitle("");
    setCategory(categories[0]);
    setContent("");
    setError("");
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="font-semibold text-ink-900">新增知识库文档</h2>
        <p className="mt-1 text-sm text-ink-500">V0.3 使用浏览器状态和 localStorage 保存，不接数据库。</p>
      </div>
      <div className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-ink-700">标题</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            placeholder="例如：销售合同审批流程"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-ink-700">分类</span>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          >
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium text-ink-700">正文</span>
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            rows={6}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm leading-6 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            placeholder="输入一段制度、流程或岗位要求文本。"
          />
        </label>
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        <button type="submit" className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
          添加文档
        </button>
      </div>
    </form>
  );
}
